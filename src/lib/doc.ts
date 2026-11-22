import type { Page } from './types';

/** Texto puro de um documento do editor (JSON do ProseMirror). */
export function docText(node: any, out: string[] = []): string[] {
  if (!node) return out;
  if (node.type === 'text' && node.text) out.push(node.text);
  if (node.type === 'pageLink' && node.attrs?.label) out.push(node.attrs.label);
  if (node.content) {
    for (const c of node.content) docText(c, out);
    if (['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'tableCell', 'tableHeader', 'codeBlock'].includes(node.type)) out.push('\n');
  }
  if (node.attrs) {
    // Blocos especiais guardam conteúdo nos atributos.
    const a = node.attrs;
    if (node.type === 'callout' && a.text) out.push(a.text);
    if (node.type === 'poll') out.push(a.question || '', ...(a.options || []).map((o: any) => o.label));
    if (node.type === 'raffle') out.push(a.title || '', ...(a.entries || []));
    if (node.type === 'form') out.push(a.title || '', ...(a.fields || []).map((f: any) => f.label));
  }
  return out;
}

export function pageText(p: Page): string {
  const parts: string[] = [p.title];
  if (p.content) parts.push(docText(p.content).join(' '));
  if (p.db) {
    for (const r of p.db.rows) {
      for (const prop of p.db.properties) {
        if (prop.type === 'password') continue;
        const v = r.cells[prop.id];
        if (v == null || v === '') continue;
        if (Array.isArray(v)) parts.push(v.map((id) => prop.options?.find((o) => o.id === id)?.label ?? id).join(' '));
        else if (prop.type === 'select' || prop.type === 'status') parts.push(prop.options?.find((o) => o.id === v)?.label ?? '');
        else parts.push(String(v));
      }
      if (r.notes) parts.push(r.notes.replace(/<[^>]+>/g, ' '));
    }
  }
  if (p.canvas) for (const n of p.canvas.nodes) if (n.text) parts.push(n.text);
  if (p.tags?.length) parts.push(p.tags.map((t) => '#' + t).join(' '));
  return parts.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function wordCount(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** IDs de páginas citadas por [[links]] dentro de um documento. */
export function outgoingLinks(p: Page): string[] {
  const set = new Set<string>();
  const walk = (n: any) => {
    if (!n) return;
    if (n.type === 'pageLink' && n.attrs?.id) set.add(n.attrs.id);
    if (n.marks) for (const m of n.marks) if (m.type === 'link' && m.attrs?.href?.startsWith('gcp://page/')) set.add(m.attrs.href.slice(11));
    n.content?.forEach(walk);
  };
  walk(p.content);
  if (p.canvas) for (const n of p.canvas.nodes) if (n.pageId) set.add(n.pageId);
  return [...set];
}

/** Ligações desenhadas no Quadro entre dois cartões de página: [origem, destino]. */
export function boardLinks(p: Page): [string, string][] {
  if (!p.canvas) return [];
  const byNode = new Map(p.canvas.nodes.filter((n) => n.pageId).map((n) => [n.id, n.pageId!]));
  const out: [string, string][] = [];
  for (const e of p.canvas.edges) {
    const a = byNode.get(e.from), b = byNode.get(e.to);
    if (a && b && a !== b) out.push([a, b]);
  }
  return out;
}

export function backlinks(pages: Page[], id: string): Page[] {
  return pages.filter((p) => p.id !== id && outgoingLinks(p).includes(id));
}

/** Busca com pontuação simples (título vale mais), sem diferenciar acentos. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface SearchHit {
  page: Page;
  score: number;
  snippet: string;
}

export function searchPages(pages: Page[], query: string, limit = 30): SearchHit[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  for (const p of pages) {
    const title = normalize(p.title || '');
    const body = pageText(p);
    const nbody = normalize(body);
    let score = 0;
    let ok = true;
    for (const t of terms) {
      const inTitle = title.includes(t);
      const count = nbody.split(t).length - 1;
      if (!inTitle && !count) {
        ok = false;
        break;
      }
      score += (inTitle ? 10 : 0) + Math.min(count, 10);
    }
    if (!ok) continue;
    if (title === q) score += 20;
    if (title.startsWith(q)) score += 6;
    const idx = nbody.indexOf(terms[0]);
    const start = Math.max(0, idx - 50);
    const snippet = (start > 0 ? '…' : '') + body.slice(start, start + 160).replace(/\s+/g, ' ') + (body.length > start + 160 ? '…' : '');
    hits.push({ page: p, score, snippet });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function displayTitle(p: Page | undefined, untitled: string): string {
  return p?.title?.trim() || untitled;
}

export function todayKey(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function formatDate(ts: number | string, locale: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  const d = typeof ts === 'string' ? new Date(ts.length === 10 ? ts + 'T12:00:00' : ts) : new Date(ts);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

export function relativeTime(ts: number, locale: string): string {
  const diff = (ts - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(ts, locale);
}
