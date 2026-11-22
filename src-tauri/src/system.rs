//! Arquivos, OAuth por loopback (Google Drive / OneDrive) e atualizações.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

type R<T> = Result<T, String>;

// ---------------------------------------------------------------- arquivos

#[tauri::command]
pub fn read_text_file(path: String) -> R<String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> R<()> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_binary_file(path: String, base64_data: String) -> R<()> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct PlatformInfo {
    os: String,
    arch: String,
    package: String,
    version: String,
    data_dir: String,
}

#[tauri::command]
pub fn platform_info(app: AppHandle) -> PlatformInfo {
    let data_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    PlatformInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        package: linux_package_kind(),
        version: app.package_info().version.to_string(),
        data_dir,
    }
}

/// Descobre por qual gerenciador o app foi instalado (deb, rpm ou pacman).
fn linux_package_kind() -> String {
    if std::env::consts::OS != "linux" {
        return String::new(); // Android, Windows e macOS não usam gerenciador de pacotes
    }
    let exe = std::env::current_exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    let ok = |cmd: &str, args: &[&str]| {
        std::process::Command::new(cmd)
            .args(args)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    };
    if ok("pacman", &["-Qo", &exe]) {
        "arch".into()
    } else if ok("dpkg", &["-S", &exe]) {
        "deb".into()
    } else if ok("rpm", &["-qf", &exe]) {
        "rpm".into()
    } else if ok("pacman", &["--version"]) {
        "arch".into()
    } else if ok("dpkg", &["--version"]) {
        "deb".into()
    } else if ok("rpm", &["--version"]) {
        "rpm".into()
    } else {
        "unknown".into()
    }
}

// ------------------------------------------------------------------- OAuth

#[derive(Default)]
pub struct OAuthState(pub Arc<Mutex<HashMap<u16, Option<String>>>>);

const OAUTH_PAGE: &str = "<!doctype html><html><head><meta charset='utf-8'><title>GCP Notas</title>\
<style>body{font-family:system-ui,sans-serif;background:#0f1020;color:#e8e8f5;display:grid;place-items:center;height:100vh;margin:0}\
.c{text-align:center;padding:40px;border-radius:20px;background:#1a1b33;border:1px solid #2c2e52}h1{font-size:22px}</style></head>\
<body><div class='c'><h1>&#10003; GCP Notas</h1><p>Conta conectada. Você já pode fechar esta janela.</p>\
<p style='opacity:.7'>Account connected. You can close this window. · Cuenta conectada. Ya puede cerrar esta ventana.</p></div></body></html>";

/// Abre um servidor local temporário e devolve a porta para o redirect do OAuth.
#[tauri::command]
pub fn oauth_start(state: tauri::State<OAuthState>) -> R<u16> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let map = state.0.clone();
    map.lock().map_err(|e| e.to_string())?.insert(port, None);
    std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(300);
        while Instant::now() < deadline {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                    let mut buf = [0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]).to_string();
                    let path = req.split_whitespace().nth(1).unwrap_or("/").to_string();
                    if path.starts_with("/favicon") {
                        let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
                        continue;
                    }
                    let body = OAUTH_PAGE.as_bytes();
                    let head = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    );
                    let _ = stream.write_all(head.as_bytes());
                    let _ = stream.write_all(body);
                    if let Ok(mut m) = map.lock() {
                        m.insert(port, Some(format!("http://127.0.0.1:{}{}", port, path)));
                    }
                    return;
                }
                Err(_) => std::thread::sleep(Duration::from_millis(150)),
            }
        }
    });
    Ok(port)
}

/// Consulta se o navegador já voltou ao redirect (o JS chama em intervalos).
#[tauri::command]
pub fn oauth_result(state: tauri::State<OAuthState>, port: u16) -> R<Option<String>> {
    let mut m = state.0.lock().map_err(|e| e.to_string())?;
    let v = m.get(&port).cloned().flatten();
    if v.is_some() {
        m.remove(&port);
    }
    Ok(v)
}

// ------------------------------------------------------------ atualizações

#[derive(Clone, Serialize)]
struct Progress {
    received: u64,
    total: u64,
}

/// Baixa o instalador da release, confere o SHA-256 publicado e devolve o caminho.
#[tauri::command]
pub async fn update_download(app: AppHandle, url: String, sha256_url: String, file_name: String) -> R<String> {
    use tauri_plugin_http::reqwest;
    let client = reqwest::Client::builder()
        .user_agent("GCP-Notas-Updater")
        .build()
        .map_err(|e| e.to_string())?;

    let expected = client
        .get(&sha256_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let expected = expected.split_whitespace().next().unwrap_or("").to_lowercase();
    if expected.len() != 64 {
        return Err("checksum inválido".into());
    }

    let mut resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    let total = resp.content_length().unwrap_or(0);
    let safe_name: String = file_name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || "._-".contains(*c))
        .collect();
    let dir: PathBuf = std::env::temp_dir().join("gcp-notas-update");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(if safe_name.is_empty() { "update.bin".to_string() } else { safe_name });
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut last_emit = Instant::now();
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        if last_emit.elapsed() > Duration::from_millis(120) {
            let _ = app.emit("update-progress", Progress { received, total });
            last_emit = Instant::now();
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    let _ = app.emit("update-progress", Progress { received, total });
    let got = hex::encode(hasher.finalize());
    if got != expected {
        let _ = std::fs::remove_file(&path);
        return Err(format!("SHA-256 não confere (esperado {expected}, obtido {got})"));
    }
    Ok(path.to_string_lossy().to_string())
}

/// Instala o pacote baixado e encerra o aplicativo quando necessário.
#[tauri::command]
pub fn update_install(app: AppHandle, path: String, kind: String) -> R<()> {
    use std::process::Command;
    match std::env::consts::OS {
        "windows" => {
            Command::new(&path).spawn().map_err(|e| e.to_string())?;
            app.exit(0);
        }
        "macos" => {
            Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
        }
        _ => {
            let args: Vec<String> = match kind.as_str() {
                "deb" => vec!["apt-get".into(), "install".into(), "-y".into(), path.clone()],
                "rpm" => {
                    if Command::new("dnf").arg("--version").output().is_ok() {
                        vec!["dnf".into(), "install".into(), "-y".into(), path.clone()]
                    } else {
                        vec!["zypper".into(), "--non-interactive".into(), "install".into(), path.clone()]
                    }
                }
                "arch" => vec!["pacman".into(), "-U".into(), "--noconfirm".into(), path.clone()],
                _ => vec![],
            };
            let ok = !args.is_empty()
                && Command::new("pkexec")
                    .args(&args)
                    .status()
                    .map(|s| s.success())
                    .unwrap_or(false);
            if ok {
                let exe = std::env::current_exe().map_err(|e| e.to_string())?;
                let _ = Command::new(exe).spawn();
                app.exit(0);
            } else {
                // Sem pkexec: abre o pacote no instalador gráfico da distribuição.
                Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}
