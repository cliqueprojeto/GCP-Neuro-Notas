import { useEffect, useMemo, useRef, useState } from 'react';
import { Network, Search, Sparkles } from 'lucide-react';
import { useT } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi } from '../store/ui';
import { usePrefs } from '../store/prefs';
import { getTheme } from '../lib/themes';
import { normalize, outgoingLinks } from '../lib/doc';
import { relatedPages } from '../ai/brain';
import { Switch } from './ui';
import type { Page } from '../lib/types';

interface N { id: string; page: Page; x: number; y: number; vx: number; vy: number; deg: number }
interface E { a: string; b: string; kind: 'link' | 'child' | 'related' }

const TYPE_COLORS: Record<string, string> = { page: '#8b5cf6', database: '#14b8a6', report: '#ec4899', canvas: '#3b82f6' };

/** Grafo de conhecimento interativo (links, hierarquia e similaridade). */
export function Graph() {
  const t = useT();
  const pages = useVault((s) => s.pages);
  const go = useUi((s) => s.go);
  const theme = usePrefs((s) => s.theme);
  const [q, setQ] = useState('');
  const [hier, setHier] = useState(true);
  const [similar, setSimilar] = useState(false);
  const [orphans, setOrphans] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ nodes: [] as N[], edges: [] as E[], view: { x: 0, y: 0, k: 1 }, drag: null as N | null, hover: null as N | null, alpha: 1 });

  const all = livePages(pages);
  const { nodes, edges } = useMemo(() => {
    const edges: E[] = [];
    const ids = new Set(all.map((p) => p.id));
    for (const p of all) {
      for (const l of outgoingLinks(p)) if (ids.has(l)) edges.push({ a: p.id, b: l, kind: 'link' });
      if (hier && p.parentId && ids.has(p.parentId)) edges.push({ a: p.parentId, b: p.id, kind: 'child' });
    }
    if (similar) for (const p of all.filter((x) => x.type === 'page').slice(0, 150)) for (const r of relatedPages(all, p, 2)) if (r.score > 0.15) edges.push({ a: p.id, b: r.page.id, kind: 'related' });
    const deg = new Map<string, number>();
    edges.forEach((e) => (deg.set(e.a, (deg.get(e.a) || 0) + 1), deg.set(e.b, (deg.get(e.b) || 0) + 1)));
    const prev = new Map(state.current.nodes.map((n) => [n.id, n]));
    const nodes: N[] = all
      .filter((p) => orphans || deg.get(p.id))
      .map((p, i) => {
        const o = prev.get(p.id);
        const a = (i / Math.max(all.length, 1)) * Math.PI * 2;
        return { id: p.id, page: p, x: o?.x ?? Math.cos(a) * 220 + Math.random() * 20, y: o?.y ?? Math.sin(a) * 220 + Math.random() * 20, vx: 0, vy: 0, deg: deg.get(p.id) || 0 };
      });
    return { nodes, edges };
  }, [pages, hier, similar, orphans]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    state.current.nodes = nodes;
    state.current.edges = edges;
    state.current.alpha = 1;
  }, [nodes, edges]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    const dark = getTheme(theme).dark;
    const css = getComputedStyle(document.documentElement);
    const text = css.getPropertyValue('--text').trim() || '#fff';
    const muted = css.getPropertyValue('--muted').trim() || '#999';
    const accent = css.getPropertyValue('--accent').trim() || '#8b5cf6';
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

    const tick = () => {
      const s = state.current;
      const { nodes, edges } = s;
      const byId = new Map(nodes.map((n) => [n.id, n]));
      if (s.alpha > 0.005) {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 1) (dx = Math.random()), (dy = Math.random()), (d2 = 1);
            if (d2 > 250000) continue;
            const f = (1800 / d2) * s.alpha;
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
          const target = e.kind === 'child' ? 90 : 120;
          const f = ((d - target) / d) * 0.04 * s.alpha;
          a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
        }
        for (const n of nodes) {
          n.vx -= n.x * 0.002 * s.alpha;
          n.vy -= n.y * 0.002 * s.alpha;
          if (n !== s.drag) { n.x += n.vx; n.y += n.vy; }
          n.vx *= 0.82; n.vy *= 0.82;
        }
        s.alpha *= 0.992;
      }
      // desenho
      const W = cv.width, H = cv.height, dpr = devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(s.view.k * dpr, 0, 0, s.view.k * dpr, W / 2 + s.view.x * dpr, H / 2 + s.view.y * dpr);
      const qn = normalize(q);
      const focus = s.hover;
      const neighbors = new Set<string>();
      if (focus) edges.forEach((e) => (e.a === focus.id ? neighbors.add(e.b) : e.b === focus.id ? neighbors.add(e.a) : 0));
      for (const e of edges) {
        const a = byId.get(e.a), b = byId.get(e.b);
        if (!a || !b) continue;
        const hot = focus && (e.a === focus.id || e.b === focus.id);
        ctx.strokeStyle = hot ? accent : dark ? 'rgba(160,165,220,0.22)' : 'rgba(60,60,110,0.18)';
        ctx.lineWidth = (hot ? 2 : 1) / s.view.k;
        ctx.setLineDash(e.kind === 'child' ? [4 / s.view.k, 4 / s.view.k] : e.kind === 'related' ? [1 / s.view.k, 3 / s.view.k] : []);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const n of nodes) {
        const r = 5 + Math.min(n.deg, 12) * 1.2;
        const match = qn && normalize(n.page.title || '').includes(qn);
        const dim = (focus && n !== focus && !neighbors.has(n.id)) || (qn && !match);
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.fillStyle = TYPE_COLORS[n.page.type] || accent;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (match || n === focus) {
          ctx.strokeStyle = text;
          ctx.lineWidth = 2 / s.view.k;
          ctx.stroke();
        }
        if (s.view.k > 0.6 || n === focus || n.deg > 3 || match) {
          ctx.fillStyle = n === focus ? text : muted;
          ctx.font = `${12 / Math.max(s.view.k, 0.8)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText((n.page.icon && !n.page.icon.startsWith('lucide') && !n.page.icon.startsWith('data') ? n.page.icon + ' ' : '') + (n.page.title || '…').slice(0, 32), n.x, n.y + r + 13 / s.view.k);
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => (cancelAnimationFrame(raf), ro.disconnect());
  }, [theme, q]);

  const toWorld = (cx: number, cy: number) => {
    const r = canvas.current!.getBoundingClientRect();
    const v = state.current.view;
    return { x: (cx - r.left - r.width / 2 - v.x) / v.k, y: (cy - r.top - r.height / 2 - v.y) / v.k };
  };
  const hit = (cx: number, cy: number) => {
    const p = toWorld(cx, cy);
    return state.current.nodes.find((n) => (n.x - p.x) ** 2 + (n.y - p.y) ** 2 < (9 + Math.min(n.deg, 12) * 1.2) ** 2);
  };

  return (
    <div className="graph-page">
      <div className="graph-bar">
        <div className="eyebrow"><Network size={13} /> {t('nav.graph')}</div>
        <div className="db-search"><Search size={15} /><input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Switch checked={hier} onChange={setHier} label={t('graph.hierarchy')} />
        <Switch checked={similar} onChange={setSimilar} label={<><Sparkles size={13} /> {t('graph.similar')}</>} />
        <Switch checked={orphans} onChange={setOrphans} label={t('graph.orphans')} />
        <div className="grow" />
        <div className="legend">
          {Object.entries(TYPE_COLORS).map(([k, c]) => <span key={k}><i style={{ background: c }} />{t(`new.${k === 'page' ? 'page' : k}` as any)}</span>)}
        </div>
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
              if (n && !moved) go({ name: 'page', id: n.id });
              s.drag = null;
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
          onPointerMove={(e) => {
            const n = hit(e.clientX, e.clientY) || null;
            state.current.hover = n;
            (e.target as HTMLElement).style.cursor = n ? 'pointer' : 'grab';
          }}
          onWheel={(e) => {
            const v = state.current.view;
            const k = Math.min(4, Math.max(0.15, v.k * (e.deltaY < 0 ? 1.1 : 0.9)));
            state.current.view = { ...v, k };
          }}
        />
        {!nodes.length && <div className="canvas-hint">{t('graph.empty')}</div>}
        <div className="graph-help muted small">{t('graph.help')}</div>
      </div>
    </div>
  );
}
