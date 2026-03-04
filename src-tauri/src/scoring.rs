use image::{DynamicImage, GenericImageView, GrayImage, Luma};
use sha2::{Digest, Sha256};
use std::path::Path;

/// Compute sharpness score using Laplacian variance.
/// Higher values = sharper image. Normalized to 0.0–1.0.
pub fn sharpness_score(img: &DynamicImage) -> f64 {
    let gray = img.to_luma8();
    let (w, h) = gray.dimensions();
    if w < 3 || h < 3 {
        return 0.0;
    }

    let mut sum = 0.0f64;
    let mut count = 0u64;

    for y in 1..(h - 1) {
        for x in 1..(w - 1) {
            let center = gray.get_pixel(x, y)[0] as f64;
            let top = gray.get_pixel(x, y - 1)[0] as f64;
            let bottom = gray.get_pixel(x, y + 1)[0] as f64;
            let left = gray.get_pixel(x - 1, y)[0] as f64;
            let right = gray.get_pixel(x + 1, y)[0] as f64;

            let laplacian = (top + bottom + left + right) - 4.0 * center;
            sum += laplacian * laplacian;
            count += 1;
        }
    }

    let variance = if count > 0 { sum / count as f64 } else { 0.0 };
    // Normalize: typical sharp images have variance > 500, blurry < 100
    (variance / 1000.0).min(1.0)
}

/// Compute exposure score based on histogram analysis.
/// Checks for over/under exposure. 1.0 = well exposed.
pub fn exposure_score(img: &DynamicImage) -> f64 {
    let gray = img.to_luma8();
    let (w, h) = gray.dimensions();
    let total = (w * h) as f64;
    if total == 0.0 {
        return 0.0;
    }

    let mut histogram = [0u64; 256];
    for pixel in gray.pixels() {
        histogram[pixel[0] as usize] += 1;
    }

    // Check under-exposure (bottom 10% of range)
    let dark_pixels: u64 = histogram[..26].iter().sum();
    let dark_ratio = dark_pixels as f64 / total;

    // Check over-exposure (top 10% of range)
    let bright_pixels: u64 = histogram[230..].iter().sum();
    let bright_ratio = bright_pixels as f64 / total;

    // Mean brightness
    let mean: f64 = histogram
        .iter()
        .enumerate()
        .map(|(i, &count)| i as f64 * count as f64)
        .sum::<f64>()
        / total;
    let mean_normalized = mean / 255.0;

    // Ideal mean is around 0.45-0.55
    let mean_score = 1.0 - ((mean_normalized - 0.5).abs() * 2.0).min(1.0);

    // Penalize heavy clipping
    let clip_penalty = 1.0 - (dark_ratio.max(bright_ratio) * 2.0).min(1.0);

    (mean_score * 0.6 + clip_penalty * 0.4).max(0.0).min(1.0)
}

/// Compute composition score using rule-of-thirds analysis.
/// Checks if high-contrast edges align with thirds grid.
pub fn composition_score(img: &DynamicImage) -> f64 {
    let gray = img.to_luma8();
    let (w, h) = gray.dimensions();
    if w < 10 || h < 10 {
        return 0.5;
    }

    // Compute simple edge magnitude
    let mut edge_map: Vec<f64> = Vec::with_capacity((w * h) as usize);
    for y in 0..h {
        for x in 0..w {
            if x == 0 || x == w - 1 || y == 0 || y == h - 1 {
                edge_map.push(0.0);
                continue;
            }
            let gx = gray.get_pixel(x + 1, y)[0] as f64 - gray.get_pixel(x - 1, y)[0] as f64;
            let gy = gray.get_pixel(x, y + 1)[0] as f64 - gray.get_pixel(x, y - 1)[0] as f64;
            edge_map.push((gx * gx + gy * gy).sqrt());
        }
    }

    let total_energy: f64 = edge_map.iter().sum();
    if total_energy == 0.0 {
        return 0.5;
    }

    // Energy near rule-of-thirds lines (within 5% of image dimension)
    let third_x = [w / 3, 2 * w / 3];
    let third_y = [h / 3, 2 * h / 3];
    let margin_x = (w as f64 * 0.05) as u32;
    let margin_y = (h as f64 * 0.05) as u32;

    let mut thirds_energy = 0.0f64;
    for y in 0..h {
        for x in 0..w {
            let idx = (y * w + x) as usize;
            let near_third_x = third_x
                .iter()
                .any(|&tx| x >= tx.saturating_sub(margin_x) && x <= tx + margin_x);
            let near_third_y = third_y
                .iter()
                .any(|&ty| y >= ty.saturating_sub(margin_y) && y <= ty + margin_y);
            if near_third_x || near_third_y {
                thirds_energy += edge_map[idx];
            }
        }
    }

    // What fraction of total edge energy falls on thirds lines
    let thirds_ratio = thirds_energy / total_energy;
    // Expected random ratio is roughly 0.18 (two horiz + two vert lines × 10% width)
    // Good composition pushes this higher
    let score = (thirds_ratio / 0.35).min(1.0);
    score.max(0.1).min(1.0)
}

/// Simple face detection using skin-color heuristic + connected components.
/// Returns (face_count, eyes_open_score).
/// This is a lightweight heuristic approach – not ONNX-based.
pub fn detect_faces(img: &DynamicImage) -> (i32, f64) {
    let rgb = img.to_rgb8();
    let (w, h) = rgb.dimensions();
    if w < 20 || h < 20 {
        return (0, 0.0);
    }

    // Downsample for speed
    let scale = if w > 800 { w as f64 / 400.0 } else { 1.0 };
    let sw = (w as f64 / scale) as u32;
    let sh = (h as f64 / scale) as u32;
    let small = image::imageops::resize(&rgb, sw, sh, image::imageops::FilterType::Nearest);

    // Create skin mask using YCbCr color space heuristic
    let mut skin_mask = GrayImage::new(sw, sh);
    for y in 0..sh {
        for x in 0..sw {
            let p = small.get_pixel(x, y);
            let r = p[0] as f64;
            let g = p[1] as f64;
            let b = p[2] as f64;

            // Convert to YCbCr
            let _y_val = 0.299 * r + 0.587 * g + 0.114 * b;
            let cb = 128.0 - 0.169 * r - 0.331 * g + 0.500 * b;
            let cr = 128.0 + 0.500 * r - 0.419 * g - 0.081 * b;

            // Skin color thresholds in YCbCr space
            let is_skin = cb >= 77.0 && cb <= 127.0 && cr >= 133.0 && cr <= 173.0;
            if is_skin {
                skin_mask.put_pixel(x, y, Luma([255]));
            }
        }
    }

    // Simple connected component labeling to count face-sized blobs
    let mut labels = vec![0u32; (sw * sh) as usize];
    let mut next_label = 1u32;
    let mut label_sizes: std::collections::HashMap<u32, u32> = std::collections::HashMap::new();

    for y in 0..sh {
        for x in 0..sw {
            if skin_mask.get_pixel(x, y)[0] == 0 || labels[(y * sw + x) as usize] != 0 {
                continue;
            }
            // BFS flood fill
            let label = next_label;
            next_label += 1;
            let mut queue = vec![(x, y)];
            let mut size = 0u32;
            while let Some((cx, cy)) = queue.pop() {
                let idx = (cy * sw + cx) as usize;
                if labels[idx] != 0 || skin_mask.get_pixel(cx, cy)[0] == 0 {
                    continue;
                }
                labels[idx] = label;
                size += 1;
                if cx > 0 { queue.push((cx - 1, cy)); }
                if cx < sw - 1 { queue.push((cx + 1, cy)); }
                if cy > 0 { queue.push((cx, cy - 1)); }
                if cy < sh - 1 { queue.push((cx, cy + 1)); }
            }
            label_sizes.insert(label, size);
        }
    }

    // Filter blobs by face-like size (between 0.5% and 15% of image area)
    let total_pixels = sw * sh;
    let min_face = (total_pixels as f64 * 0.005) as u32;
    let max_face = (total_pixels as f64 * 0.15) as u32;
    let face_count = label_sizes
        .values()
        .filter(|&&size| size >= min_face && size <= max_face)
        .count() as i32;

    // Eyes-open score: heuristic based on contrast in upper portion of face regions
    // For simplicity, give a moderate default score when faces are detected
    let eyes_score = if face_count > 0 { 0.7 } else { 0.0 };

    (face_count, eyes_score)
}

/// Compute a perceptual hash for similarity/duplicate detection.
/// Uses average hash (aHash) – fast and effective for near-duplicates.
pub fn perceptual_hash(img: &DynamicImage) -> String {
    let small = img.resize_exact(16, 16, image::imageops::FilterType::Lanczos3);
    let gray = small.to_luma8();

    // Compute average
    let sum: u64 = gray.pixels().map(|p| p[0] as u64).sum();
    let avg = sum / 256;

    // Build hash: 1 if above average, 0 if below
    let mut hash_bytes = [0u8; 32];
    for (i, pixel) in gray.pixels().enumerate() {
        let byte_idx = i / 8;
        let bit_idx = 7 - (i % 8);
        if pixel[0] as u64 >= avg {
            hash_bytes[byte_idx] |= 1 << bit_idx;
        }
    }

    hex::encode(&hash_bytes)
}

/// Compute Hamming distance between two hex-encoded hashes.
pub fn hash_distance(hash_a: &str, hash_b: &str) -> u32 {
    let a = hex::decode(hash_a).unwrap_or_default();
    let b = hex::decode(hash_b).unwrap_or_default();
    a.iter()
        .zip(b.iter())
        .map(|(&x, &y)| (x ^ y).count_ones())
        .sum()
}

/// Group photos by similarity using perceptual hash.
/// Returns list of (photo_id, group_id) pairs.
pub fn group_duplicates(photos: &[(String, String)], threshold: u32) -> Vec<(String, String)> {
    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut assigned = vec![false; photos.len()];

    for i in 0..photos.len() {
        if assigned[i] {
            continue;
        }
        let mut group = vec![i];
        assigned[i] = true;

        for j in (i + 1)..photos.len() {
            if assigned[j] {
                continue;
            }
            let dist = hash_distance(&photos[i].1, &photos[j].1);
            if dist <= threshold {
                group.push(j);
                assigned[j] = true;
            }
        }

        if group.len() > 1 {
            groups.push(group);
        }
    }

    let mut result = Vec::new();
    for (group_idx, group) in groups.iter().enumerate() {
        let group_id = format!("group_{}", group_idx + 1);
        for &photo_idx in group {
            result.push((photos[photo_idx].0.clone(), group_id.clone()));
        }
    }
    result
}

/// Compute overall score from individual components.
pub fn overall_score(
    sharpness: f64,
    exposure: f64,
    composition: f64,
    face_count: i32,
    eyes_open: f64,
) -> f64 {
    let base = sharpness * 0.35 + exposure * 0.25 + composition * 0.15;

    // Face bonus: having faces is good for portrait photography
    let face_bonus = if face_count > 0 {
        0.15 * (1.0 - (1.0 / (face_count as f64 + 1.0))) + eyes_open * 0.10
    } else {
        // Non-portrait: redistribute face weight to sharpness and exposure
        sharpness * 0.10 + exposure * 0.15
    };

    (base + face_bonus).max(0.0).min(1.0)
}

/// Load an image from a file path, handling common formats.
pub fn load_image(path: &Path) -> Result<DynamicImage, String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "bmp" | "tiff" | "tif" | "webp" => {
            image::open(path).map_err(|e| format!("Failed to open image: {}", e))
        }
        // RAW formats - attempt to decode with image crate's built-in support
        // For full RAW support, users should install dcraw or use pre-converted files
        "cr2" | "cr3" | "nef" | "arw" | "orf" | "rw2" | "dng" | "raf" => {
            // Try loading as-is first (some DNG files work)
            image::open(path).map_err(|e| {
                format!(
                    "RAW format '{}' not supported without dcraw. Convert to JPEG/TIFF first. Error: {}",
                    ext, e
                )
            })
        }
        _ => Err(format!("Unsupported image format: {}", ext)),
    }
}

/// Generate a thumbnail as base64-encoded JPEG.
pub fn generate_thumbnail(img: &DynamicImage, max_size: u32) -> String {
    let thumb = img.thumbnail(max_size, max_size);
    let mut buf = std::io::Cursor::new(Vec::new());
    thumb
        .write_to(&mut buf, image::ImageFormat::Jpeg)
        .unwrap_or_default();
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, buf.into_inner())
}
