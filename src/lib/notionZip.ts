/**
 * Importa a exportação do Notion em .zip ("Exportar" → HTML ou Markdown e CSV, com subpáginas).
 * Mantém a árvore de páginas, as bases de dados com colunas e tipos, imagens, arquivos,
 * capas, ícones, listas de tarefas, destaques, toggles, colunas e os links entre páginas.
 */
import { unzipSync, strFromU8 } from 'fflate';
import { marked } from 'marked';
import { useVault } from '../store/vault';
import { uid } from './crypto';
import { htmlToDoc } from './transfer';
import { makeProperty, newOption, recompute } from '../database/logic';
import type { DatabaseData, Page, Property, PropType, Row } from './types';

type Files = Map<string, Uint8Array>;
export interface ZipResult { pages: number; databases: number; files: number }

const NOTION_ID = /\s+[0-9a-f]{16,32}$/i;
const HL: Record<string, string> = { gray: '#94a3b8', brown: '#a16207', orange: '#f97316', yellow: '#eab308', teal: '#14b8a6', green: '#22c55e', blue: '#3b82f6', purple: '#8b5cf6', pink: '#ec4899', red: '#ef4444' };
const HL_BG: Record<string, string> = { gray: '#e2e8f0', brown: '#fed7aa', orange: '#fed7aa', yellow: '#fde68a', teal: '#99f6e4', green: '#bbf7d0', blue: '#bfdbfe', purple: '#ddd6fe', pink: '#fbcfe8', red: '#fecaca' };
const OPT_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'red'];
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', pdf: 'application/pdf', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip: 'application/zip' };

const ext = (p: string) => (p.match(/\.([^./]+)$/)?.[1] || '').toLowerCase();
const stripExt = (p: string) => p.replace(/\.[^./]+$/, '');
const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const baseName = (p: string) => p.split('/').pop() || p;
const cleanTitle = (name: string) => stripExt(baseName(name)).replace(NOTION_ID, '').replace(/_all$/, '').trim() || 'Sem título';
const norm = (p: string) => p.normalize('NFC');

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Abre o .zip (e os .zip dentro dele, como "Part-1.zip" de exportações grandes). */
export function readZip(data: Uint8Array, prefix = '', out: Files = new Map(), depth = 0): Files {
  const all = unzipSync(data);
  for (const [name, bytes] of Object.entries(all)) {
    if (name.endsWith('/') || name.startsWith('__MACOSX/') || baseName(name).startsWith('.')) continue;
    if (ext(name) === 'zip' && depth < 3) readZip(bytes, prefix, out, depth + 1);
    else out.set(norm(prefix + name), bytes);
  }
  return out;
}

function resolve(from: string, href: string): string {
  let h = href.split('#')[0].split('?')[0];
  try { h = decodeURIComponent(h); } catch { /* mantém */ }
  const parts = (dirOf(from) ? dirOf(from).split('/') : []);
  for (const seg of norm(h).split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

const isExternal = (href: string) => /^(https?:|mailto:|tel:|data:|#)/i.test(href);

// ------------------------------------------------------------ tipos e valores

const TYPE_BY_ICON: [RegExp, PropType][] = [
  [/typesTitle/i, 'title'], [/typesNumber/i, 'number'], [/typesMultipleSelect|typesMultiSelect/i, 'multi'], [/typesStatus/i, 'status'],
  [/typesSelect/i, 'select'], [/typesDate|typesCreatedAt|typesLastEdited|typesCreatedTime|typesLastEditedTime/i, 'date'], [/typesCheckbox/i, 'checkbox'],
  [/typesUrl/i, 'url'], [/typesEmail/i, 'email'], [/typesPhone/i, 'phone'],
];

function parseDate(s: string): string {
  const t = s.replace(/^@/, '').split('→')[0].trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const d = Date.parse(t.replace(/\s+\d{1,2}:\d{2}\s*(AM|PM)?.*$/i, ''));
  return Number.isNaN(d) ? '' : new Date(d - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function optionFor(p: Property, label: string, color?: string) {
  p.options ||= [];
  let o = p.options.find((x) => x.label === label);
  if (!o) {
    o = newOption(label, p.options);
    if (color && OPT_COLORS.includes(color)) o.color = color;
    p.options.push(o);
  }
  return o.id;
}

function setCell(p: Property, raw: string, tags?: { label: string; color?: string }[], checked?: boolean): any {
  const v = raw.trim();
  switch (p.type) {
    case 'title': case 'text': case 'url': case 'email': case 'phone': return v;
    case 'number': {
      const n = Number(v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      return v && !Number.isNaN(n) ? n : '';
    }
    case 'checkbox': return checked ?? /^(yes|sim|sí|true|✓|☑|x)$/i.test(v);
    case 'date': return parseDate(v);
    case 'select': case 'status': {
      const label = tags?.[0]?.label ?? v;
      return label ? optionFor(p, label, tags?.[0]?.color) : '';
    }
    case 'multi': {
      const list = tags?.length ? tags : v.split(/\s*,\s*/).filter(Boolean).map((label) => ({ label, color: undefined }));
      return list.map((tg) => optionFor(p, tg.label, tg.color));
    }
    default: return v;
  }
}

function guessType(name: string, values: string[], first: boolean): PropType {
  if (first) return 'title';
  const vals = values.map((v) => v.trim()).filter(Boolean);
  if (!vals.length) return 'text';
  if (vals.every((v) => /^(yes|no|sim|não|true|false)$/i.test(v))) return 'checkbox';
  if (vals.every((v) => /^-?[\d.,]+%?$/.test(v) || /^R\$\s?[\d.,]+$/.test(v))) return 'number';
  if (vals.every((v) => parseDate(v) && /\d{4}|[a-z]{3,}\s+\d/i.test(v))) return 'date';
  if (vals.every((v) => /^https?:\/\//.test(v))) return 'url';
  if (vals.every((v) => /^[^@\s]+@[^@\s]+\.\w+$/.test(v))) return 'email';
  const uniq = new Set(vals.flatMap((v) => (v.includes(', ') ? v.split(', ') : [v])));
  const short = vals.every((v) => v.length <= 40);
  if (short && vals.some((v) => v.includes(', ')) && uniq.size <= 25) return 'multi';
  if (short && uniq.size <= Math.max(3, Math.min(15, vals.length / 2))) return 'select';
  if (/data|date|prazo|vencimento/i.test(name) && vals.every((v) => parseDate(v))) return 'date';
  return 'text';
}

// ------------------------------------------------------------ conversão HTML

interface Ctx { files: Files; pageIds: Map<string, string>; titles: Map<string, string>; counts: ZipResult }

function dataUrl(ctx: Ctx, path: string): string | null {
  const bytes = ctx.files.get(path);
  if (!bytes) return null;
  ctx.counts.files++;
  return `data:${MIME[ext(path)] || 'application/octet-stream'};base64,${b64(bytes)}`;
}

function pageKey(path: string) {
  return stripExt(path).replace(/_all$/, '');
}

/** Ajusta o HTML do Notion para os blocos do editor. */
function adaptHtml(root: HTMLElement, from: string, ctx: Ctx) {
  const doc = root.ownerDocument;
  const el = (tag: string, attrs: Record<string, string> = {}) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  // cores e destaques
  root.querySelectorAll<HTMLElement>('[class*="highlight-"]').forEach((n) => {
    const m = n.className.match(/highlight-([a-z]+)(_background)?/);
    if (!m) return;
    if (m[2]) {
      const mk = el('mark', { 'data-color': HL_BG[m[1]] || '#fde68a', style: `background-color:${HL_BG[m[1]] || '#fde68a'}` });
      mk.innerHTML = n.innerHTML;
      n.replaceWith(mk);
    } else if (HL[m[1]]) n.setAttribute('style', `color:${HL[m[1]]}`);
  });
  // imagens
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!isExternal(src)) {
      const d = dataUrl(ctx, resolve(from, src));
      if (d) img.setAttribute('src', d);
      else img.remove();
    }
    const fig = img.closest('figure');
    const a = img.closest('a');
    if (a) a.replaceWith(img);
    if (fig && fig.contains(img)) {
      const cap = fig.querySelector('figcaption')?.textContent?.trim();
      if (cap) img.setAttribute('alt', cap);
      const p = el('p');
      fig.replaceWith(img, ...(cap ? [Object.assign(p, { textContent: cap })] : []));
    }
  });
  // tarefas
  root.querySelectorAll('ul.to-do-list').forEach((ul) => {
    const out = el('ul', { 'data-type': 'taskList' });
    ul.querySelectorAll(':scope > li').forEach((li) => {
      const on = !!li.querySelector('.checkbox-on');
      li.querySelectorAll('.checkbox').forEach((c) => c.remove());
      const item = el('li', { 'data-type': 'taskItem', 'data-checked': String(on) });
      const p = el('p');
      const text = li.querySelector('span.to-do-children-checked, span.to-do-children-unchecked, span') || li;
      p.innerHTML = text.innerHTML;
      item.appendChild(p);
      li.querySelectorAll(':scope > div > ul, :scope > ul').forEach((sub) => item.appendChild(sub));
      out.appendChild(item);
    });
    ul.replaceWith(out);
  });
  // toggles
  root.querySelectorAll('details').forEach((det) => {
    const summary = det.querySelector('summary');
    const t = el('div', { 'data-type': 'toggle', 'data-summary': summary?.textContent?.trim() || '', 'data-open': 'false' });
    summary?.remove();
    t.innerHTML = det.innerHTML.trim() || '<p></p>';
    const holder = det.closest('ul.toggle');
    (holder && holder.querySelectorAll('details').length === 1 ? holder : det).replaceWith(t);
  });
  // destaques (callout)
  root.querySelectorAll('figure.callout').forEach((fig) => {
    const icon = fig.querySelector('.icon')?.textContent?.trim() || '💡';
    fig.querySelector('.icon')?.closest('div')?.remove();
    const blocks = [...fig.querySelectorAll('p, h1, h2, h3, li')];
    const first = blocks.shift();
    const c = el('div', { 'data-type': 'callout', 'data-emoji': icon.length <= 4 ? icon : '💡' });
    c.innerHTML = first ? first.innerHTML : fig.textContent || '';
    const rest = blocks.filter((b) => !first?.contains(b)).map((b) => b.cloneNode(true) as Element);
    fig.replaceWith(c, ...rest);
  });
  // colunas
  root.querySelectorAll('div.column-list').forEach((list) => {
    const cols = [...list.querySelectorAll(':scope > div.column')].slice(0, 5);
    if (cols.length < 2) return void list.replaceWith(...(cols[0] ? [...cols[0].childNodes] : []));
    const box = el('div', { 'data-type': 'columns', 'data-layout': cols.map(() => 1).join('-'), 'data-style': 'plain' });
    for (const c of cols) {
      const col = el('div', { 'data-type': 'column' });
      col.innerHTML = c.innerHTML.trim() || '<p></p>';
      box.appendChild(col);
    }
    list.replaceWith(box);
  });
  // links para outras páginas e arquivos do .zip
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (isExternal(href)) return;
    const target = resolve(from, href);
    const id = ctx.pageIds.get(pageKey(target));
    if (id && /\.(html?|md|csv)$/i.test(target)) {
      const label = ctx.titles.get(pageKey(target)) || a.textContent?.trim() || '';
      const isBlock = a.parentElement?.tagName === 'FIGURE' || a.classList.contains('link-to-page') || a.closest('figure.link-to-page');
      const span = el('span', { 'data-type': 'pageLink', 'data-id': id, 'data-label': label });
      span.textContent = label;
      const holder = a.closest('figure.link-to-page');
      if (holder || isBlock) {
        const p = el('p');
        p.appendChild(span);
        (holder || a).replaceWith(p);
      } else a.replaceWith(span);
      return;
    }
    const bytes = ctx.files.get(target);
    if (bytes && !/\.(html?|md|csv)$/i.test(target)) {
      const e = ext(target);
      const data = dataUrl(ctx, target)!;
      const type = MIME[e] || 'application/octet-stream';
      const block = /^audio\//.test(type) || /^video\//.test(type)
        ? el('div', { 'data-type': 'mediaRec', 'data-kind': JSON.stringify(type.startsWith('audio') ? 'audio' : 'video'), 'data-src': JSON.stringify(data) })
        : el('div', { 'data-type': 'attachment', 'data-files': JSON.stringify([{ id: uid('f'), name: baseName(target), type, size: bytes.length, data, addedAt: Date.now() }]) });
      const fig = a.closest('figure') || a.closest('p');
      if (fig && fig.textContent?.trim() === a.textContent?.trim()) fig.replaceWith(block);
      else a.after(block), a.remove();
    }
  });
  root.querySelectorAll('script, style, nav, .table_of_contents').forEach((n) => n.remove());
}

function htmlPageParts(html: string) {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const title = dom.querySelector('h1.page-title')?.textContent?.trim() || dom.querySelector('title')?.textContent?.trim() || '';
  const iconEl = dom.querySelector('.page-header-icon');
  const icon = iconEl?.querySelector('img') ? '' : iconEl?.textContent?.trim() || '';
  const iconImg = iconEl?.querySelector('img')?.getAttribute('src') || '';
  const cover = dom.querySelector('img.page-cover-image')?.getAttribute('src') || '';
  const props = dom.querySelector('table.properties');
  const body = (dom.querySelector('.page-body') as HTMLElement) || dom.body;
  const collections = [...dom.querySelectorAll('table.collection-content')] as HTMLTableElement[];
  return { dom, title, icon, iconImg, cover, props, body, collections };
}

// ------------------------------------------------------------ bases

function dbFromHtmlTable(table: HTMLTableElement, from: string, ctx: Ctx): { db: DatabaseData; rowLinks: (string | null)[] } {
  const ths = [...table.querySelectorAll('thead th')];
  const props: Property[] = ths.map((th, i) => {
    const cls = th.querySelector('svg')?.getAttribute('class') || '';
    const type = TYPE_BY_ICON.find(([re]) => re.test(cls))?.[1] || (i === 0 ? 'title' : 'text');
    const p = makeProperty(type, th.textContent?.trim() || `Coluna ${i + 1}`);
    if (type === 'status') p.options = [];
    return p;
  });
  if (!props.some((p) => p.type === 'title') && props[0]) props[0].type = 'title';
  const rows: Row[] = [];
  const rowLinks: (string | null)[] = [];
  table.querySelectorAll('tbody tr').forEach((tr) => {
    const cells: Record<string, any> = {};
    let link: string | null = null;
    [...tr.children].forEach((td, i) => {
      const p = props[i];
      if (!p) return;
      const a = td.querySelector('a[href]');
      if (p.type === 'title' && a && !isExternal(a.getAttribute('href') || '')) link = resolve(from, a.getAttribute('href')!);
      const tags = [...td.querySelectorAll('.selected-value')].map((s) => ({ label: s.textContent?.trim() || '', color: s.className.match(/select-value-color-([a-z]+)/)?.[1] }));
      const checked = td.querySelector('.checkbox') ? !!td.querySelector('.checkbox-on') : undefined;
      cells[p.id] = setCell(p, td.textContent || '', tags.length ? tags : undefined, checked);
    });
    const now = Date.now();
    rows.push({ id: uid('r'), cells, createdAt: now, updatedAt: now });
    rowLinks.push(link);
  });
  const viewId = uid('v');
  return { db: recompute({ properties: props, rows, views: [{ id: viewId, name: 'Tabela', type: 'table', filters: [] } as any], activeView: viewId }), rowLinks };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') row.push(cur), (cur = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cur), rows.push(row), (row = []), (cur = '');
    } else cur += c;
  }
  if (cur || row.length) row.push(cur), rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim()));
}

function dbFromCsv(text: string): DatabaseData {
  const [head = [], ...body] = parseCsv(text);
  const props = head.map((h, i) => {
    const p = makeProperty(guessType(h, body.map((r) => r[i] || ''), i === 0), h.trim() || `Coluna ${i + 1}`);
    if (p.type === 'status') p.options = [];
    return p;
  });
  const rows: Row[] = body.map((r) => {
    const cells: Record<string, any> = {};
    props.forEach((p, i) => (cells[p.id] = setCell(p, r[i] || '')));
    const now = Date.now();
    return { id: uid('r'), cells, createdAt: now, updatedAt: now };
  });
  const viewId = uid('v');
  return recompute({ properties: props, rows, views: [{ id: viewId, name: 'Tabela', type: 'table', filters: [] } as any], activeView: viewId });
}

function textOf(html: HTMLElement): string {
  const lines: string[] = [];
  html.querySelectorAll('p, h1, h2, h3, li, blockquote, pre').forEach((n) => {
    if (n.closest('li') && n.tagName !== 'LI') return;
    const t = n.textContent?.trim() || '';
    lines.push(n.tagName === 'LI' ? '• ' + t : t);
  });
  return lines.join('\n').trim();
}

// ------------------------------------------------------------ importação

export async function importNotionZip(data: Uint8Array, parentId: string | null, progress: (s: string) => void = () => {}): Promise<ZipResult> {
  const files = readZip(data);
  const counts: ZipResult = { pages: 0, databases: 0, files: 0 };
  const ctx: Ctx = { files, pageIds: new Map(), titles: new Map(), counts };
  const v = useVault.getState();

  // Páginas: .html/.md; bases: .csv (prefere a versão "_all", com todas as linhas).
  const docs = [...files.keys()].filter((p) => /\.(html?|md)$/i.test(p) && !(baseName(p).toLowerCase() === 'index.html' && !p.includes('/')));
  const csvs = [...files.keys()].filter((p) => ext(p) === 'csv');
  const csvByKey = new Map<string, string>();
  for (const c of csvs) {
    const k = pageKey(c);
    if (!csvByKey.has(k) || /_all\.csv$/i.test(c)) csvByKey.set(k, c);
  }
  const keys = new Map<string, { doc?: string; csv?: string }>();
  for (const d of docs) keys.set(pageKey(d), { ...keys.get(pageKey(d)), doc: d });
  for (const [k, c] of csvByKey) keys.set(k, { ...keys.get(k), csv: c });
  if (!keys.size) throw new Error('notion-zip-empty');

  // A pasta "X abc123/" guarda as subpáginas de "X abc123.html".
  const parentKey = (k: string) => {
    let d = dirOf(k);
    while (d) {
      if (keys.has(d)) return d;
      d = dirOf(d);
    }
    return null;
  };
  const ordered = [...keys.keys()].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));

  const parsed = new Map<string, ReturnType<typeof htmlPageParts>>();
  const dbs = new Map<string, Page>();

  // 1) cria todas as páginas/bases (vazias) para os links já apontarem para elas
  for (const k of ordered) {
    const ent = keys.get(k)!;
    const pk = parentKey(k);
    if (pk && dbs.has(pk)) continue; // registro de base (tratado depois)
    let title = cleanTitle(k);
    let icon = '';
    let isDb = !!ent.csv;
    if (ent.doc && /\.html?$/i.test(ent.doc)) {
      const parts = htmlPageParts(strFromU8(files.get(ent.doc)!));
      parsed.set(k, parts);
      title = parts.title || title;
      icon = parts.icon;
      const onlyTable = parts.collections.length === 1 && !(parts.dom.querySelector('.page-body')?.textContent || '').replace(parts.collections[0].textContent || '', '').trim();
      if (parts.collections.length && (!parts.dom.querySelector('.page-body') || onlyTable)) isDb = true;
    } else if (ent.doc) {
      const md = strFromU8(files.get(ent.doc)!);
      title = md.match(/^#\s+(.+)$/m)?.[1]?.trim() || title;
    }
    progress(title);
    let up = pk;
    while (up && !ctx.pageIds.has(up)) up = parentKey(up);
    const parent = up ? ctx.pageIds.get(up)! : parentId;
    const page = v.createPage({ type: isDb ? 'database' : 'page', title, icon: icon || (isDb ? '🗂️' : '📄'), parentId: parent, tags: ['notion'] });
    ctx.pageIds.set(k, page.id);
    ctx.titles.set(k, title);
    if (isDb) dbs.set(k, page), counts.databases++;
    else counts.pages++;
  }

  // 2) bases: colunas, linhas e o conteúdo de cada registro
  for (const [k, page] of dbs) {
    const ent = keys.get(k)!;
    progress(page.title);
    let db: DatabaseData;
    let rowLinks: (string | null)[] = [];
    const parts = parsed.get(k);
    if (parts?.collections.length) ({ db, rowLinks } = dbFromHtmlTable(parts.collections[0], ent.doc!, ctx));
    else db = dbFromCsv(strFromU8(files.get(ent.csv!)!));
    // conteúdo dos registros (páginas dentro da pasta da base)
    const title = db.properties.find((p) => p.type === 'title');
    const childKeys = [...keys.keys()].filter((c) => parentKey(c) === k);
    db.rows.forEach((r, i) => {
      let ck = rowLinks[i] ? pageKey(rowLinks[i]!) : null;
      if (ck && !keys.has(ck)) ck = null;
      if (!ck && title) ck = childKeys.find((c) => cleanTitle(c) === String(r.cells[title.id] || '').trim()) || null;
      const ce = ck ? keys.get(ck) : undefined;
      if (!ce?.doc) return;
      const raw = strFromU8(files.get(ce.doc)!);
      let notes = '';
      if (/\.html?$/i.test(ce.doc)) {
        const pp = htmlPageParts(raw);
        pp.props?.remove();
        notes = textOf(pp.body);
      } else notes = raw.replace(/^#\s+.+$/m, '').replace(/^[^\n:]{1,40}:\s.*$/gm, '').trim();
      if (notes) r.notes = notes;
    });
    v.updatePage(page.id, { db: recompute(db) });
  }

  // 3) conteúdo das páginas comuns (com links, imagens e arquivos)
  for (const k of ordered) {
    const id = ctx.pageIds.get(k);
    if (!id || dbs.has(k)) continue;
    const ent = keys.get(k)!;
    if (!ent.doc) continue;
    progress(ctx.titles.get(k) || '');
    const patch: Partial<Page> = {};
    if (/\.html?$/i.test(ent.doc)) {
      const parts = parsed.get(k) || htmlPageParts(strFromU8(files.get(ent.doc)!));
      parts.dom.querySelector('header')?.remove();
      parts.props?.remove();
      // bases embutidas na página viram bases-filhas
      for (const table of parts.collections) {
        const holder = (table.closest('.collection-content') as HTMLElement) || table;
        const dbTitle = holder.querySelector('.collection-title')?.textContent?.trim() || 'Base';
        const { db } = dbFromHtmlTable(table, ent.doc, ctx);
        const child = v.createPage({ type: 'database', title: dbTitle, icon: '🗂️', parentId: id, db, tags: ['notion'] });
        counts.databases++;
        const p = parts.dom.createElement('p');
        const span = parts.dom.createElement('span');
        span.setAttribute('data-type', 'pageLink');
        span.setAttribute('data-id', child.id);
        span.setAttribute('data-label', dbTitle);
        span.textContent = dbTitle;
        p.appendChild(span);
        holder.replaceWith(p);
      }
      if (parts.cover && !isExternal(parts.cover)) patch.cover = dataUrl(ctx, resolve(ent.doc, parts.cover));
      else if (parts.cover) patch.cover = parts.cover;
      if (parts.iconImg && !isExternal(parts.iconImg)) {
        const d = dataUrl(ctx, resolve(ent.doc, parts.iconImg));
        if (d) patch.icon = d;
      }
      adaptHtml(parts.body, ent.doc, ctx);
      patch.content = htmlToDoc(parts.body.innerHTML);
    } else {
      let md = strFromU8(files.get(ent.doc)!).replace(/^#\s+.+\n?/, '');
      const html = marked.parse(md, { async: false }) as string;
      const box = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild as HTMLElement;
      // listas de tarefas do Markdown: "- [x] item"
      box.querySelectorAll('li').forEach((li) => {
        const input = li.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]') as HTMLInputElement | null;
        const m = input ? null : li.innerHTML.match(/^\s*\[( |x)\]\s*/i);
        if (!input && !m) return;
        const checked = input ? input.hasAttribute('checked') : m![1].toLowerCase() === 'x';
        input?.remove();
        li.setAttribute('data-type', 'taskItem');
        li.setAttribute('data-checked', String(checked));
        const html = li.innerHTML.replace(/^\s*\[( |x)\]\s*/i, '').trim();
        li.innerHTML = /^<p>/.test(html) ? html : '<p>' + html + '</p>';
        li.parentElement?.setAttribute('data-type', 'taskList');
      });
      adaptHtml(box, ent.doc, ctx);
      patch.content = htmlToDoc(box.innerHTML);
      md = '';
    }
    if (!patch.content?.content?.length) patch.content = { type: 'doc', content: [{ type: 'paragraph' }] };
    v.updatePage(id, patch);
  }
  return counts;
}
