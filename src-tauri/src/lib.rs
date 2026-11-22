mod db;
mod system;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Evita tela em branco em algumas GPUs/sessões Wayland no Linux.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(system::OAuthState::default())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            let database = db::Db::open(dir.join("gcp-notas.db"))?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_list,
            db::db_get,
            db::db_put,
            db::db_delete,
            db::db_clear,
            system::read_text_file,
            system::write_text_file,
            system::write_binary_file,
            system::platform_info,
            system::oauth_start,
            system::oauth_result,
            system::update_download,
            system::update_install,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o GCP Notas");
}
