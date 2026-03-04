#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod db;
mod scoring;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::import_folder,
            commands::get_photos,
            commands::get_photo_thumbnail,
            commands::update_photo_status,
            commands::auto_cull,
            commands::export_keepers,
            commands::get_duplicate_groups,
            commands::rescore_photo,
        ])
        .setup(|app| {
            let app_dir = app
                .path_resolver()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("culling.db");
            db::init_db(&db_path).expect("failed to init database");
            db::set_db_path(db_path);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
