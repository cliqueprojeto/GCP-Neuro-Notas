//! Banco de dados interno (SQLite embutido).
//!
//! O conteúdo das notas chega aqui já criptografado pela camada de cofre
//! (XChaCha20-Poly1305 + Argon2id). O Rust só guarda blobs opacos: nunca vê
//! texto em claro, títulos ou senhas.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Record {
    pub id: String,
    pub kind: String,
    pub data: String,
    pub updated: i64,
}

impl Db {
    pub fn open(path: PathBuf) -> Result<Self, String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=NORMAL;
             PRAGMA foreign_keys=ON;
             CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                data TEXT NOT NULL,
                updated INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_records_kind ON records(kind);",
        )
        .map_err(|e| e.to_string())?;
        Ok(Db(Mutex::new(conn)))
    }
}

type R<T> = Result<T, String>;

#[tauri::command]
pub fn db_list(db: tauri::State<Db>, kind: Option<String>) -> R<Vec<Record>> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let map = |row: &rusqlite::Row| -> rusqlite::Result<Record> {
        Ok(Record { id: row.get(0)?, kind: row.get(1)?, data: row.get(2)?, updated: row.get(3)? })
    };
    let out: Vec<Record> = match kind {
        Some(k) => {
            let mut st = conn
                .prepare("SELECT id, kind, data, updated FROM records WHERE kind = ?1")
                .map_err(|e| e.to_string())?;
            let rows = st.query_map(params![k], map).map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        }
        None => {
            let mut st = conn
                .prepare("SELECT id, kind, data, updated FROM records")
                .map_err(|e| e.to_string())?;
            let rows = st.query_map([], map).map_err(|e| e.to_string())?;
            rows.filter_map(|r| r.ok()).collect()
        }
    };
    Ok(out)
}

#[tauri::command]
pub fn db_get(db: tauri::State<Db>, id: String) -> R<Option<Record>> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut st = conn
        .prepare("SELECT id, kind, data, updated FROM records WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = st
        .query_map(params![id], |row| {
            Ok(Record { id: row.get(0)?, kind: row.get(1)?, data: row.get(2)?, updated: row.get(3)? })
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.next().and_then(|r| r.ok()))
}

#[tauri::command]
pub fn db_put(db: tauri::State<Db>, records: Vec<Record>) -> R<()> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut st = tx
            .prepare(
                "INSERT INTO records (id, kind, data, updated) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, data=excluded.data, updated=excluded.updated",
            )
            .map_err(|e| e.to_string())?;
        for r in &records {
            st.execute(params![r.id, r.kind, r.data, r.updated]).map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_delete(db: tauri::State<Db>, ids: Vec<String>) -> R<()> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for id in &ids {
        tx.execute("DELETE FROM records WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_clear(db: tauri::State<Db>) -> R<()> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM records", []).map_err(|e| e.to_string())?;
    conn.execute_batch("VACUUM;").map_err(|e| e.to_string())?;
    Ok(())
}
