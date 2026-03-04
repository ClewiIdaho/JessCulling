use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

static DB_PATH: once_cell::sync::Lazy<Mutex<Option<PathBuf>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(None));

pub fn set_db_path(path: PathBuf) {
    *DB_PATH.lock().unwrap() = Some(path);
}

fn get_connection() -> Result<Connection> {
    let path = DB_PATH.lock().unwrap();
    let path = path.as_ref().expect("DB path not set");
    Connection::open(path)
}

pub fn init_db(path: &PathBuf) -> Result<()> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS photos (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL UNIQUE,
            file_name TEXT NOT NULL,
            folder_path TEXT NOT NULL,
            width INTEGER DEFAULT 0,
            height INTEGER DEFAULT 0,
            file_size INTEGER DEFAULT 0,
            sharpness_score REAL DEFAULT 0.0,
            exposure_score REAL DEFAULT 0.0,
            composition_score REAL DEFAULT 0.0,
            face_count INTEGER DEFAULT 0,
            eyes_open_score REAL DEFAULT 0.0,
            overall_score REAL DEFAULT 0.0,
            similarity_hash TEXT DEFAULT '',
            status TEXT DEFAULT 'unreviewed',
            duplicate_group TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_photos_folder ON photos(folder_path);
        CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
        CREATE INDEX IF NOT EXISTS idx_photos_score ON photos(overall_score);
        CREATE INDEX IF NOT EXISTS idx_photos_dup ON photos(duplicate_group);",
    )?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Photo {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub folder_path: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub sharpness_score: f64,
    pub exposure_score: f64,
    pub composition_score: f64,
    pub face_count: i32,
    pub eyes_open_score: f64,
    pub overall_score: f64,
    pub similarity_hash: String,
    pub status: String,
    pub duplicate_group: String,
    pub created_at: String,
}

pub fn insert_photo(photo: &Photo) -> Result<()> {
    let conn = get_connection()?;
    conn.execute(
        "INSERT OR REPLACE INTO photos (
            id, file_path, file_name, folder_path, width, height, file_size,
            sharpness_score, exposure_score, composition_score, face_count,
            eyes_open_score, overall_score, similarity_hash, status, duplicate_group
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            photo.id,
            photo.file_path,
            photo.file_name,
            photo.folder_path,
            photo.width,
            photo.height,
            photo.file_size,
            photo.sharpness_score,
            photo.exposure_score,
            photo.composition_score,
            photo.face_count,
            photo.eyes_open_score,
            photo.overall_score,
            photo.similarity_hash,
            photo.status,
            photo.duplicate_group,
        ],
    )?;
    Ok(())
}

pub fn get_photos_by_folder(folder: &str) -> Result<Vec<Photo>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, folder_path, width, height, file_size,
            sharpness_score, exposure_score, composition_score, face_count,
            eyes_open_score, overall_score, similarity_hash, status, duplicate_group, created_at
         FROM photos WHERE folder_path = ?1 ORDER BY overall_score DESC",
    )?;
    let rows = stmt.query_map(params![folder], |row| {
        Ok(Photo {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            folder_path: row.get(3)?,
            width: row.get(4)?,
            height: row.get(5)?,
            file_size: row.get(6)?,
            sharpness_score: row.get(7)?,
            exposure_score: row.get(8)?,
            composition_score: row.get(9)?,
            face_count: row.get(10)?,
            eyes_open_score: row.get(11)?,
            overall_score: row.get(12)?,
            similarity_hash: row.get(13)?,
            status: row.get(14)?,
            duplicate_group: row.get(15)?,
            created_at: row.get(16)?,
        })
    })?;
    rows.collect()
}

pub fn get_all_photos() -> Result<Vec<Photo>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, folder_path, width, height, file_size,
            sharpness_score, exposure_score, composition_score, face_count,
            eyes_open_score, overall_score, similarity_hash, status, duplicate_group, created_at
         FROM photos ORDER BY overall_score DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Photo {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            folder_path: row.get(3)?,
            width: row.get(4)?,
            height: row.get(5)?,
            file_size: row.get(6)?,
            sharpness_score: row.get(7)?,
            exposure_score: row.get(8)?,
            composition_score: row.get(9)?,
            face_count: row.get(10)?,
            eyes_open_score: row.get(11)?,
            overall_score: row.get(12)?,
            similarity_hash: row.get(13)?,
            status: row.get(14)?,
            duplicate_group: row.get(15)?,
            created_at: row.get(16)?,
        })
    })?;
    rows.collect()
}

pub fn update_status(photo_id: &str, status: &str) -> Result<()> {
    let conn = get_connection()?;
    conn.execute(
        "UPDATE photos SET status = ?1 WHERE id = ?2",
        params![status, photo_id],
    )?;
    Ok(())
}

pub fn get_keepers() -> Result<Vec<Photo>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, file_path, file_name, folder_path, width, height, file_size,
            sharpness_score, exposure_score, composition_score, face_count,
            eyes_open_score, overall_score, similarity_hash, status, duplicate_group, created_at
         FROM photos WHERE status = 'keep' ORDER BY file_name",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Photo {
            id: row.get(0)?,
            file_path: row.get(1)?,
            file_name: row.get(2)?,
            folder_path: row.get(3)?,
            width: row.get(4)?,
            height: row.get(5)?,
            file_size: row.get(6)?,
            sharpness_score: row.get(7)?,
            exposure_score: row.get(8)?,
            composition_score: row.get(9)?,
            face_count: row.get(10)?,
            eyes_open_score: row.get(11)?,
            overall_score: row.get(12)?,
            similarity_hash: row.get(13)?,
            status: row.get(14)?,
            duplicate_group: row.get(15)?,
            created_at: row.get(16)?,
        })
    })?;
    rows.collect()
}

pub fn update_duplicate_groups(groups: &[(String, String)]) -> Result<()> {
    let conn = get_connection()?;
    let tx = conn.unchecked_transaction()?;
    for (photo_id, group_id) in groups {
        tx.execute(
            "UPDATE photos SET duplicate_group = ?1 WHERE id = ?2",
            params![group_id, photo_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}
