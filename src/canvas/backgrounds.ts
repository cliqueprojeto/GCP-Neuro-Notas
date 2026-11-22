import type { CSSProperties } from 'react';
import type { CanvasBg, EdgeDash } from '../lib/types';

/** Temas de fundo para quadros e apresentações. `dark` define a cor da tinta usada sobre o fundo. */
export interface BgTheme { id: string; base: string; layer?: string; dark: boolean }
export const BG_THEMES: BgTheme[] = [
  { id: 'default', base: '', dark: false },
  { id: 'white', base: '#ffffff', dark: false },
  { id: 'paper', base: '#faf7f0', dark: false },
  { id: 'sky', base: '#eef6ff', layer: 'linear-gradient(160deg, #f8fbff 0%, #e3efff 100%)', dark: false },
  { id: 'blush', base: '#fdf2f8', layer: 'linear-gradient(135deg, #fdf2f8 0%, #eef2ff 100%)', dark: false },
  { id: 'mint', base: '#ecfdf5', layer: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)', dark: false },
  { id: 'sunset', base: '#fff1eb', layer: 'linear-gradient(135deg, #fff1eb 0%, #ffd9c7 45%, #e9e4ff 100%)', dark: false },
  { id: 'slate', base: '#0f172a', dark: true },
  { id: 'graphite', base: '#18181b', layer: 'radial-gradient(120% 80% at 50% 0%, #27272a 0%, #18181b 70%)', dark: true },
  { id: 'midnight', base: '#0b1026', layer: 'linear-gradient(135deg, #0b1026 0%, #1e1b4b 100%)', dark: true },
  { id: 'aurora', base: '#0a0f24', layer: 'radial-gradient(60% 50% at 15% 10%, rgba(139,92,246,.35) 0%, transparent 70%), radial-gradient(50% 45% at 90% 85%, rgba(56,189,248,.30) 0%, transparent 70%), linear-gradient(#0a0f24, #0a0f24)', dark: true },
  { id: 'chalk', base: '#1f3a2e', layer: 'radial-gradient(120% 90% at 50% 40%, #27493a 0%, #1a3127 100%)', dark: true },
  { id: 'blueprint', base: '#123a6b', layer: 'linear-gradient(#123a6b, #0f3260)', dark: true },
];
export const themeOf = (bg?: CanvasBg) => BG_THEMES.find((x) => x.id === (bg?.theme || 'default')) || BG_THEMES[0];

const INK_DARK = { '--text': '#eef0ff', '--muted': '#a3a9d1', '--border': 'rgba(255,255,255,.14)' };
const INK_LIGHT = { '--text': '#1f2433', '--muted': '#6b7085', '--border': 'rgba(15,23,42,.12)' };

/** Estilo da área (tinta e cor-base) e da camada de fundo (tema/imagem + padrão), com o padrão acompanhando o zoom. */
export function bgStyles(bg: CanvasBg | undefined, vx: number, vy: number, zoom: number, presenting: boolean) {
  const th = themeOf(bg);
  const custom = th.id !== 'default' || !!bg?.image;
  const dark = bg?.image ? bg.imageDark ?? true : th.dark;
  const area: CSSProperties = custom ? { ...(dark ? INK_DARK : INK_LIGHT), backgroundColor: th.base || 'var(--bg)', ['--canvas-bg' as any]: th.base || 'var(--bg)' } : { ['--canvas-bg' as any]: 'var(--bg)' };
  if (presenting && !custom) area.backgroundColor = 'transparent';
  const pattern = presenting ? 'none' : bg?.pattern || 'dots';
  const ink = dark ? 'rgba(255,255,255,.16)' : 'rgba(15,23,42,.13)';
  const s = 24 * zoom;
  const layers: string[] = [], sizes: string[] = [], pos: string[] = [], rep: string[] = [];
  if (pattern === 'dots') layers.push(`radial-gradient(circle, ${ink} 1px, transparent 1.3px)`), sizes.push(`${s}px ${s}px`), pos.push(`${vx}px ${vy}px`), rep.push('repeat');
  if (pattern === 'grid') {
    layers.push(`linear-gradient(${ink} 1px, transparent 1px)`, `linear-gradient(90deg, ${ink} 1px, transparent 1px)`);
    sizes.push(`${s}px ${s}px`, `${s}px ${s}px`); pos.push(`${vx}px ${vy}px`, `${vx}px ${vy}px`); rep.push('repeat', 'repeat');
  }
  if (pattern === 'lines') layers.push(`linear-gradient(${ink} 1px, transparent 1px)`), sizes.push(`${s * 1.4}px ${s * 1.4}px`), pos.push(`${vx}px ${vy}px`), rep.push('repeat');
  const backdrop: CSSProperties = {};
  if (layers.length) Object.assign(backdrop, { backgroundImage: layers.join(', '), backgroundSize: sizes.join(', '), backgroundPosition: pos.join(', '), backgroundRepeat: rep.join(', ') });
  // a imagem/tema fica numa camada própria, presa à tela (não ao zoom): nunca "quebra" com o tamanho da janela ou do projetor
  const photo: CSSProperties | null = bg?.image
    ? { backgroundImage: `url("${bg.image}")`, backgroundSize: bg.fit === 'contain' ? 'contain' : bg.fit === 'tile' ? `${Math.max(120, 360 * Math.sqrt(zoom))}px auto` : 'cover', backgroundRepeat: bg.fit === 'tile' ? 'repeat' : 'no-repeat', backgroundPosition: bg.fit === 'tile' ? `${vx}px ${vy}px` : `${bg.focusX ?? 50}% ${bg.focusY ?? 50}%` }
    : th.layer ? { backgroundImage: th.layer } : null;
  return { area, backdrop, photo, dim: bg?.image ? bg.dim ?? 0.25 : 0, dark };
}

export const BG_PATTERNS = ['dots', 'grid', 'lines', 'none'] as const;

/* ---------- Estilos de conector ---------- */
export const EDGE_DASHES: EdgeDash[] = ['solid', 'dashed', 'dotted', 'dashdot', 'zigzag', 'wave', 'double', 'glow'];
export const EDGE_WIDTHS = [1, 2, 3, 5, 8];

export function dashArray(dash: EdgeDash | undefined, w: number): string | undefined {
  if (dash === 'dashed') return `${w * 4} ${w * 3}`;
  if (dash === 'dotted') return `0 ${w * 2.4}`;
  if (dash === 'dashdot') return `${w * 5} ${w * 2.5} 0 ${w * 2.5}`;
  return undefined;
}

let probe: SVGPathElement | null = null;
const cache = new Map<string, string>();
/** Converte qualquer caminho (reto, cotovelo ou curva) em serrilhado ou ondulado, amostrando ao longo do comprimento. */
export function wigglePath(d: string, kind: 'zigzag' | 'wave', w: number): string {
  const key = kind + w + d;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return d;
  if (!probe) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute'; svg.style.visibility = 'hidden';
    probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(probe); document.body.appendChild(svg);
  }
  probe.setAttribute('d', d);
  const len = probe.getTotalLength();
  const step = 7 + w * 2, amp = 3.5 + w * 1.2;
  const n = Math.max(2, Math.round(len / step));
  const pts: string[] = [];
  const end = 10; // trecho final reto para a ponta de seta assentar
  for (let i = 0; i <= n; i++) {
    const l = Math.min(len, (i / n) * len);
    const p = probe.getPointAtLength(l);
    const q = probe.getPointAtLength(Math.min(len, l + 0.5)), r = probe.getPointAtLength(Math.max(0, l - 0.5));
    const tx = q.x - r.x, ty = q.y - r.y, tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl, ny = tx / tl;
    const flat = l < end || len - l < end;
    const o = flat ? 0 : kind === 'zigzag' ? (i % 2 ? amp : -amp) : Math.sin((l / step) * Math.PI) * amp;
    pts.push(`${(p.x + nx * o).toFixed(1)} ${(p.y + ny * o).toFixed(1)}`);
  }
  let out: string;
  if (kind === 'zigzag') out = 'M' + pts.join(' L');
  else out = 'M' + pts[0] + pts.slice(1).map((p) => ' L' + p).join('');
  if (cache.size > 400) cache.clear();
  cache.set(key, out);
  return out;
}
