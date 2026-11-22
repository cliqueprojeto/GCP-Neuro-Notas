//! Player do YouTube incorporado.
//! O YouTube recusa vídeos incorporados sem cabeçalho Referer (erro 153). O app roda em
//! `tauri://localhost`, que não envia Referer; por isso servimos, só em 127.0.0.1 e numa porta
//! aleatória, uma página mínima que contém o player oficial. Nada além desta página é servido.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU16, Ordering};
use std::time::Duration;

static PORT: AtomicU16 = AtomicU16::new(0);

pub fn start() {
    std::thread::spawn(|| {
        let Ok(listener) = TcpListener::bind("127.0.0.1:0") else { return };
        if let Ok(addr) = listener.local_addr() {
            PORT.store(addr.port(), Ordering::SeqCst);
        }
        for stream in listener.incoming().flatten() {
            std::thread::spawn(move || handle(stream));
        }
    });
}

fn valid_id(id: &str) -> bool {
    id.len() == 11 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn handle(mut s: TcpStream) {
    let _ = s.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = [0u8; 2048];
    let n = s.read(&mut buf).unwrap_or(0);
    let req = String::from_utf8_lossy(&buf[..n]);
    let path = req.lines().next().and_then(|l| l.split_whitespace().nth(1)).unwrap_or("/");
    // formato: /yt/<id>?start=<segundos>&autoplay=1
    let (route, query) = path.split_once('?').unwrap_or((path, ""));
    let id = route.strip_prefix("/yt/").unwrap_or("");
    if !valid_id(id) {
        let _ = s.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        return;
    }
    let mut start = 0u32;
    let mut autoplay = false;
    for kv in query.split('&') {
        match kv.split_once('=') {
            Some(("start", v)) => start = v.parse().unwrap_or(0),
            Some(("autoplay", "1")) => autoplay = true,
            _ => {}
        }
    }
    let body = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"referrer\" content=\"strict-origin-when-cross-origin\">\
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>YouTube</title>\
<style>html,body{{margin:0;height:100%;background:#000;overflow:hidden}}iframe{{border:0;width:100%;height:100%;display:block}}</style></head>\
<body><iframe src=\"https://www.youtube-nocookie.com/embed/{id}?rel=0&modestbranding=1&playsinline=1{start}{auto}\" \
title=\"YouTube\" referrerpolicy=\"strict-origin-when-cross-origin\" \
allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share\" allowfullscreen></iframe></body></html>",
        id = id,
        start = if start > 0 { format!("&start={start}") } else { String::new() },
        auto = if autoplay { "&autoplay=1" } else { "" },
    );
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\n\
Referrer-Policy: strict-origin-when-cross-origin\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = s.write_all(head.as_bytes());
    let _ = s.write_all(body.as_bytes());
}

/// Porta do player local (0 = indisponível).
#[tauri::command]
pub fn player_port() -> u16 {
    PORT.load(Ordering::SeqCst)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get(path: &str) -> String {
        for _ in 0..50 {
            if PORT.load(Ordering::SeqCst) != 0 { break; }
            std::thread::sleep(Duration::from_millis(20));
        }
        let mut s = TcpStream::connect(("127.0.0.1", PORT.load(Ordering::SeqCst))).unwrap();
        write!(s, "GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        out
    }

    #[test]
    fn serves_only_valid_players() {
        start();
        let ok = get("/yt/dQw4w9WgXcQ?autoplay=1&start=42");
        assert!(ok.starts_with("HTTP/1.1 200"));
        assert!(ok.contains("youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1&start=42&autoplay=1"));
        assert!(ok.contains("strict-origin-when-cross-origin"));
        assert!(get("/yt/../../etc/passwd").starts_with("HTTP/1.1 404"));
        assert!(get("/yt/abc\"><script>").starts_with("HTTP/1.1 404"));
        assert!(get("/").starts_with("HTTP/1.1 404"));
    }
}
