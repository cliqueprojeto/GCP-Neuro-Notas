/**
 * Compartilhamento entre usuários: exporta páginas (com subpáginas e bases
 * usadas em relatórios) em um arquivo .gcpshare, opcionalmente protegido por
 * senha, que outra pessoa importa no próprio GCP-Neuro Notas.
 */
import { decryptBackup, encryptBackup, uid, type BackupFile } from './crypto';
import { APP_VERSION, pickTextFiles, saveTextFile } from './platform';
import type { Page } from './types';
import { useVault, livePages } from '../store/vault';

interface SharePayload {
  format: 'gcp-notas-share';
  version: 1;
  app: string;
  created: number;
  roots: string[];
  pages: Page[];
}

type ShareFile = SharePayload | (Omit<BackupFile, 'format'> & { format: 'gcp-notas-share-encrypted' });

export function collectForShare(ids: string[]): Page[] {
  const all = livePages(useVault.getState().pages);
  const out = new Map<string, Page>();
  const add = (id: string) => {
    const p = all.find((x) => x.id === id);
    if (!p || out.has(id)) return;
    out.set(id, p);
    for (const c of all.filter((x) => x.parentId === id)) add(c.id);
    // Relatórios levam junto as bases de dados que usam.
    p.report?.widgets.forEach((w) => add(w.source));
    p.canvas?.nodes.forEach((n) => n.pageId && n.pageId !== p.id && add(n.pageId));
  };
  ids.forEach(add);
  return [...out.values()];
}

export async function exportShare(ids: string[], password: string | null): Promise<string | null> {
  const pages = collectForShare(ids);
  const payload: SharePayload = { format: 'gcp-notas-share', version: 1, app: APP_VERSION, created: Date.now(), roots: ids, pages };
  let file: ShareFile = payload;
  if (password) {
    const enc = await encryptBackup(payload, password, APP_VERSION);
    file = { ...enc, format: 'gcp-notas-share-encrypted' };
  }
  const root = pages.find((p) => p.id === ids[0]);
  const name = (root?.title || 'GCP-Notas').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);
  return saveTextFile(`${name}.gcpshare`, JSON.stringify(file), [{ name: 'GCP-Neuro Notas', extensions: ['gcpshare'] }]);
}

export async function pickShareFile(): Promise<ShareFile | null> {
  const files = await pickTextFiles([{ name: 'GCP-Neuro Notas', extensions: ['gcpshare', 'json'] }]);
  if (!files.length) return null;
  const data = JSON.parse(files[0].text);
  if (data.format !== 'gcp-notas-share' && data.format !== 'gcp-notas-share-encrypted') throw new Error('invalid-format');
  return data;
}

export function shareNeedsPassword(f: ShareFile) {
  return f.format === 'gcp-notas-share-encrypted';
}

export function sharePreview(f: SharePayload) {
  return { count: f.pages.length, roots: f.pages.filter((p) => f.roots.includes(p.id)) };
}

export async function openShare(f: ShareFile, password?: string): Promise<SharePayload> {
  if (f.format === 'gcp-notas-share') return f;
  return decryptBackup<SharePayload>({ ...(f as any), format: 'gcp-notas-backup' }, password || '');
}

/** Importa como cópias novas (novos IDs), mantendo links internos. */
export function importShare(payload: SharePayload, parentId: string | null): Page[] {
  const map = new Map(payload.pages.map((p) => [p.id, uid('p')]));
  const remap = (id?: string | null) => (id && map.get(id)) || id || null;
  const fixDoc = (n: any): any => {
    if (!n || typeof n !== 'object') return n;
    if (n.type === 'pageLink' && n.attrs?.id) return { ...n, attrs: { ...n.attrs, id: remap(n.attrs.id) } };
    return n.content ? { ...n, content: n.content.map(fixDoc) } : n;
  };
  const v = useVault.getState();
  const now = Date.now();
  const created: Page[] = [];
  for (const p of payload.pages) {
    const isRoot = payload.roots.includes(p.id) || !p.parentId || !map.has(p.parentId);
    const copy: Page = {
      ...structuredClone(p),
      id: map.get(p.id)!,
      parentId: isRoot ? parentId : remap(p.parentId),
      favorite: false,
      content: fixDoc(p.content),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      order: 0,
    };
    if (copy.report) copy.report = { ...copy.report, widgets: copy.report.widgets.map((w) => ({ ...w, source: remap(w.source) || w.source })) };
    if (copy.canvas) copy.canvas = { ...copy.canvas, nodes: copy.canvas.nodes.map((n) => (n.pageId ? { ...n, pageId: remap(n.pageId) || n.pageId } : n)) };
    created.push(v.createPage(copy));
  }
  return created;
}
