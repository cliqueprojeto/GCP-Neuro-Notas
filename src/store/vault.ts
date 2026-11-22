import { create } from 'zustand';
import {
  createHeader,
  generateRecoveryCode,
  open,
  randomBytes,
  rewrapPassword,
  rewrapRecovery,
  seal,
  uid,
  unwrapWithPassword,
  unwrapWithRecovery,
  type VaultHeader,
} from '../lib/crypto';
import { storage, type DbRecord } from '../lib/platform';
import { DEFAULT_SETTINGS, type Page, type PageType, type Snapshot, type VaultSettings } from '../lib/types';

export type VaultStatus = 'loading' | 'new' | 'locked' | 'unlocked';

const HEADER_ID = 'meta:header';
const SETTINGS_ID = 'settings';

interface VaultState {
  status: VaultStatus;
  header: VaultHeader | null;
  key: Uint8Array | null;
  pages: Record<string, Page>;
  settings: VaultSettings;
  failedAttempts: number;
  lockedUntil: number;
  saving: boolean;
  lastSaved: number;

  init(): Promise<void>;
  createVault(password: string, hint: string): Promise<string>;
  unlock(password: string): Promise<boolean>;
  unlockWithRecovery(code: string, newPassword: string): Promise<boolean>;
  lock(): void;
  changePassword(current: string, next: string): Promise<boolean>;
  regenerateRecovery(): Promise<string>;
  verifyPassword(password: string): Promise<boolean>;

  createPage(p: Partial<Page> & { type?: PageType }): Page;
  updatePage(id: string, patch: Partial<Page>): void;
  movePage(id: string, parentId: string | null, beforeId?: string | null): void;
  trashPage(id: string): void;
  restorePage(id: string): void;
  purgePage(id: string): void;
  emptyTrash(): void;
  duplicatePage(id: string): Page | null;
  updateSettings(fn: (s: VaultSettings) => VaultSettings): void;

  snapshots(pageId: string): Promise<Snapshot[]>;
  flush(): Promise<void>;
  exportPlain(): { pages: Page[]; settings: VaultSettings };
  importPages(pages: Page[], mode: 'merge' | 'replace'): Promise<void>;
  adoptVault(header: VaultHeader, records: DbRecord[], password: string): Promise<boolean>;
  rawRecords(): Promise<DbRecord[]>;
  mergeRawRecords(records: DbRecord[]): Promise<number>;
}

// --------------------------------------------------- gravação com atraso

const dirty = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const lastSnapshot: Record<string, number> = {};

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void useVault.getState().flush(), 600);
}

function markDirty(id: string) {
  dirty.add(id);
  scheduleFlush();
}

function nextOrder(pages: Record<string, Page>, parentId: string | null) {
  let max = 0;
  for (const p of Object.values(pages)) if (p.parentId === parentId && !p.deletedAt && p.order > max) max = p.order;
  return max + 1;
}

function descendants(pages: Record<string, Page>, id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const p of Object.values(pages)) {
      if (p.parentId === pid && !p.purged) {
        out.push(p.id);
        walk(p.id);
      }
    }
  };
  walk(id);
  return out;
}

async function loadAll(key: Uint8Array) {
  const recs = await storage.list();
  const pages: Record<string, Page> = {};
  let settings: VaultSettings = structuredClone(DEFAULT_SETTINGS);
  for (const r of recs) {
    try {
      if (r.kind === 'page') {
        const p = open<Page>(key, r.data);
        pages[p.id] = p;
      } else if (r.kind === 'settings') {
        const s = open<Partial<VaultSettings>>(key, r.data);
        settings = deepMerge(settings, s);
      }
    } catch (e) {
      console.warn('registro ilegível', r.id, e);
    }
  }
  return { pages, settings };
}

function deepMerge<T>(base: T, over: any): T {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return (over ?? base) as T;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const k of Object.keys(over)) {
    const b = (base as any)?.[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? deepMerge(b, over[k]) : over[k];
  }
  return out;
}

export const useVault = create<VaultState>((set, get) => ({
  status: 'loading',
  header: null,
  key: null,
  pages: {},
  settings: structuredClone(DEFAULT_SETTINGS),
  failedAttempts: 0,
  lockedUntil: 0,
  saving: false,
  lastSaved: 0,

  async init() {
    const rec = await storage.get(HEADER_ID);
    if (!rec) return set({ status: 'new' });
    set({ header: JSON.parse(rec.data), status: 'locked' });
  },

  async createVault(password, hint) {
    const dataKey = randomBytes(32);
    const recovery = generateRecoveryCode();
    const header = await createHeader(password, dataKey, recovery, hint);
    await storage.put([{ id: HEADER_ID, kind: 'meta', data: JSON.stringify(header), updated: header.updated }]);
    const settings = structuredClone(DEFAULT_SETTINGS);
    await storage.put([{ id: SETTINGS_ID, kind: 'settings', data: seal(dataKey, settings), updated: Date.now() }]);
    set({ header, key: dataKey, pages: {}, settings, status: 'unlocked' });
    return recovery;
  },

  async unlock(password) {
    const { header, lockedUntil } = get();
    if (!header || Date.now() < lockedUntil) return false;
    try {
      const key = await unwrapWithPassword(header, password);
      const { pages, settings } = await loadAll(key);
      set({ key, pages, settings, status: 'unlocked', failedAttempts: 0, lockedUntil: 0 });
      return true;
    } catch {
      const n = get().failedAttempts + 1;
      // Atraso crescente após tentativas erradas (proteção contra força bruta).
      const wait = n >= 3 ? Math.min(2 ** (n - 3) * 5000, 5 * 60_000) : 0;
      set({ failedAttempts: n, lockedUntil: Date.now() + wait });
      return false;
    }
  },

  async unlockWithRecovery(code, newPassword) {
    const { header } = get();
    if (!header) return false;
    try {
      const key = await unwrapWithRecovery(header, code);
      const nh = await rewrapPassword(header, key, newPassword);
      await storage.put([{ id: HEADER_ID, kind: 'meta', data: JSON.stringify(nh), updated: nh.updated }]);
      const { pages, settings } = await loadAll(key);
      set({ header: nh, key, pages, settings, status: 'unlocked', failedAttempts: 0, lockedUntil: 0 });
      return true;
    } catch {
      return false;
    }
  },

  lock() {
    void get().flush();
    const k = get().key;
    if (k) k.fill(0);
    set({ key: null, pages: {}, settings: structuredClone(DEFAULT_SETTINGS), status: get().header ? 'locked' : 'new' });
  },

  async verifyPassword(password) {
    const { header } = get();
    if (!header) return false;
    try {
      await unwrapWithPassword(header, password);
      return true;
    } catch {
      return false;
    }
  },

  async changePassword(current, next) {
    const { header, key } = get();
    if (!header || !key) return false;
    if (!(await get().verifyPassword(current))) return false;
    const nh = await rewrapPassword(header, key, next);
    await storage.put([{ id: HEADER_ID, kind: 'meta', data: JSON.stringify(nh), updated: nh.updated }]);
    set({ header: nh });
    return true;
  },

  async regenerateRecovery() {
    const { header, key } = get();
    if (!header || !key) throw new Error('locked');
    const code = generateRecoveryCode();
    const nh = await rewrapRecovery(header, key, code);
    await storage.put([{ id: HEADER_ID, kind: 'meta', data: JSON.stringify(nh), updated: nh.updated }]);
    set({ header: nh });
    return code;
  },

  createPage(p) {
    const now = Date.now();
    const pages = get().pages;
    const page: Page = {
      id: uid('p'),
      type: 'page',
      title: '',
      icon: p.type === 'database' ? '🗂️' : p.type === 'report' ? '📊' : p.type === 'canvas' ? '🎨' : '📄',
      cover: null,
      parentId: null,
      favorite: false,
      tags: [],
      content: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      order: 0,
      ...p,
    } as Page;
    if (!page.id) page.id = uid('p');
    if (!p.order) page.order = nextOrder(pages, page.parentId);
    if (page.type === 'database' && !page.db) {
      const titleId = uid('c');
      const viewId = uid('v');
      page.db = {
        properties: [
          { id: titleId, name: 'Nome', type: 'title' },
          { id: uid('c'), name: 'Tags', type: 'multi', options: [] },
        ],
        rows: [],
        views: [{ id: viewId, name: 'Tabela', type: 'table', filters: [] }],
        activeView: viewId,
      };
    }
    if (page.type === 'report' && !page.report) page.report = { widgets: [], palette: 'gcp' };
    if (page.type === 'canvas' && !page.canvas) page.canvas = { nodes: [], edges: [], view: { x: 0, y: 0, zoom: 1 } };
    set({ pages: { ...pages, [page.id]: page } });
    markDirty(page.id);
    return page;
  },

  updatePage(id, patch) {
    const pages = get().pages;
    const cur = pages[id];
    if (!cur) return;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    set({ pages: { ...pages, [id]: next } });
    markDirty(id);
  },

  movePage(id, parentId, beforeId) {
    const pages = { ...get().pages };
    if (parentId && (parentId === id || descendants(pages, id).includes(parentId))) return;
    const siblings = Object.values(pages)
      .filter((p) => p.parentId === parentId && p.id !== id && !p.deletedAt)
      .sort((a, b) => a.order - b.order);
    const idx = beforeId ? siblings.findIndex((s) => s.id === beforeId) : -1;
    const moving = pages[id];
    if (idx >= 0) siblings.splice(idx, 0, moving);
    else siblings.push(moving);
    siblings.forEach((s, i) => {
      const order = i + 1;
      if (s.id === id) pages[s.id] = { ...s, parentId, order, updatedAt: Date.now() };
      else if (s.order !== order) pages[s.id] = { ...s, order, updatedAt: Date.now() };
      else return;
      dirty.add(s.id);
    });
    set({ pages });
    scheduleFlush();
  },

  trashPage(id) {
    const pages = { ...get().pages };
    const now = Date.now();
    for (const pid of [id, ...descendants(pages, id)]) {
      if (!pages[pid].deletedAt) {
        pages[pid] = { ...pages[pid], deletedAt: now, updatedAt: now };
        dirty.add(pid);
      }
    }
    set({ pages });
    scheduleFlush();
  },

  restorePage(id) {
    const pages = { ...get().pages };
    const now = Date.now();
    const ids = [id, ...descendants(pages, id)];
    for (const pid of ids) {
      pages[pid] = { ...pages[pid], deletedAt: null, updatedAt: now };
      dirty.add(pid);
    }
    const p = pages[id];
    if (p.parentId && (!pages[p.parentId] || pages[p.parentId].deletedAt)) pages[id] = { ...pages[id], parentId: null };
    set({ pages });
    scheduleFlush();
  },

  purgePage(id) {
    const pages = { ...get().pages };
    const now = Date.now();
    for (const pid of [id, ...descendants(pages, id)]) {
      // Registro "lápide": mantém só o id para que a sincronização apague nos outros aparelhos.
      pages[pid] = {
        id: pid, type: 'page', title: '', icon: '', cover: null, parentId: null, order: 0, favorite: false,
        tags: [], content: null, createdAt: 0, updatedAt: now, deletedAt: now, purged: true,
      };
      dirty.add(pid);
    }
    set({ pages });
    scheduleFlush();
  },

  emptyTrash() {
    for (const p of Object.values(get().pages)) if (p.deletedAt && !p.purged) get().purgePage(p.id);
  },

  duplicatePage(id) {
    const src = get().pages[id];
    if (!src) return null;
    const copy = get().createPage({
      ...structuredClone(src),
      id: undefined as any,
      title: src.title + ' (cópia)',
      order: src.order + 0.5,
      favorite: false,
    });
    return copy;
  },

  updateSettings(fn) {
    set({ settings: fn(structuredClone(get().settings)) });
    markDirty(SETTINGS_ID);
  },

  async snapshots(pageId) {
    const key = get().key;
    if (!key) return [];
    const recs = await storage.list('snap');
    const out: Snapshot[] = [];
    for (const r of recs) {
      if (!r.id.startsWith(`snap:${pageId}:`)) continue;
      try {
        out.push(open<Snapshot>(key, r.data));
      } catch {
        /* ignora */
      }
    }
    return out.sort((a, b) => b.at - a.at);
  },

  async flush() {
    const { key, pages, settings } = get();
    if (!key || !dirty.size) return;
    const ids = [...dirty];
    dirty.clear();
    const recs: DbRecord[] = [];
    const now = Date.now();
    for (const id of ids) {
      if (id === SETTINGS_ID) {
        recs.push({ id: SETTINGS_ID, kind: 'settings', data: seal(key, settings), updated: now });
        continue;
      }
      const p = pages[id];
      if (!p) continue;
      recs.push({ id: 'page:' + id, kind: 'page', data: seal(key, p), updated: p.updatedAt });
      // Histórico de versões: no máximo uma cópia a cada 10 minutos por página.
      if (settings.snapshots.enabled && !p.purged && !p.deletedAt && now - (lastSnapshot[id] ?? 0) > 10 * 60_000 && p.type !== 'report') {
        lastSnapshot[id] = now;
        const snap: Snapshot = { id: uid('s'), pageId: id, at: now, title: p.title, content: p.content, db: p.db };
        recs.push({ id: `snap:${id}:${now}`, kind: 'snap', data: seal(key, snap), updated: now });
      }
    }
    set({ saving: true });
    try {
      await storage.put(recs);
      if (recs.some((r) => r.kind === 'snap')) void pruneSnapshots(settings.snapshots.keep);
      set({ lastSaved: Date.now() });
    } finally {
      set({ saving: false });
    }
  },

  exportPlain() {
    const { pages, settings } = get();
    const clean = structuredClone(settings);
    clean.cloud.accounts = []; // tokens de acesso não vão para arquivos exportados
    return { pages: Object.values(pages).filter((p) => !p.purged), settings: clean };
  },

  async importPages(list, mode) {
    const key = get().key;
    if (!key) return;
    let pages = { ...get().pages };
    if (mode === 'replace') {
      for (const id of Object.keys(pages)) {
        pages[id] = { ...pages[id], purged: true, deletedAt: Date.now(), updatedAt: Date.now(), content: null, db: undefined, report: undefined };
        dirty.add(id);
      }
    }
    for (const p of list) {
      const existing = pages[p.id];
      if (mode === 'merge' && existing && !existing.purged && existing.updatedAt >= p.updatedAt) continue;
      pages[p.id] = { ...p, updatedAt: Math.max(p.updatedAt, Date.now() - 1) };
      dirty.add(p.id);
    }
    set({ pages });
    await get().flush();
  },

  async rawRecords() {
    await get().flush();
    const recs = await storage.list();
    return recs.filter((r) => r.kind === 'page' || r.kind === 'settings');
  },

  /** Junta registros cifrados vindos da nuvem (mesma chave). O mais recente vence. */
  async mergeRawRecords(remote) {
    const key = get().key;
    if (!key) return 0;
    await get().flush();
    const local = new Map((await storage.list()).map((r) => [r.id, r]));
    const toWrite: DbRecord[] = [];
    for (const r of remote) {
      if (r.kind !== 'page') continue;
      const l = local.get(r.id);
      if (!l || r.updated > l.updated) toWrite.push(r);
    }
    if (toWrite.length) {
      await storage.put(toWrite);
      const pages = { ...get().pages };
      for (const r of toWrite) {
        try {
          const p = open<Page>(key, r.data);
          pages[p.id] = p;
        } catch {
          /* chave diferente */
        }
      }
      set({ pages });
    }
    return toWrite.length;
  },

  /** Restaura um cofre inteiro (por exemplo, vindo da nuvem em um aparelho novo). */
  async adoptVault(header, records, password) {
    try {
      const key = await unwrapWithPassword(header, password);
      await storage.clear();
      await storage.put([{ id: HEADER_ID, kind: 'meta', data: JSON.stringify(header), updated: header.updated }, ...records]);
      const { pages, settings } = await loadAll(key);
      set({ header, key, pages, settings, status: 'unlocked', failedAttempts: 0 });
      return true;
    } catch {
      return false;
    }
  },
}));

async function pruneSnapshots(keep: number) {
  const recs = await storage.list('snap');
  const byPage = new Map<string, DbRecord[]>();
  for (const r of recs) {
    const pid = r.id.split(':')[1];
    byPage.set(pid, [...(byPage.get(pid) || []), r]);
  }
  const del: string[] = [];
  for (const list of byPage.values()) {
    list.sort((a, b) => b.updated - a.updated);
    del.push(...list.slice(keep).map((r) => r.id));
  }
  await storage.remove(del);
}

// ------------------------------------------------------------- seletores

export function livePages(pages: Record<string, Page>): Page[] {
  return Object.values(pages).filter((p) => !p.deletedAt && !p.purged);
}

export function childrenOf(pages: Record<string, Page>, parentId: string | null): Page[] {
  return livePages(pages)
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

export function breadcrumb(pages: Record<string, Page>, id: string): Page[] {
  const out: Page[] = [];
  let cur: Page | undefined = pages[id];
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId ? pages[cur.parentId] : undefined;
  }
  return out;
}

window.addEventListener('beforeunload', () => {
  void useVault.getState().flush();
});

/**
 * Apaga TUDO neste aparelho (banco de dados interno, configurações e preferências)
 * e reinicia o app como numa instalação nova. Cópias na nuvem e arquivos de backup
 * já exportados não são tocados.
 */
export async function wipeEverything(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  dirty.clear();
  useVault.setState({ key: null, pages: {}, status: 'loading' });
  await storage.clear();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('gcp')) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch {
    /* armazenamento do navegador indisponível */
  }
  location.reload();
}
