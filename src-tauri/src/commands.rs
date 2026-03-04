use crate::db;
use crate::scoring;
use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "bmp", "tiff", "tif", "webp", "cr2", "cr3", "nef", "arw", "orf",
    "rw2", "dng", "raf",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub total_found: usize,
    pub imported: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub group_id: String,
    pub photos: Vec<db::Photo>,
}

/// Import a folder of images, score them, and store results.
#[tauri::command]
pub async fn import_folder(folder_path: String) -> Result<ImportResult, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid folder path".to_string());
    }

    let mut image_paths: Vec<std::path::PathBuf> = Vec::new();
    for entry in WalkDir::new(path).max_depth(1).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                if SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                    image_paths.push(entry.path().to_path_buf());
                }
            }
        }
    }

    let total_found = image_paths.len();
    let mut imported = 0;
    let mut failed = 0;
    let mut errors = Vec::new();

    for image_path in &image_paths {
        match process_single_image(image_path, &folder_path) {
            Ok(()) => imported += 1,
            Err(e) => {
                failed += 1;
                errors.push(format!("{}: {}", image_path.display(), e));
            }
        }
    }

    // After all photos are imported, run duplicate grouping
    if let Err(e) = run_duplicate_grouping() {
        errors.push(format!("Duplicate grouping error: {}", e));
    }

    Ok(ImportResult {
        total_found,
        imported,
        failed,
        errors,
    })
}

fn process_single_image(image_path: &Path, folder_path: &str) -> Result<(), String> {
    let img = scoring::load_image(image_path)?;
    let (w, h) = img.dimensions();
    let file_size = std::fs::metadata(image_path)
        .map(|m| m.len())
        .unwrap_or(0);
    let file_name = image_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let sharpness = scoring::sharpness_score(&img);
    let exposure = scoring::exposure_score(&img);
    let composition = scoring::composition_score(&img);
    let (face_count, eyes_open) = scoring::detect_faces(&img);
    let overall = scoring::overall_score(sharpness, exposure, composition, face_count, eyes_open);
    let phash = scoring::perceptual_hash(&img);

    let photo = db::Photo {
        id: uuid::Uuid::new_v4().to_string(),
        file_path: image_path.to_string_lossy().to_string(),
        file_name,
        folder_path: folder_path.to_string(),
        width: w,
        height: h,
        file_size,
        sharpness_score: sharpness,
        exposure_score: exposure,
        composition_score: composition,
        face_count,
        eyes_open_score: eyes_open,
        overall_score: overall,
        similarity_hash: phash,
        status: "unreviewed".to_string(),
        duplicate_group: String::new(),
        created_at: String::new(),
    };

    db::insert_photo(&photo).map_err(|e| format!("DB error: {}", e))
}

fn run_duplicate_grouping() -> Result<(), String> {
    let photos = db::get_all_photos().map_err(|e| e.to_string())?;
    let hash_pairs: Vec<(String, String)> = photos
        .iter()
        .map(|p| (p.id.clone(), p.similarity_hash.clone()))
        .collect();

    // Threshold: 10 bits difference out of 256 ≈ very similar
    let groups = scoring::group_duplicates(&hash_pairs, 10);

    if !groups.is_empty() {
        db::update_duplicate_groups(&groups).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Get all photos, optionally filtered by folder.
#[tauri::command]
pub async fn get_photos(folder_path: Option<String>) -> Result<Vec<db::Photo>, String> {
    match folder_path {
        Some(folder) => db::get_photos_by_folder(&folder).map_err(|e| e.to_string()),
        None => db::get_all_photos().map_err(|e| e.to_string()),
    }
}

/// Get a base64 thumbnail for a photo.
#[tauri::command]
pub async fn get_photo_thumbnail(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    let img = scoring::load_image(path)?;
    Ok(scoring::generate_thumbnail(&img, 300))
}

/// Update a photo's keep/reject status.
#[tauri::command]
pub async fn update_photo_status(photo_id: String, status: String) -> Result<(), String> {
    if !["keep", "reject", "unreviewed"].contains(&status.as_str()) {
        return Err("Invalid status. Use 'keep', 'reject', or 'unreviewed'.".to_string());
    }
    db::update_status(&photo_id, &status).map_err(|e| e.to_string())
}

/// Auto-cull: mark top N% as keep, bottom N% as reject.
#[tauri::command]
pub async fn auto_cull(keep_threshold: f64, reject_threshold: f64) -> Result<String, String> {
    let photos = db::get_all_photos().map_err(|e| e.to_string())?;
    if photos.is_empty() {
        return Ok("No photos to cull".to_string());
    }

    let mut kept = 0;
    let mut rejected = 0;

    for photo in &photos {
        if photo.overall_score >= keep_threshold {
            db::update_status(&photo.id, "keep").map_err(|e| e.to_string())?;
            kept += 1;
        } else if photo.overall_score < reject_threshold {
            db::update_status(&photo.id, "reject").map_err(|e| e.to_string())?;
            rejected += 1;
        }
    }

    Ok(format!(
        "Auto-cull complete: {} kept, {} rejected, {} unreviewed",
        kept,
        rejected,
        photos.len() - kept - rejected
    ))
}

/// Export keeper photos to a destination folder.
#[tauri::command]
pub async fn export_keepers(destination: String) -> Result<String, String> {
    let dest_path = Path::new(&destination);
    std::fs::create_dir_all(dest_path)
        .map_err(|e| format!("Failed to create destination: {}", e))?;

    let keepers = db::get_keepers().map_err(|e| e.to_string())?;
    let mut exported = 0;
    let mut errors = Vec::new();

    for photo in &keepers {
        let src = Path::new(&photo.file_path);
        let dest_file = dest_path.join(&photo.file_name);
        match std::fs::copy(src, &dest_file) {
            Ok(_) => exported += 1,
            Err(e) => errors.push(format!("{}: {}", photo.file_name, e)),
        }
    }

    if errors.is_empty() {
        Ok(format!("Exported {} photos to {}", exported, destination))
    } else {
        Ok(format!(
            "Exported {} photos ({} errors): {}",
            exported,
            errors.len(),
            errors.join("; ")
        ))
    }
}

/// Get duplicate groups.
#[tauri::command]
pub async fn get_duplicate_groups() -> Result<Vec<DuplicateGroup>, String> {
    let photos = db::get_all_photos().map_err(|e| e.to_string())?;
    let mut groups: std::collections::HashMap<String, Vec<db::Photo>> =
        std::collections::HashMap::new();

    for photo in photos {
        if !photo.duplicate_group.is_empty() {
            groups
                .entry(photo.duplicate_group.clone())
                .or_default()
                .push(photo);
        }
    }

    let mut result: Vec<DuplicateGroup> = groups
        .into_iter()
        .map(|(group_id, photos)| DuplicateGroup { group_id, photos })
        .collect();
    result.sort_by(|a, b| a.group_id.cmp(&b.group_id));
    Ok(result)
}

/// Re-score a single photo.
#[tauri::command]
pub async fn rescore_photo(file_path: String) -> Result<db::Photo, String> {
    let path = Path::new(&file_path);
    let img = scoring::load_image(path)?;

    let sharpness = scoring::sharpness_score(&img);
    let exposure = scoring::exposure_score(&img);
    let composition = scoring::composition_score(&img);
    let (face_count, eyes_open) = scoring::detect_faces(&img);
    let overall = scoring::overall_score(sharpness, exposure, composition, face_count, eyes_open);

    // Get existing photo from DB and update scores
    let photos = db::get_all_photos().map_err(|e| e.to_string())?;
    let existing = photos
        .iter()
        .find(|p| p.file_path == file_path)
        .ok_or("Photo not found in database")?;

    let updated = db::Photo {
        sharpness_score: sharpness,
        exposure_score: exposure,
        composition_score: composition,
        face_count,
        eyes_open_score: eyes_open,
        overall_score: overall,
        ..existing.clone()
    };

    db::insert_photo(&updated).map_err(|e| e.to_string())?;
    Ok(updated)
}

use image::GenericImageView;
