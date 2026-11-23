import type { ViewType } from '../lib/types';

export const EMBED_TYPES: ViewType[] = ['table', 'board', 'gallery', 'list', 'calendar', 'timeline', 'gantt', 'map', 'files'];

/** Miniatura ilustrada de cada tipo de visão (prévia no seletor). */
export function ViewPreview({ type }: { type: ViewType }) {
  const a = 'var(--accent)', m = 'color-mix(in srgb, var(--muted) 55%, transparent)', s = 'color-mix(in srgb, var(--muted) 25%, transparent)';
  const box = (children: React.ReactNode) => <svg viewBox="0 0 120 72" className="vp-svg">{children}</svg>;
  switch (type) {
    case 'table':
      return box(<>{[0, 1, 2, 3].map((r) => <g key={r}><rect x="6" y={8 + r * 15} width="108" height="12" rx="2" fill={r ? s : a} opacity={r ? 1 : .5} />{r > 0 && <><rect x="10" y={12 + r * 15} width="30" height="4" rx="2" fill={m} /><rect x="48" y={12 + r * 15} width="20" height="4" rx="2" fill={m} /><rect x="80" y={12 + r * 15} width="26" height="4" rx="2" fill={m} /></>}</g>)}</>);
    case 'board':
      return box(<>{[0, 1, 2].map((c) => <g key={c}><rect x={6 + c * 38} y="6" width="32" height="60" rx="5" fill={s} />{[0, 1, 2 - c].filter((x) => x >= 0).map((k) => <rect key={k} x={9 + c * 38} y={14 + k * 15} width="26" height="11" rx="3" fill={k === 0 && c === 1 ? a : 'var(--panel)'} stroke={m} strokeWidth=".6" />)}</g>)}</>);
    case 'gallery':
      return box(<>{[0, 1, 2, 3, 4, 5].map((i) => <g key={i}><rect x={6 + (i % 3) * 37} y={6 + Math.floor(i / 3) * 32} width="33" height="28" rx="4" fill="var(--panel)" stroke={m} strokeWidth=".6" /><rect x={6 + (i % 3) * 37} y={6 + Math.floor(i / 3) * 32} width="33" height="16" rx="4" fill={i === 1 ? a : s} opacity={i === 1 ? .6 : 1} /></g>)}</>);
    case 'list':
      return box(<>{[0, 1, 2, 3, 4].map((r) => <g key={r}><circle cx="11" cy={11 + r * 13} r="3" fill={r === 0 ? a : m} /><rect x="18" y={9 + r * 13} width={70 - r * 8} height="4" rx="2" fill={m} /><rect x="96" y={9 + r * 13} width="18" height="4" rx="2" fill={s} /></g>)}</>);
    case 'calendar':
      return box(<>{Array.from({ length: 21 }, (_, i) => <rect key={i} x={6 + (i % 7) * 15.6} y={8 + Math.floor(i / 7) * 20} width="14" height="18" rx="2" fill={i === 9 ? a : s} opacity={i === 9 ? .7 : 1} />)}<rect x="22" y="31" width="40" height="4" rx="2" fill={a} /></>);
    case 'timeline':
      return box(<>{[0, 1, 2, 3].map((r) => <rect key={r} x={8 + r * 18} y={10 + r * 14} width={44 + (r % 2) * 18} height="9" rx="4.5" fill={r === 1 ? a : m} opacity={r === 1 ? .8 : .7} />)}<line x1="60" y1="4" x2="60" y2="68" stroke={a} strokeDasharray="2 2" /></>);
    case 'gantt':
      return box(<>{[0, 1, 2, 3].map((r) => <g key={r}><rect x="6" y={10 + r * 14} width="26" height="5" rx="2" fill={m} /><rect x={38 + r * 14} y={9 + r * 14} width={30 + (r % 2) * 14} height="8" rx="2" fill={r === 2 ? a : s} /></g>)}</>);
    case 'map':
      return box(<><rect x="4" y="4" width="112" height="64" rx="6" fill={s} /><path d="M4 40 C30 30 50 55 80 38 S110 30 116 34" stroke={m} fill="none" strokeWidth="2" /><path d="M40 20 a7 7 0 1 1 14 0 c0 6-7 13-7 13 s-7-7-7-13z" fill={a} /><circle cx="86" cy="50" r="4" fill={a} opacity=".6" /></>);
    case 'files':
      return box(<>{[0, 1, 2, 3].map((i) => <g key={i}><rect x={8 + i * 27} y="14" width="22" height="30" rx="3" fill="var(--panel)" stroke={m} /><rect x={12 + i * 27} y="50" width="14" height="4" rx="2" fill={i === 0 ? a : m} /></g>)}</>);
  }
  return null;
}

