/**
 * Ponte com o sistema. No aplicativo instalado usa o núcleo nativo (Tauri);
 * no navegador (modo demonstração/desenvolvimento) usa IndexedDB e APIs web.
 */
import { invoke } from '@tauri-apps/api/core';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
/** Celular/tablet (Android ou iOS), no app nativo ou no navegador. */
export const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
/** App instalado em computador (onde existe o atualizador interno). */
export const isDesktop = isTauri && !isMobile;

export interface DbRecord {
  id: string;
  kind: string;
  data: string;
  updated: number;
}

export interface Storage {
  list(kind?: string): Promise<DbRecord[]>;
  get(id: string): Promise<DbRecord | null>;
  put(records: DbRecord[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}

class NativeStorage implements Storage {
  list(kind?: string) {
    return invoke<DbRecord[]>('db_list', { kind: kind ?? null });
  }
  get(id: string) {
    return invoke<DbRecord | null>('db_get', { id });
  }
  put(records: DbRecord[]) {
    if (!records.length) return Promise.resolve();
    return invoke<void>('db_put', { records });
  }
  remove(ids: string[]) {
    if (!ids.length) return Promise.resolve();
    return invoke<void>('db_delete', { ids });
  }
  clear() {
    return invoke<void>('db_clear');
  }
}

class WebStorage implements Storage {
  private _dbp: Promise<IDBDatabase> | null = null;
  constructor(private name = 'gcp-notas') {}
  private get dbp(): Promise<IDBDatabase> {
    const name = this.name;
    return (this._dbp ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('records')) {
          const st = db.createObjectStore('records', { keyPath: 'id' });
          st.createIndex('kind', 'kind');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }
  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
    const db = await this.dbp;
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction('records', mode);
      const st = t.objectStore('records');
      const r = fn(st);
      t.oncomplete = () => resolve((r ? (r as IDBRequest).result : undefined) as T);
      t.onerror = () => reject(t.error);
    });
  }
  async list(kind?: string) {
    const all = await this.tx<DbRecord[]>('readonly', (s) => s.getAll());
    return kind ? all.filter((r) => r.kind === kind) : all;
  }
  async get(id: string) {
    return (await this.tx<DbRecord | undefined>('readonly', (s) => s.get(id))) ?? null;
  }
  put(records: DbRecord[]) {
    return this.tx<void>('readwrite', (s) => {
      records.forEach((r) => s.put(r));
    });
  }
  remove(ids: string[]) {
    return this.tx<void>('readwrite', (s) => {
      ids.forEach((id) => s.delete(id));
    });
  }
  clear() {
    return this.tx<void>('readwrite', (s) => s.clear());
  }
}

export const storage: Storage = isTauri ? new NativeStorage() : new WebStorage();

// ------------------------------------------------------------------ rede

/** fetch sem bloqueio de CORS no app (via núcleo nativo); fetch comum no navegador. */
export async function netFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauri) {
    const { fetch: tfetch } = await import('@tauri-apps/plugin-http');
    return tfetch(input, init);
  }
  return fetch(input, init);
}

export async function openUrl(url: string) {
  if (isTauri) {
    const { openUrl: o } = await import('@tauri-apps/plugin-opener');
    await o(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export async function revealPath(path: string) {
  if (isTauri) {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
    await revealItemInDir(path);
  }
}

// --------------------------------------------------------------- arquivos

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** Salva texto em arquivo escolhido pelo usuário. Retorna o caminho (ou nome). */
export async function saveTextFile(defaultName: string, contents: string, filters: FileFilter[]): Promise<string | null> {
  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: defaultName, filters });
    if (!path) return null;
    if (isMobile) {
      // No Android o caminho escolhido é um content:// — gravado pelo plugin de arquivos.
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(path, contents);
    } else await invoke('write_text_file', { path, contents });
    return path;
  }
  const blob = new Blob([contents], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return defaultName;
}

export async function saveBinaryFile(defaultName: string, base64: string, filters: FileFilter[]): Promise<string | null> {
  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: defaultName, filters });
    if (!path) return null;
    if (isMobile) {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await writeFile(path, bytes);
    } else await invoke('write_binary_file', { path, base64Data: base64 });
    return path;
  }
  const a = document.createElement('a');
  a.href = 'data:application/octet-stream;base64,' + base64;
  a.download = defaultName;
  a.click();
  return defaultName;
}

export interface PickedFile {
  name: string;
  text: string;
}

/** Abre um ou mais arquivos de texto. */
export async function pickTextFiles(filters: FileFilter[], multiple = false): Promise<PickedFile[]> {
  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const sel = await open({ multiple, filters });
    if (!sel) return [];
    const paths = Array.isArray(sel) ? sel : [sel];
    const out: PickedFile[] = [];
    const fs = isMobile ? await import('@tauri-apps/plugin-fs') : null;
    for (const p of paths) {
      const text = fs ? await fs.readTextFile(p) : await invoke<string>('read_text_file', { path: p });
      out.push({ name: p.split(/[\\/]/).pop() || p, text });
    }
    return out;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = filters.flatMap((f) => f.extensions.map((e) => '.' + e)).join(',');
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      resolve(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))));
    };
    input.click();
  });
}

/** Escolhe imagens e devolve data URLs já redimensionadas. */
export function pickImages(multiple = true, maxSize = 1600): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = 'image/*';
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      resolve(await Promise.all(files.map((f) => fileToDataUrl(f, maxSize))));
    };
    input.click();
  });
}

export function fileToDataUrl(file: File, maxSize = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = reader.result as string;
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') return resolve(src);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 400_000) return resolve(src);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

// --------------------------------------------------------------- sistema

export interface PlatformInfo {
  os: string;
  arch: string;
  package: string;
  version: string;
  data_dir: string;
}

export const APP_VERSION = __APP_VERSION__;

export async function platformInfo(): Promise<PlatformInfo> {
  if (isTauri) return invoke<PlatformInfo>('platform_info');
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'android' : /iPhone|iPad/.test(ua) ? 'ios' : /Windows/.test(ua) ? 'windows' : /Mac/.test(ua) ? 'macos' : 'linux';
  return { os, arch: 'x86_64', package: '', version: APP_VERSION, data_dir: 'IndexedDB' };
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  return Promise.resolve();
}

export interface PickedBinary {
  name: string;
  bytes: Uint8Array;
}

/** Abre um arquivo binário (planilhas, JSON etc.) pelo seletor do sistema. */
export function pickBinaryFile(accept: string): Promise<PickedBinary | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      resolve({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    };
    input.click();
  });
}
