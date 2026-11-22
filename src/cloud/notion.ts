/**
 * Integração com o Notion pela API oficial (token de integração interna).
 * - importar páginas e bases compartilhadas com a integração;
 * - sincronizar de novo (atualiza as páginas já importadas, sem duplicar);
 * - enviar uma página do GCP-Neuro Notas para o Notion (cria ou substitui o conteúdo).
 */
import type { DatabaseData, Page, Property, PropType, Row } from '../lib/types';
import { netFetch, isTauri } from '../lib/platform';
import { useVault } from '../store/vault';
import { uid } from '../lib/crypto';
import { makeProperty, newOption, recompute, titleProp, cellText, cellValue } from '../database/logic';

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NotionError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function token(): string {
  const tk = useVault.getState().settings.notion?.token;
  if (!tk) throw new NotionError(401, 'no_token', 'no_token');
  return tk;
}

let lastCall = 0;
async function call<T = any>(path: string, init: { method?: string; body?: any } = {}, tk = token()): Promise<T> {
  if (!isTauri) throw new NotionError(0, 'desktop_only', 'desktop_only');
  const wait = 340 - (Date.now() - lastCall); // limite de ~3 req/s do Notion
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await netFetch(API + path, {
      method: init.method || 'GET',
      headers: { Authorization: `Bearer ${tk}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 429) {
      await sleep((Number(res.headers.get('retry-after')) || 1) * 1000);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new NotionError(res.status, data.code || 'error', data.message || `HTTP ${res.status}`);
    return data as T;
  }
  throw new NotionError(429, 'rate_limited', 'rate_limited');
}

export async function testToken(tk: string): Promise<string> {
  const me = await call<any>('/users/me', {}, tk);
  return me.bot?.workspace_name || me.name || 'Notion';
}

export interface NotionItem {
  id: string;
  kind: 'page' | 'database';
  title: string;
  icon: string;
  url: string;
  edited: string;
  parentType: string;
}

const plainOf = (rt: any[] = []) => rt.map((r) => r.plain_text || '').join('');
const iconOf = (o: any): string => (o?.icon?.type === 'emoji' ? o.icon.emoji : '');
function titleOf(o: any): string {
  if (o.object === 'database') return plainOf(o.title);
  for (const v of Object.values<any>(o.properties || {})) if (v.type === 'title') return plainOf(v.title);
  return '';
}

/** Páginas e bases que a integração pode ver. */
export async function searchNotion(query = ''): Promise<NotionItem[]> {
  const out: NotionItem[] = [];
  let cursor: string | undefined;
  do {
    const r = await call<any>('/search', { method: 'POST', body: { query, page_size: 100, start_cursor: cursor, sort: { direction: 'descending', timestamp: 'last_edited_time' } } });
    for (const o of r.results) {
      if (o.archived || o.in_trash) continue;
      if (o.object === 'page' && o.parent?.type === 'database_id') continue; // registros entram junto com a base
      out.push({ id: o.id, kind: o.object, title: titleOf(o) || 'Sem título', icon: iconOf(o), url: o.url, edited: o.last_edited_time, parentType: o.parent?.type || '' });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor && out.length < 500);
  return out;
}

// --------------------------------------------------------- Notion → TipTap

function marksOf(a: any, href?: string | null) {
  const m: any[] = [];
  if (a?.bold) m.push({ type: 'bold' });
  if (a?.italic) m.push({ type: 'italic' });
  if (a?.underline) m.push({ type: 'underline' });
  if (a?.strikethrough) m.push({ type: 'strike' });
  if (a?.code) m.push({ type: 'code' });
  if (href) m.push({ type: 'link', attrs: { href } });
  if (a?.color && a.color !== 'default' && !a.color.endsWith('_background')) m.push({ type: 'textStyle', attrs: { color: NOTION_COLORS[a.color] || null } });
  if (a?.color?.endsWith('_background')) m.push({ type: 'highlight', attrs: { color: NOTION_BG[a.color.replace('_background', '')] || '#fde68a' } });
  return m.length ? m : undefined;
}
const NOTION_COLORS: Record<string, string> = { gray: '#94a3b8', brown: '#a16207', orange: '#f97316', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', purple: '#8b5cf6', pink: '#ec4899', red: '#ef4444' };
const NOTION_BG: Record<string, string> = { gray: '#e2e8f0', brown: '#fed7aa', orange: '#fed7aa', yellow: '#fde68a', green: '#bbf7d0', blue: '#bfdbfe', purple: '#ddd6fe', pink: '#fbcfe8', red: '#fecaca' };

function inline(rt: any[] = [], idMap: Map<string, string>): any[] {
  const out: any[] = [];
  for (const r of rt) {
    if (r.type === 'mention' && r.mention?.type === 'page') {
      const local = idMap.get(r.mention.page.id);
      if (local) {
        out.push({ type: 'pageLink', attrs: { id: local, label: r.plain_text } });
        continue;
      }
    }
    if (!r.plain_text) continue;
    const parts = String(r.plain_text).split('\n');
    parts.forEach((p, i) => {
      if (i) out.push({ type: 'hardBreak' });
      if (p) out.push({ type: 'text', text: p, marks: marksOf(r.annotations, r.href) });
    });
  }
  return out;
}

async function children(id: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const r = await call<any>(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    out.push(...r.results);
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  return out;
}

interface Ctx {
  idMap: Map<string, string>; // id Notion → id local
  childPages: { notionId: string; title: string; icon: string }[];
  depth: number;
}

async function toDoc(blocks: any[], ctx: Ctx): Promise<any[]> {
  const out: any[] = [];
  let list: { type: string; items: any[] } | null = null;
  const flush = () => {
    if (list) out.push({ type: list.type, content: list.items });
    list = null;
  };
  for (const b of blocks) {
    const d = b[b.type] || {};
    const kids = b.has_children && !['child_page', 'child_database', 'table'].includes(b.type) && ctx.depth < 6 ? await toDoc(await children(b.id), { ...ctx, depth: ctx.depth + 1 }) : [];
    const para = (content: any[]) => ({ type: 'paragraph', content: content.length ? content : undefined });
    const listType = b.type === 'bulleted_list_item' ? 'bulletList' : b.type === 'numbered_list_item' ? 'orderedList' : b.type === 'to_do' ? 'taskList' : '';
    if (listType) {
      if (!list || list.type !== listType) (flush(), (list = { type: listType, items: [] }));
      const item = { type: listType === 'taskList' ? 'taskItem' : 'listItem', attrs: listType === 'taskList' ? { checked: !!d.checked } : undefined, content: [para(inline(d.rich_text, ctx.idMap)), ...kids] };
      (list as { items: any[] }).items.push(item);
      continue;
    }
    flush();
    switch (b.type) {
      case 'paragraph': out.push(para(inline(d.rich_text, ctx.idMap)), ...kids); break;
      case 'heading_1': case 'heading_2': case 'heading_3':
        out.push({ type: 'heading', attrs: { level: +b.type.slice(-1) }, content: inline(d.rich_text, ctx.idMap) });
        out.push(...kids);
        break;
      case 'quote': out.push({ type: 'blockquote', content: [para(inline(d.rich_text, ctx.idMap)), ...kids] }); break;
      case 'callout': out.push({ type: 'callout', attrs: { emoji: d.icon?.emoji || '💡', tone: 'info' }, content: inline(d.rich_text, ctx.idMap) }, ...kids); break;
      case 'toggle': out.push({ type: 'toggle', attrs: { summary: plainOf(d.rich_text), open: false }, content: kids.length ? kids : [{ type: 'paragraph' }] }); break;
      case 'code': out.push({ type: 'codeBlock', attrs: { language: d.language || null }, content: plainOf(d.rich_text) ? [{ type: 'text', text: plainOf(d.rich_text) }] : undefined }); break;
      case 'divider': out.push({ type: 'horizontalRule' }); break;
      case 'image': {
        const src = d.type === 'external' ? d.external?.url : d.file?.url;
        if (src) out.push({ type: 'image', attrs: { src, alt: plainOf(d.caption) } });
        break;
      }
      case 'bookmark': case 'embed': case 'link_preview':
        if (d.url) out.push(para([{ type: 'text', text: d.url, marks: [{ type: 'link', attrs: { href: d.url } }] }]));
        break;
      case 'video':
        if (d.external?.url && /youtu/.test(d.external.url)) out.push({ type: 'youtube', attrs: { src: d.external.url } });
        break;
      case 'equation': out.push({ type: 'codeBlock', content: [{ type: 'text', text: d.expression || '' }] }); break;
      case 'child_page':
        ctx.childPages.push({ notionId: b.id, title: d.title || '', icon: '' });
        out.push(para([{ type: 'text', text: '📄 ' + (d.title || '') }]));
        break;
      case 'child_database':
        out.push(para([{ type: 'text', text: '🗂️ ' + (d.title || '') }]));
        break;
      case 'table': {
        const rows = await children(b.id);
        out.push({
          type: 'table',
          content: rows.map((r, i) => ({
            type: 'tableRow',
            content: (r.table_row?.cells || []).map((cell: any[]) => ({ type: i === 0 && d.has_column_header ? 'tableHeader' : 'tableCell', content: [para(inline(cell, ctx.idMap))] })),
          })),
        });
        break;
      }
      case 'column_list': case 'column': case 'synced_block': out.push(...kids); break;
      default:
        if (d.rich_text) out.push(para(inline(d.rich_text, ctx.idMap)));
        out.push(...kids);
    }
  }
  flush();
  return out;
}

// -------------------------------------------------------- importação

function links(): Record<string, string> {
  return { ...(useVault.getState().settings.notion?.links || {}) };
}
function saveLinks(l: Record<string, string>) {
  useVault.getState().updateSettings((s) => ({ ...s, notion: { ...(s.notion || { token: '' }), links: l, lastSync: Date.now() } }));
}

/** Importa (ou atualiza) uma página do Notion e suas subpáginas. */
async function importPage(notionId: string, parentId: string | null, l: Record<string, string>, progress: (s: string) => void, depth = 0): Promise<Page> {
  const v = useVault.getState();
  const meta = await call<any>(`/pages/${notionId}`);
  const title = titleOf(meta) || 'Sem título';
  progress(title);
  const idMap = new Map(Object.entries(l));
  const ctx: Ctx = { idMap, childPages: [], depth: 0 };
  const content = { type: 'doc', content: await toDoc(await children(notionId), ctx) };
  if (!content.content.length) content.content.push({ type: 'paragraph' } as any);
  const existing = l[notionId] && v.pages[l[notionId]] && !v.pages[l[notionId]].deletedAt ? v.pages[l[notionId]] : null;
  const icon = iconOf(meta) || '📄';
  const cover = meta.cover?.type === 'external' ? null : null;
  let page: Page;
  if (existing) {
    v.updatePage(existing.id, { title, icon, content });
    page = useVault.getState().pages[existing.id];
  } else {
    page = v.createPage({ type: 'page', title, icon, content, parentId, cover, tags: ['notion'] });
    l[notionId] = page.id;
  }
  if (depth < 4) for (const c of ctx.childPages) await importPage(c.notionId, page.id, l, progress, depth + 1);
  return page;
}

function propType(t: string): PropType {
  switch (t) {
    case 'title': return 'title';
    case 'number': return 'number';
    case 'select': return 'select';
    case 'multi_select': return 'multi';
    case 'status': return 'status';
    case 'date': return 'date';
    case 'checkbox': return 'checkbox';
    case 'url': return 'url';
    case 'email': return 'email';
    case 'phone_number': return 'phone';
    case 'created_time': case 'last_edited_time': return 'date';
    default: return 'text';
  }
}

function propValue(p: Property, v: any): any {
  switch (v.type) {
    case 'title': return plainOf(v.title);
    case 'rich_text': return plainOf(v.rich_text);
    case 'number': return v.number ?? '';
    case 'select': case 'status': {
      const name = v[v.type]?.name;
      if (!name) return '';
      let o = p.options!.find((x) => x.label === name);
      if (!o) (o = { ...newOption(name, p.options), color: NOTION_TO_OPT[v[v.type].color] || 'gray' }), p.options!.push(o);
      return o.id;
    }
    case 'multi_select':
      return (v.multi_select || []).map((s: any) => {
        let o = p.options!.find((x) => x.label === s.name);
        if (!o) (o = { ...newOption(s.name, p.options), color: NOTION_TO_OPT[s.color] || 'gray' }), p.options!.push(o);
        return o.id;
      });
    case 'date': return v.date?.start?.slice(0, 10) || '';
    case 'created_time': return v.created_time?.slice(0, 10) || '';
    case 'last_edited_time': return v.last_edited_time?.slice(0, 10) || '';
    case 'checkbox': return !!v.checkbox;
    case 'url': return v.url || '';
    case 'email': return v.email || '';
    case 'phone_number': return v.phone_number || '';
    case 'people': return (v.people || []).map((x: any) => x.name || '').join(', ');
    case 'formula': return v.formula?.[v.formula.type] ?? '';
    case 'rollup': return v.rollup?.number ?? (v.rollup?.array || []).length;
    case 'relation': return (v.relation || []).length ? `${v.relation.length} →` : '';
    case 'files': return (v.files || []).map((f: any) => f.name).join(', ');
    case 'unique_id': return `${v.unique_id?.prefix ? v.unique_id.prefix + '-' : ''}${v.unique_id?.number ?? ''}`;
    default: return '';
  }
}
const NOTION_TO_OPT: Record<string, string> = { default: 'gray', gray: 'gray', brown: 'brown', orange: 'orange', yellow: 'yellow', green: 'green', blue: 'blue', purple: 'purple', pink: 'pink', red: 'red' };

/** Importa (ou atualiza) uma base de dados do Notion com todos os registros. */
async function importDatabase(notionId: string, parentId: string | null, l: Record<string, string>, progress: (s: string) => void): Promise<Page> {
  const v = useVault.getState();
  const meta = await call<any>(`/databases/${notionId}`);
  const title = plainOf(meta.title) || 'Base do Notion';
  progress(title);
  const existing = l[notionId] && v.pages[l[notionId]] && !v.pages[l[notionId]].deletedAt ? v.pages[l[notionId]] : null;
  const old = existing?.db;
  const entries = Object.entries<any>(meta.properties);
  entries.sort((a, b) => (a[1].type === 'title' ? -1 : b[1].type === 'title' ? 1 : 0));
  const props: Property[] = entries.map(([name, def]) => {
    const prev = old?.properties.find((x) => x.name === name);
    const type = propType(def.type);
    const p: Property = prev ? { ...prev, options: prev.options ? [...prev.options] : undefined } : makeProperty(type, name);
    if (['select', 'multi', 'status'].includes(type)) {
      p.options ||= [];
      for (const o of def[def.type]?.options || []) if (!p.options.some((x) => x.label === o.name)) p.options.push({ id: uid('o'), label: o.name, color: NOTION_TO_OPT[o.color] || 'gray' });
    }
    if (type === 'number' && def.number?.format?.includes('real')) p.format = 'currency';
    if (type === 'number' && def.number?.format === 'percent') p.format = 'percent';
    return p;
  });
  const rows: Row[] = [];
  let cursor: string | undefined;
  do {
    const r = await call<any>(`/databases/${notionId}/query`, { method: 'POST', body: { page_size: 100, start_cursor: cursor } });
    for (const o of r.results) {
      const cells: Record<string, any> = {};
      entries.forEach(([name], i) => {
        const val = o.properties[name];
        if (val) cells[props[i].id] = propValue(props[i], val);
      });
      const prevRow = old?.rows.find((x) => (x as any).notionId === o.id);
      rows.push({ id: prevRow?.id || uid('r'), cells, createdAt: Date.parse(o.created_time) || Date.now(), updatedAt: Date.parse(o.last_edited_time) || Date.now(), notionId: o.id } as Row);
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
  const viewId = old?.views[0]?.id || uid('v');
  const db: DatabaseData = recompute({
    properties: props,
    rows,
    views: old?.views?.length ? old.views : [{ id: viewId, name: 'Tabela', type: 'table', filters: [] }],
    activeView: old?.activeView || viewId,
  });
  if (existing) {
    v.updatePage(existing.id, { title, db, icon: iconOf(meta) || existing.icon });
    return useVault.getState().pages[existing.id];
  }
  const page = v.createPage({ type: 'database', title, icon: iconOf(meta) || '🗂️', db, parentId, tags: ['notion'] });
  l[notionId] = page.id;
  return page;
}

/** Importa os itens escolhidos. Devolve quantas páginas/bases foram criadas ou atualizadas. */
export async function importFromNotion(items: NotionItem[], progress: (s: string) => void): Promise<number> {
  const l = links();
  let n = 0;
  for (const it of items) {
    if (it.kind === 'database') await importDatabase(it.id, null, l, progress);
    else await importPage(it.id, null, l, progress);
    n++;
    saveLinks(l);
  }
  saveLinks(l);
  return n;
}

/** Busca de novo tudo o que já foi importado (Notion → GCP-Neuro Notas). */
export async function syncFromNotion(progress: (s: string) => void): Promise<number> {
  const l = links();
  const v = useVault.getState();
  let n = 0;
  for (const [notionId, localId] of Object.entries(l)) {
    const p = v.pages[localId];
    if (!p || p.deletedAt) continue;
    if (p.parentId && Object.values(l).includes(p.parentId)) continue; // subpáginas vêm com a página-mãe
    try {
      if (p.type === 'database') await importDatabase(notionId, p.parentId, l, progress);
      else await importPage(notionId, p.parentId, l, progress);
      n++;
    } catch (e) {
      if (e instanceof NotionError && (e.status === 404 || e.code === 'object_not_found')) continue;
      throw e;
    }
  }
  saveLinks(l);
  return n;
}

// --------------------------------------------------------- TipTap → Notion

const rt = (nodes: any[] = []): any[] =>
  nodes.flatMap((n: any) => {
    if (n.type === 'hardBreak') return [{ type: 'text', text: { content: '\n' } }];
    if (n.type === 'pageLink') return [{ type: 'text', text: { content: n.attrs?.label || '' }, annotations: { underline: true } }];
    if (n.type !== 'text' || !n.text) return [];
    const m = Object.fromEntries((n.marks || []).map((x: any) => [x.type, x.attrs || true]));
    const chunks: string[] = [];
    for (let i = 0; i < n.text.length; i += 1900) chunks.push(n.text.slice(i, i + 1900));
    return chunks.map((c) => ({
      type: 'text',
      text: { content: c, link: m.link?.href && /^https?:/.test(m.link.href) ? { url: m.link.href } : null },
      annotations: { bold: !!m.bold, italic: !!m.italic, strikethrough: !!m.strike, underline: !!m.underline, code: !!m.code, color: 'default' },
    }));
  });
const text = (n: any) => ({ rich_text: rt(n?.content) });

function toBlocks(nodes: any[] = []): any[] {
  const out: any[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'paragraph': out.push({ type: 'paragraph', paragraph: text(n) }); break;
      case 'heading': { const k = `heading_${Math.min(3, n.attrs?.level || 1)}`; out.push({ type: k, [k]: text(n) }); break; }
      case 'bulletList': case 'orderedList': case 'taskList':
        for (const li of n.content || []) {
          const [first, ...rest] = li.content || [];
          const k = n.type === 'bulletList' ? 'bulleted_list_item' : n.type === 'orderedList' ? 'numbered_list_item' : 'to_do';
          const body: any = { ...text(first) };
          if (k === 'to_do') body.checked = !!li.attrs?.checked;
          const kids = toBlocks(rest);
          if (kids.length) body.children = kids.slice(0, 100);
          out.push({ type: k, [k]: body });
        }
        break;
      case 'blockquote': out.push({ type: 'quote', quote: { rich_text: rt((n.content || []).flatMap((c: any) => [...(c.content || []), { type: 'hardBreak' }]).slice(0, -1)) } }); break;
      case 'callout': out.push({ type: 'callout', callout: { ...text(n), icon: { type: 'emoji', emoji: n.attrs?.emoji || '💡' } } }); break;
      case 'toggle': out.push({ type: 'toggle', toggle: { rich_text: [{ type: 'text', text: { content: n.attrs?.summary || '' } }], children: toBlocks(n.content).slice(0, 100) } }); break;
      case 'codeBlock': out.push({ type: 'code', code: { ...text(n), language: 'plain text' } }); break;
      case 'horizontalRule': out.push({ type: 'divider', divider: {} }); break;
      case 'image': if (/^https?:/.test(n.attrs?.src || '')) out.push({ type: 'image', image: { type: 'external', external: { url: n.attrs.src } } }); break;
      case 'youtube': if (n.attrs?.src) out.push({ type: 'video', video: { type: 'external', external: { url: n.attrs.src } } }); break;
      case 'table': {
        const rows = n.content || [];
        const width = Math.max(1, ...rows.map((r: any) => (r.content || []).length));
        out.push({
          type: 'table',
          table: {
            table_width: width,
            has_column_header: rows[0]?.content?.[0]?.type === 'tableHeader',
            has_row_header: false,
            children: rows.map((r: any) => ({ type: 'table_row', table_row: { cells: Array.from({ length: width }, (_, i) => rt((r.content?.[i]?.content || []).flatMap((p: any) => p.content || []))) } })),
          },
        });
        break;
      }
      default: {
        const s = JSON.stringify(n);
        if (n.content) out.push(...toBlocks(n.content));
        else if (s.includes('"text"')) out.push({ type: 'paragraph', paragraph: { rich_text: [] } });
      }
    }
  }
  return out;
}

function dbAsBlocks(page: Page): any[] {
  const db = page.db!;
  const props = db.properties.filter((p) => p.type !== 'password').slice(0, 12);
  return [{
    type: 'table',
    table: {
      table_width: props.length,
      has_column_header: true,
      has_row_header: false,
      children: [
        { type: 'table_row', table_row: { cells: props.map((p) => [{ type: 'text', text: { content: p.name } }]) } },
        ...db.rows.slice(0, 98).map((r) => ({ type: 'table_row', table_row: { cells: props.map((p) => [{ type: 'text', text: { content: cellText(p, cellValue(p, r)).slice(0, 1900) } }]) } })),
      ],
    },
  }];
}

async function appendAll(blockId: string, blocks: any[]) {
  for (let i = 0; i < blocks.length; i += 100) await call(`/blocks/${blockId}/children`, { method: 'PATCH', body: { children: blocks.slice(i, i + 100) } });
}

/** Envia uma página ao Notion. Se ela veio do Notion (ou já foi enviada), o conteúdo é substituído. */
export async function pushToNotion(page: Page, parentNotionId: string | null): Promise<string> {
  const l = links();
  const linked = Object.entries(l).find(([, local]) => local === page.id)?.[0];
  const blocks = page.type === 'database' && page.db ? dbAsBlocks(page) : toBlocks(page.content?.content || []);
  const icon = page.icon && !page.icon.startsWith('lucide:') && !page.icon.startsWith('data:') ? { type: 'emoji', emoji: page.icon } : undefined;
  if (linked && page.type !== 'database') {
    await call(`/pages/${linked}`, { method: 'PATCH', body: { properties: { title: { title: [{ type: 'text', text: { content: page.title || '' } }] } }, icon } });
    for (const b of await children(linked)) if (b.type !== 'child_page' && b.type !== 'child_database') await call(`/blocks/${b.id}`, { method: 'DELETE' });
    await appendAll(linked, blocks);
    return linked;
  }
  if (!parentNotionId) throw new NotionError(400, 'no_parent', 'no_parent');
  const created = await call<any>('/pages', {
    method: 'POST',
    body: { parent: { page_id: parentNotionId }, icon, properties: { title: { title: [{ type: 'text', text: { content: page.title || 'GCP-Neuro Notas' } }] } }, children: blocks.slice(0, 100) },
  });
  await appendAll(created.id, blocks.slice(100));
  l[created.id] = page.id;
  saveLinks(l);
  return created.url as string;
}

export function notionErrorKey(e: unknown): string {
  if (e instanceof NotionError) {
    if (e.code === 'no_token') return 'notion.err.noToken';
    if (e.code === 'desktop_only') return 'cloud.desktopOnly';
    if (e.status === 401) return 'notion.err.token';
    if (e.status === 404 || e.code === 'object_not_found') return 'notion.err.notShared';
    if (e.code === 'no_parent') return 'notion.err.parent';
    if (e.code === 'validation_error') return 'notion.err.validation';
  }
  return 'notion.err.generic';
}

export const _test = { toBlocks, propType, titleProp };
