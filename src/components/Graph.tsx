import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Link2, Maximize, Minus, Network, Plus, Search, Sparkles, Tags, X, Palette, Crosshair } from 'lucide-react';
import { useT, type TKey } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi, toast } from '../store/ui';
import { usePrefs } from '../store/prefs';
import { getTheme } from '../lib/themes';
import { isMobile } from '../lib/platform';
import { boardLinks, normalize, outgoingLinks } from '../lib/doc';
import { relatedPages, unlinkedMentions } from '../ai/brain';
import { PageIcon, Popover, Switch } from './ui';
import type { Page } from '../lib/types';

// Valores estáveis: um [] ou {} novo a cada leitura faria a tela redesenhar sem parar.
const NO_COLORS: { link?: string; board?: string; child?: string; suggestion?: string; width?: number } = {};

type Kind = 'link' | 'board' | 'child' | 'related' | 'mention' | 'tag' | 'data';
interface N { id: string; page?: Page; tag?: string; label: string; x: number; y: number; vx: number; vy: number; deg: number; group: number }
interface E { a: string; b: string; kind: Kind; both?: boolean }

const TYPE_COLORS: Record<string, string> = { page: '#8b5cf6', database: '#14b8a6', report: '#ec4899', canvas: '#3b82f6', tag: '#f59e0b' };
const GROUP_COLORS = ['#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#22c55e', '#ef4444', '#06b6d4', '#a855f7', '#eab308', '#64748b'];
const PRIORITY: Record<Kind, number> = { link: 6, board: 5, data: 4, child: 3, mention: 2, related: 1, tag: 0 };

/** Comunidades por propagação de rótulos (agrupa ideias muito ligadas entre si). */
function communities(ids: string[], edges: E[]): Map<string, number> {
  const adj = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of edges) if (e.kind !== 'related' && e.kind !== 'mention') (adj.get(e.a)?.push(e.b), adj.get(e.b)?.push(e.a));
  const label = new Map(ids.map((i) => [i, i]));
  for (let it = 0; it < 12; it++) {
    let changed = false;
    for (const id of ids) {
      const ns = adj.get(id)!;
      if (!ns.length) continue;
      const count = new Map<string, number>();
      for (const n of ns) count.set(label.get(n)!, (count.get(label.get(n)!) || 0) + 1);
      let best = label.get(id)!, bc = 0;
      for (const [l, c] of count) if (c > bc || (c === bc && l < best)) (best = l), (bc = c);
      if (best !== label.get(id)) (label.set(id, best), (changed = true));
    }
    if (!changed) break;
  }
  const sizes = new Map<string, number>();
  for (const l of label.values()) sizes.set(l, (sizes.get(l) || 0) + 1);
  const order = [...sizes.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  return new Map(ids.map((i) => {
    const l = label.get(i)!;
    return [i, sizes.get(l)! > 1 ? order.indexOf(l) : -1];
  }));
}

/** Mistura duas cores (#rgb/#rrggbb/rgb()) — t = quanto da segunda. */
function mixHex(a: string, b: string, t: number) {
  const parse = (c: string) => {
    const m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    const r = c.match(/\d+(\.\d+)?/g);
    return r ? r.slice(0, 3).map(Number) : [128, 128, 128];
  };
  const x = parse(a), y = parse(b);
  return `rgb(${x.map((v, i) => Math.round(v * (1 - t) + y[i] * t)).join(',')})`;
}

/** Um passo da simulação de forças (repulsão, molas e gravidade ao centro). */
function step(nodes: N[], edges: E[], byId: Map<string, N>, alpha: number, drag: N | null) {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) (dx = Math.random()), (dy = Math.random()), (d2 = 1);
      if (d2 > 250000) continue;
      const f = (1800 / d2) * alpha;
      const d = Math.sqrt(d2);
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
  }
  for (const e of edges) {
    const a = byId.get(e.a), b = byId.get(e.b);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const target = e.kind === 'child' || e.kind === 'tag' ? 90 : e.kind === 'related' || e.kind === 'mention' ? 160 : 120;
    const strength = e.kind === 'related' || e.kind === 'mention' ? 0.015 : 0.04;
    const f = ((d - target) / d) * strength * alpha;
    a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
  }
  for (const n of nodes) {
    n.vx -= n.x * 0.002 * alpha;
    n.vy -= n.y * 0.002 * alpha;
    if (n !== drag) { n.x += n.vx; n.y += n.vy; }
    n.vx *= 0.82; n.vy *= 0.82;
  }
}

/** Grafo de conhecimento interativo: links, quadros, hierarquia, tags e sugestões. */
export function Graph() {
  const t = useT();
  const pages = useVault((s) => s.pages);
  const updatePage = useVault((s) => s.updatePage);
  const go = useUi((s) => s.go);
  const theme = usePrefs((s) => s.theme);
  const [q, setQ] = useState('');
  const [hier, setHier] = useState(true);
  const [similar, setSimilar] = useState(false);
  const [mentions, setMentions] = useState(true);
  const [tags, setTags] = useState(false);
  const [orphans, setOrphans] = useState(!isMobile); // no celular começa só com o que está ligado
  const [colorBy, setColorBy] = useState<'type' | 'group'>('type');
  const [focus, setFocus] = useState<{ id: string; depth: number } | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const settled = useRef(false);
  const gc = usePrefs((s) => s.graphColors) ?? NO_COLORS;
  const setPrefs = usePrefs((s) => s.set);
  const [colorsOpen, setColorsOpen] = useState(false);
  const colorsRef = useRef<HTMLButtonElement>(null);
  const state = useRef({ nodes: [] as N[], edges: [] as E[], view: { x: 0, y: 0, k: 1 }, drag: null as N | null, hover: null as N | null, sel: null as string | null, alpha: 1 });

  const all = livePages(pages);
  const { nodes, edges, stats } = useMemo(() => {
    const ids = new Set(all.map((p) => p.id));
    const map = new Map<string, E>();
    const add = (a: string, b: string, kind: Kind) => {
      if (a === b || !ids.has(a) && !a.startsWith('tag:') || !ids.has(b) && !b.startsWith('tag:')) return;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const cur = map.get(key);
      if (!cur) return void map.set(key, { a, b, kind });
      if (cur.kind === kind && (cur.a !== a)) cur.both = true;
      if (PRIORITY[kind] > PRIORITY[cur.kind]) map.set(key, { a, b, kind, both: cur.both });
    };
    for (const p of all) {
      for (const l of outgoingLinks(p)) {
        const isBoardCard = p.type === 'canvas' || p.mode === 'edgeless';
        add(p.id, l, isBoardCard && !(p.content && JSON.stringify(p.content).includes(l)) ? 'board' : 'link');
      }
      for (const [a, b] of boardLinks(p)) add(a, b, 'board');
      if (p.report) for (const w of p.report.widgets) if (w.source) add(p.id, w.source, 'data');
      if (hier && p.parentId) add(p.parentId, p.id, 'child');
      if (tags) for (const tg of p.tags || []) add(p.id, 'tag:' + normalize(tg), 'tag');
    }
    if (mentions) for (const p of all.filter((x) => (x.title || '').length >= 3).slice(0, 400)) for (const m of unlinkedMentions(all, p)) add(m.id, p.id, 'mention');
    if (similar) for (const p of all.filter((x) => x.type === 'page').slice(0, 150)) for (const r of relatedPages(all, p, 2)) if (r.score > 0.15) add(p.id, r.page.id, 'related');
    let edges = [...map.values()];
    const tagNames = new Map<string, string>();
    if (tags) for (const p of all) for (const tg of p.tags || []) tagNames.set('tag:' + normalize(tg), tg);

    // Foco local: só os vizinhos até N passos do nó escolhido.
    let keep: Set<string> | null = null;
    if (focus) {
      keep = new Set([focus.id]);
      let frontier = [focus.id];
      for (let d = 0; d < focus.depth; d++) {
        const nextF: string[] = [];
        for (const e of edges) {
          if (frontier.includes(e.a) && !keep.has(e.b)) (keep.add(e.b), nextF.push(e.b));
          if (frontier.includes(e.b) && !keep.has(e.a)) (keep.add(e.a), nextF.push(e.a));
        }
        frontier = nextF;
      }
      edges = edges.filter((e) => keep!.has(e.a) && keep!.has(e.b));
    }
    const deg = new Map<string, number>();
    edges.forEach((e) => (deg.set(e.a, (deg.get(e.a) || 0) + 1), deg.set(e.b, (deg.get(e.b) || 0) + 1)));
    const prev = new Map(state.current.nodes.map((n) => [n.id, n]));
    const base: { id: string; page?: Page; tag?: string; label: string }[] = [
      ...all.map((p) => ({ id: p.id, page: p, label: (p.icon && !p.icon.startsWith('lucide') && !p.icon.startsWith('data') ? p.icon + ' ' : '') + (p.title || '…') })),
      ...[...tagNames].map(([id, name]) => ({ id, tag: name, label: '#' + name })),
    ];
    const visible = base.filter((b) => (keep ? keep.has(b.id) : orphans || deg.get(b.id) || b.id === selId));
    const groups = communities(visible.map((v) => v.id), edges);
    const nodes: N[] = visible.map((b, i) => {
      const o = prev.get(b.id);
      const a = (i / Math.max(visible.length, 1)) * Math.PI * 2;
      return { ...b, x: o?.x ?? Math.cos(a) * 240 + Math.random() * 20, y: o?.y ?? Math.sin(a) * 240 + Math.random() * 20, vx: 0, vy: 0, deg: deg.get(b.id) || 0, group: groups.get(b.id) ?? -1 };
    });
    // Layout já assentado ao abrir: roda a simulação antes do primeiro desenho.
    const fresh = nodes.filter((n) => !prev.has(n.id)).length;
    if (fresh > nodes.length * 0.3 && nodes.length) {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      let a = 1;
      for (let i = 0; i < Math.min(400, 60000 / Math.max(1, nodes.length)); i++) (step(nodes, edges, byId, a, null), (a *= 0.985));
      settled.current = true;
    }
    const stats = { nodes: nodes.length, links: edges.filter((e) => e.kind === 'link' || e.kind === 'board').length, suggestions: edges.filter((e) => e.kind === 'mention').length, groups: new Set([...groups.values()].filter((g) => g >= 0)).size };
    return { nodes, edges, stats };
  }, [pages, hier, similar, orphans, mentions, tags, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    state.current.nodes = nodes;
    state.current.edges = edges;
    state.current.alpha = settled.current ? 0.12 : 1;
    if (settled.current) {
      settled.current = false;
      requestAnimationFrame(() => fit());
    }
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => void (state.current.sel = selId), [selId]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const dark = getTheme(theme).dark;
    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue('--text').trim() || '#fff';
    const muted = css.getPropertyValue('--muted').trim() || '#999';
    const accent = css.getPropertyValue('--accent').trim() || '#8b5cf6';
    const bg = css.getPropertyValue('--bg').trim() || '#000';
    const accent2 = css.getPropertyValue('--accent-2').trim() || '#22d3ee';
    // Cores das ligações: escolhidas pelo usuário ou derivadas do tema (contraste garantido).
    const colLink = gc.link || (dark ? mixHex(accent, '#ffffff', 0.35) : mixHex(accent, '#000000', 0.15));
    const colBoard = gc.board || (dark ? mixHex(accent2, '#ffffff', 0.2) : mixHex(accent2, '#000000', 0.25));
    const colChild = gc.child || (dark ? mixHex(muted, '#ffffff', 0.15) : mixHex(muted, '#000000', 0.1));
    const colSug = gc.suggestion || (dark ? '#fbbf24' : '#d97706');
    const lw = gc.width || 1;
    const resize = () => {
      const r = cv.parentElement!.getBoundingClientRect();
      cv.width = r.width * devicePixelRatio;
      cv.height = r.height * devicePixelRatio;
      cv.style.width = r.width + 'px';
      cv.style.height = r.height + 'px';
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement!);
    const colorOf = (n: N) => (colorBy === 'group' ? (n.group >= 0 ? GROUP_COLORS[n.group % GROUP_COLORS.length] : '#94a3b8') : n.tag ? TYPE_COLORS.tag : TYPE_COLORS[n.page?.type || 'page'] || accent);

    const tick = () => {
      const s = state.current;
      const { nodes, edges } = s;
      const byId = new Map(nodes.map((n) => [n.id, n]));
      if (s.alpha > 0.005) {
        step(nodes, edges, byId, s.alpha, s.drag);
        s.alpha *= 0.992;
      }
      const W = cv.width, H = cv.height, dpr = devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(s.view.k * dpr, 0, 0, s.view.k * dpr, W / 2 + s.view.x * dpr, H / 2 + s.view.y * dpr);
      const qn = normalize(q);
      const hot = s.hover || (s.sel ? byId.get(s.sel) || null : null);
      const neighbors = new Set<string>();
      if (hot) edges.forEach((e) => (e.a === hot.id ? neighbors.add(e.b) : e.b === hot.id ? neighbors.add(e.a) : 0));
      const k = s.view.k;
      for (const e of edges) {
        const a = byId.get(e.a), b = byId.get(e.b);
        if (!a || !b) continue;
        const on = hot && (e.a === hot.id || e.b === hot.id);
        const sug = e.kind === 'mention' || e.kind === 'related';
        const base = e.kind === 'board' ? colBoard : e.kind === 'child' || e.kind === 'tag' || e.kind === 'data' ? colChild : sug ? colSug : colLink;
        ctx.strokeStyle = on ? (sug ? colSug : accent) : base;
        ctx.globalAlpha = hot && !on ? 0.35 : sug ? 0.75 : 0.9;
        ctx.lineWidth = Math.max(0.6, ((on ? 2.6 : e.kind === 'link' || e.kind === 'board' ? 1.8 : 1.3) * lw) / k);
        ctx.setLineDash(e.kind === 'child' ? [4 / k, 4 / k] : sug ? [2 / k, 4 / k] : e.kind === 'tag' ? [1 / k, 3 / k] : []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = hot && !on ? 0.35 : 1;
        // seta de direção nos links
        if ((e.kind === 'link' || e.kind === 'board' || e.kind === 'data') && k > 0.45) {
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          const rb = 6 + Math.min(b.deg, 12) * 1.2 + 3;
          const tx = b.x - Math.cos(ang) * rb, ty = b.y - Math.sin(ang) * rb;
          const sz = 6 / k;
          ctx.setLineDash([]);
          ctx.fillStyle = ctx.strokeStyle as string;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - Math.cos(ang - 0.45) * sz, ty - Math.sin(ang - 0.45) * sz);
          ctx.lineTo(tx - Math.cos(ang + 0.45) * sz, ty - Math.sin(ang + 0.45) * sz);
          ctx.closePath();
          ctx.fill();
          if (e.both) {
            const sx2 = a.x + Math.cos(ang) * (6 + Math.min(a.deg, 12) * 1.2 + 3), sy2 = a.y + Math.sin(ang) * (6 + Math.min(a.deg, 12) * 1.2 + 3);
            ctx.beginPath();
            ctx.moveTo(sx2, sy2);
            ctx.lineTo(sx2 + Math.cos(ang - 0.45) * sz, sy2 + Math.sin(ang - 0.45) * sz);
            ctx.lineTo(sx2 + Math.cos(ang + 0.45) * sz, sy2 + Math.sin(ang + 0.45) * sz);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      for (const n of nodes) {
        const r = n.tag ? 4 + Math.min(n.deg, 10) * 0.8 : 5 + Math.min(n.deg, 12) * 1.2;
        const match = qn && normalize(n.label).includes(qn);
        const dim = (hot && n !== hot && !neighbors.has(n.id)) || (qn && !match);
        ctx.globalAlpha = dim ? 0.2 : 1;
        const c = colorOf(n);
        if (n.id === s.sel) {
          ctx.fillStyle = c + '33';
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 9 / k, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = c;
        ctx.beginPath();
        if (n.tag) {
          ctx.moveTo(n.x, n.y - r); ctx.lineTo(n.x + r, n.y); ctx.lineTo(n.x, n.y + r); ctx.lineTo(n.x - r, n.y); ctx.closePath();
        } else ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = match || n === hot ? text : bg;
        ctx.lineWidth = (match || n === hot ? 2 : 1.5) / k;
        ctx.stroke();
        if (k > 0.6 || n === hot || n.deg > 3 || match || neighbors.has(n.id)) {
          ctx.fillStyle = n === hot ? text : muted;
          ctx.font = `${n === hot ? 600 : 400} ${12 / Math.max(k, 0.8)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(n.label.slice(0, 34), n.x, n.y + r + 13 / k);
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => (cancelAnimationFrame(raf), ro.disconnect());
  }, [theme, q, colorBy, gc]); // eslint-disable-line react-hooks/exhaustive-deps

  const toWorld = (cx: number, cy: number) => {
    const r = canvas.current!.getBoundingClientRect();
    const v = state.current.view;
    return { x: (cx - r.left - r.width / 2 - v.x) / v.k, y: (cy - r.top - r.height / 2 - v.y) / v.k };
  };
  const hit = (cx: number, cy: number) => {
    const p = toWorld(cx, cy);
    const extra = 6 / state.current.view.k;
    return state.current.nodes.find((n) => (n.x - p.x) ** 2 + (n.y - p.y) ** 2 < (9 + Math.min(n.deg, 12) * 1.2 + extra) ** 2);
  };
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const s = state.current;
    const r = canvas.current!.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left - r.width / 2, py = (cy ?? r.top + r.height / 2) - r.top - r.height / 2;
    const k = Math.min(4, Math.max(0.12, s.view.k * factor));
    s.view = { k, x: px - ((px - s.view.x) / s.view.k) * k, y: py - ((py - s.view.y) / s.view.k) * k };
  };
  const fit = () => {
    const s = state.current;
    if (!s.nodes.length) return void (s.view = { x: 0, y: 0, k: 1 });
    const r = canvas.current!.getBoundingClientRect();
    const xs = s.nodes.map((n) => n.x), ys = s.nodes.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const k = Math.min(2, Math.max(0.12, Math.min((r.width - 120) / (maxX - minX || 1), (r.height - 120) / (maxY - minY || 1))));
    s.view = { k, x: -((minX + maxX) / 2) * k, y: -((minY + maxY) / 2) * k };
  };

  // Painel do nó selecionado
  const selPage = selId && !selId.startsWith('tag:') ? pages[selId] : null;
  const info = useMemo(() => {
    if (!selPage) return null;
    const out = edges.filter((e) => e.a === selPage.id && (e.kind === 'link' || e.kind === 'board' || e.kind === 'data')).map((e) => pages[e.b]).filter(Boolean);
    const inc = edges.filter((e) => e.b === selPage.id && (e.kind === 'link' || e.kind === 'board' || e.kind === 'data')).map((e) => pages[e.a]).filter(Boolean);
    const linkedIds = new Set([...out, ...inc].map((p) => p.id));
    const sugg = [
      ...unlinkedMentions(all, selPage).map((p) => ({ page: p, why: 'mention' as const })),
      ...relatedPages(all, selPage, 5).filter((r) => r.score > 0.1).map((r) => ({ page: r.page, why: 'related' as const })),
    ].filter((x, i, arr) => !linkedIds.has(x.page.id) && arr.findIndex((y) => y.page.id === x.page.id) === i).slice(0, 6);
    return { out, inc, sugg };
  }, [selPage, edges, pages]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Cria o link de verdade: acrescenta [[destino]] ao fim da página de origem. */
  const connect = (from: Page, to: Page) => {
    if (from.type !== 'page') return toast(t('graph.connectOnlyPages'), 'info');
    const content = from.content?.type === 'doc' ? from.content : { type: 'doc', content: [] };
    const para = { type: 'paragraph', content: [{ type: 'text', text: '→ ' }, { type: 'pageLink', attrs: { id: to.id, label: to.title || '' } }] };
    updatePage(from.id, { content: { ...content, content: [...(content.content || []), para] } });
    toast(t('graph.connected', { a: from.title || '…', b: to.title || '…' }), 'success');
  };

  return (
    <div className="graph-page">
      <div className="graph-bar">
        <div className="eyebrow"><Network size={13} /> {t('nav.graph')}</div>
        <div className="db-search"><Search size={15} /><input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Switch checked={hier} onChange={setHier} label={t('graph.hierarchy')} />
        <Switch checked={mentions} onChange={setMentions} label={<><Link2 size={13} /> {t('graph.mentions')}</>} />
        <Switch checked={similar} onChange={setSimilar} label={<><Sparkles size={13} /> {t('graph.similar')}</>} />
        <Switch checked={tags} onChange={setTags} label={<><Tags size={13} /> {t('graph.tags')}</>} />
        <Switch checked={orphans} onChange={setOrphans} label={t('graph.orphans')} />
        <div className="seg sm">
          <button className={colorBy === 'type' ? 'on' : ''} onClick={() => setColorBy('type')}><Palette size={13} /> {t('graph.byType')}</button>
          <button className={colorBy === 'group' ? 'on' : ''} onClick={() => setColorBy('group')}>{t('graph.byGroup')}</button>
        </div>
        <button ref={colorsRef} className="btn ghost sm" onClick={() => setColorsOpen(!colorsOpen)}><Palette size={14} /> {t('graph.colors')}</button>
        <Popover anchor={colorsRef.current} open={colorsOpen} onClose={() => setColorsOpen(false)}>
          <div className="stack pad graph-colors" style={{ width: 260 }}>
            {(['link', 'board', 'child', 'suggestion'] as const).map((k) => (
              <label key={k} className="row">
                <input type="color" className="color-input" value={gc[k] || '#8b5cf6'} onChange={(e) => setPrefs({ graphColors: { ...gc, [k]: e.target.value } })} />
                <span className="grow">{t(`graph.kind.${k}` as TKey)}</span>
                {gc[k] && <button className="icon-btn xs" onClick={() => { const n = { ...gc }; delete n[k]; setPrefs({ graphColors: n }); }}><X size={12} /></button>}
              </label>
            ))}
            <div className="field-label">{t('graph.thickness')}</div>
            <div className="seg sm">
              {[1, 1.6, 2.4].map((w) => <button key={w} className={(gc.width || 1) === w ? 'on' : ''} onClick={() => setPrefs({ graphColors: { ...gc, width: w } })}>{w === 1 ? t('graph.thin') : w === 1.6 ? t('graph.medium') : t('graph.thick')}</button>)}
            </div>
            <button className="btn ghost sm" onClick={() => setPrefs({ graphColors: {} })}>{t('graph.themeColors')}</button>
          </div>
        </Popover>
        <div className="grow" />
        <div className="graph-stats muted small">{t('graph.stats', { n: stats.nodes, l: stats.links, s: stats.suggestions, g: stats.groups })}</div>
      </div>
      <div className="graph-area">
        <canvas
          ref={canvas}
          onPointerDown={(e) => {
            const n = hit(e.clientX, e.clientY);
            const s = state.current;
            const sx = e.clientX, sy = e.clientY, ov = { ...s.view };
            let moved = false;
            if (n) s.drag = n;
            const move = (ev: PointerEvent) => {
              moved = moved || Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4;
              if (s.drag) {
                const p = toWorld(ev.clientX, ev.clientY);
                s.drag.x = p.x; s.drag.y = p.y; s.alpha = Math.max(s.alpha, 0.3);
              } else s.view = { ...ov, x: ov.x + ev.clientX - sx, y: ov.y + ev.clientY - sy };
            };
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              if (!moved) setSelId(n ? n.id : null);
              s.drag = null;
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          onDoubleClick={(e) => {
            const n = hit(e.clientX, e.clientY);
            if (n?.page) go({ name: 'page', id: n.page.id });
            else if (n?.tag) setQ(n.tag);
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'touch') return;
            const n = hit(e.clientX, e.clientY) || null;
            state.current.hover = n;
            (e.target as HTMLElement).style.cursor = n ? 'pointer' : 'grab';
          }}
          onPointerLeave={() => (state.current.hover = null)}
          onWheel={(e) => zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX, e.clientY)}
        />
        {!nodes.length && <div className="canvas-hint">{t('graph.empty')}</div>}
        <div className="graph-help muted small">{t('graph.help')}</div>
        <div className="graph-legend">
          <span><i className="lg-line" style={gc.link ? { borderTopColor: gc.link } : undefined} /> {t('graph.kind.link')}</span>
          <span><i className="lg-line board" style={gc.board ? { borderTopColor: gc.board } : undefined} /> {t('graph.kind.board')}</span>
          <span><i className="lg-line dash" style={gc.child ? { borderTopColor: gc.child } : undefined} /> {t('graph.kind.child')}</span>
          <span><i className="lg-line dot" style={gc.suggestion ? { borderTopColor: gc.suggestion } : undefined} /> {t('graph.kind.suggestion')}</span>
        </div>
        {focus && (
          <div className="graph-focus">
            <Crosshair size={14} /> {t('graph.focusOn', { t: pages[focus.id]?.title || '…' })}
            <div className="seg sm">
              {[1, 2, 3].map((d) => <button key={d} className={focus.depth === d ? 'on' : ''} onClick={() => setFocus({ ...focus, depth: d })}>{d}</button>)}
            </div>
            <button className="icon-btn xs" onClick={() => setFocus(null)}><X size={13} /></button>
          </div>
        )}
        {selPage && info && (
          <div className="graph-panel">
            <div className="graph-panel-head">
              <PageIcon icon={selPage.icon} size={20} />
              <b className="grow ellipsis">{selPage.title || t('page.untitled')}</b>
              <button className="icon-btn xs" onClick={() => setSelId(null)}><X size={14} /></button>
            </div>
            <div className="row">
              <button className="btn primary sm" onClick={() => go({ name: 'page', id: selPage.id })}><ArrowUpRight size={14} /> {t('db.open')}</button>
              <button className="btn ghost sm" onClick={() => setFocus({ id: selPage.id, depth: 1 })}><Crosshair size={14} /> {t('graph.focus')}</button>
            </div>
            <div className="graph-panel-stats">
              <span><b>{info.out.length}</b> {t('graph.outgoing')}</span>
              <span><b>{info.inc.length}</b> {t('graph.incoming')}</span>
            </div>
            {[...info.out, ...info.inc].length > 0 && (
              <div className="graph-panel-list">
                {[...new Map([...info.out, ...info.inc].map((p) => [p.id, p])).values()].slice(0, 12).map((p) => (
                  <button key={p.id} className="menu-item" onClick={() => setSelId(p.id)}><PageIcon icon={p.icon} size={14} /> <span className="ellipsis">{p.title || t('page.untitled')}</span></button>
                ))}
              </div>
            )}
            {info.sugg.length > 0 && (
              <>
                <div className="section-label"><Sparkles size={11} /> {t('graph.suggestions')}</div>
                <div className="graph-panel-list">
                  {info.sugg.map(({ page: p, why }) => (
                    <div key={p.id} className="graph-sugg">
                      <button className="grow ellipsis" onClick={() => setSelId(p.id)}><PageIcon icon={p.icon} size={14} /> {p.title || t('page.untitled')}</button>
                      <small className="muted">{t(`graph.why.${why}` as TKey)}</small>
                      <button className="btn ghost xs" onClick={() => (why === 'mention' ? connect(p, selPage) : connect(selPage, p))}><Link2 size={12} /> {t('graph.connect')}</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div className="canvas-zoom graph-zoom">
          <button className="tb" onClick={fit} title={t('canvas.fit')}><Maximize size={16} /></button>
          <button className="tb" onClick={() => zoomAt(0.8)}><Minus size={16} /></button>
          <button className="tb" onClick={() => zoomAt(1.25)}><Plus size={16} /></button>
        </div>
      </div>
    </div>
  );
}
