import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle, Diamond, Eraser, FileText, Frame, Hand, ImagePlus, Maximize, Minus, MousePointer2, PenLine, Plus, Spline, Square, StickyNote,
  Trash2, Triangle, Type, Undo2, Waypoints, CornerDownRight, Slash, Presentation, MoveRight, MoveHorizontal, Minus as LineIcon, Tag, Link2, MousePointerClick, BarChart3, Sparkle,
} from 'lucide-react';
import { Presenter, PresentSettings, PresentPage } from './Presenter';
import { ButtonView, LinkPicker, followLink, linkLabel, newButton, type ButtonItem } from '../editor/components';
import { Chart } from '../reports/ReportView';
import { Select } from '../components/ui';
import type { CanvasData, CanvasEdge, CanvasNode, Page, Side } from '../lib/types';
import { useT } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi } from '../store/ui';
import { uid } from '../lib/crypto';
import { pickImages } from '../lib/platform';
import { PageIcon, Popover } from '../components/ui';
import { normalize } from '../lib/doc';
import { pageToHtml } from '../lib/transfer';
import { askConfirm, askText } from '../components/PromptHost';

type Tool = 'select' | 'hand' | 'pen' | 'eraser' | 'connector' | 'frame' | 'text' | 'note' | 'shape';
type ShapeKind = NonNullable<CanvasNode['shape']>;

const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#e2e8f0', '#1e293b'];
const INK = ['#1f2937', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
const EMPTY: CanvasData = { nodes: [], edges: [], view: { x: 0, y: 0, zoom: 1 } };

type Snap = { id: string; side: Side; x: number; y: number };

/** Sem molduras: visão geral + um enquadramento para cada grupo de elementos ligados ou próximos. */
function autoSlides(nodes: CanvasNode[], edges: CanvasEdge[], overview: string): CanvasNode[] {
  const items = nodes.filter((n) => n.kind !== 'frame');
  if (!items.length) return [];
  const parent = new Map(items.map((n) => [n.id, n.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  const join = (a: string, b: string) => parent.has(a) && parent.has(b) && parent.set(find(a), find(b));
  for (const e of edges) join(e.from, e.to);
  const gap = 60;
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h) join(a.id, b.id);
    }
  const groups = new Map<string, CanvasNode[]>();
  for (const n of items) groups.set(find(n.id), [...(groups.get(find(n.id)) || []), n]);
  const box = (list: CanvasNode[], id: string, text: string): CanvasNode => {
    const x = Math.min(...list.map((n) => n.x)), y = Math.min(...list.map((n) => n.y));
    return { id, kind: 'frame', x: x - 30, y: y - 30, w: Math.max(...list.map((n) => n.x + n.w)) - x + 60, h: Math.max(...list.map((n) => n.y + n.h)) - y + 60, color: 'transparent', text };
  };
  const clusters = [...groups.values()].sort((a, b) => Math.min(...a.map((n) => n.y)) - Math.min(...b.map((n) => n.y)) || Math.min(...a.map((n) => n.x)) - Math.min(...b.map((n) => n.x)));
  const out = [box(items, 'auto-0', overview)];
  if (clusters.length > 1) clusters.forEach((c, i) => out.push(box(c, `auto-${i + 1}`, c.find((n) => n.text)?.text?.split('\n')[0].slice(0, 40) || '')));
  return out;
}

const nodeButton = (n: CanvasNode): ButtonItem => ({
  ...newButton(n.text || ''),
  id: n.id,
  color: n.color && n.color !== '#ffffff' ? n.color : '#7c3aed',
  variant: (n.button?.variant as ButtonItem['variant']) || 'gradient',
  shape: (n.button?.shape as ButtonItem['shape']) || 'pill',
  size: 'md',
  full: true,
  link: n.link || { type: 'none', target: '' },
});
const SIDES: Side[] = ['t', 'r', 'b', 'l'];
const DIR: Record<Side, { x: number; y: number }> = { t: { x: 0, y: -1 }, r: { x: 1, y: 0 }, b: { x: 0, y: 1 }, l: { x: -1, y: 0 } };

export function sidePoint(n: CanvasNode, s: Side) {
  if (s === 't') return { x: n.x + n.w / 2, y: n.y };
  if (s === 'b') return { x: n.x + n.w / 2, y: n.y + n.h };
  if (s === 'l') return { x: n.x, y: n.y + n.h / 2 };
  return { x: n.x + n.w, y: n.y + n.h / 2 };
}
function nearestSide(n: CanvasNode, p: { x: number; y: number }): Side {
  let best: Side = 'r', bd = Infinity;
  for (const s of SIDES) {
    const q = sidePoint(n, s);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) (bd = d), (best = s);
  }
  return best;
}
const oppositeSide = (s: Side): Side => ({ t: 'b', b: 't', l: 'r', r: 'l' } as const)[s];
/** Lados automáticos para um conector sem lados fixos (o par mais curto). */
function autoSides(a: CanvasNode, b: CanvasNode): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) * (a.h + b.h) >= Math.abs(dy) * (a.w + b.w)) return dx >= 0 ? ['r', 'l'] : ['l', 'r'];
  return dy >= 0 ? ['b', 't'] : ['t', 'b'];
}
function edgePath(p1: { x: number; y: number }, s1: Side, p2: { x: number; y: number }, s2: Side, style: CanvasEdge['style']) {
  const d1 = DIR[s1], d2 = DIR[s2];
  if (style === 'curve') {
    const k = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.4);
    return `M${p1.x},${p1.y} C${p1.x + d1.x * k},${p1.y + d1.y * k} ${p2.x + d2.x * k},${p2.y + d2.y * k} ${p2.x},${p2.y}`;
  }
  if (style === 'elbow') {
    const g = 24;
    const a = { x: p1.x + d1.x * g, y: p1.y + d1.y * g }, b = { x: p2.x + d2.x * g, y: p2.y + d2.y * g };
    const h1 = d1.x !== 0, h2 = d2.x !== 0;
    let mid: string;
    if (h1 && h2) { const mx = (a.x + b.x) / 2; mid = `L${mx},${a.y} L${mx},${b.y}`; }
    else if (!h1 && !h2) { const my = (a.y + b.y) / 2; mid = `L${a.x},${my} L${b.x},${my}`; }
    else if (h1) mid = `L${b.x},${a.y}`;
    else mid = `L${a.x},${b.y}`;
    return `M${p1.x},${p1.y} L${a.x},${a.y} ${mid} L${b.x},${b.y} L${p2.x},${p2.y}`;
  }
  return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
}

/**
 * Modo Quadro (estilo "edgeless"): tela infinita com caneta, borracha, molduras,
 * formas, textos, notas adesivas, páginas incorporadas e conectores.
 */
export function CanvasView({ page, embedSelf = false }: { page: Page; embedSelf?: boolean }) {
  const t = useT();
  const update = useVault((s) => s.updatePage);
  const pages = useVault((s) => s.pages);
  const initial = useMemo<CanvasData>(() => {
    const c = page.canvas || EMPTY;
    // Ao abrir uma página comum no modo Quadro, o próprio documento vira um cartão.
    if (embedSelf && !c.nodes.some((n) => n.pageId === page.id)) {
      return { ...c, nodes: [{ id: uid('n'), kind: 'page', pageId: page.id, x: 80, y: 80, w: 460, h: 380, color: '#ffffff' }, ...c.nodes] };
    }
    return c;
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [local, setLocal] = useState<CanvasData>(initial);
  const [tool, setTool] = useState<Tool>('select');
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rect');
  const [edgeStyle, setEdgeStyle] = useState<CanvasEdge['style']>('curve');
  const [ink, setInk] = useState('#8b5cf6');
  const [penSize, setPenSize] = useState(3);
  const [sel, setSel] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState<
    | { kind: 'link'; from: string; fromSide?: Side; x: number; y: number; snap?: Snap | null }
    | { kind: 'relink'; edge: string; end: 'from' | 'to'; x: number; y: number; snap?: Snap | null }
    | { kind: 'pen'; pts: number[] }
    | { kind: 'frame'; x: number; y: number; w: number; h: number }
    | null
  >(null);
  const [presenting, setPresenting] = useState(false);
  const [slide, setSlide] = useState(0);
  const savedView = useRef<CanvasData['view'] | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [animOpen, setAnimOpen] = useState(false);
  const animRef = useRef<HTMLButtonElement>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const linkRef = useRef<HTMLButtonElement>(null);
  const chartRef = useRef<HTMLButtonElement>(null);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const saveT = useRef<ReturnType<typeof setTimeout>>();
  const history = useRef<CanvasData[]>([]);

  useEffect(() => setLocal(initial), [initial]);

  // Pinça com dois dedos (celular/tablet): zoom em torno do ponto entre os dedos.
  const pinch = useRef<{ d0: number; z0: number; v0: { x: number; y: number }; m0: { x: number; y: number } } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    const dist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y) || 1;
    };
    const mid = () => {
      const [a, b] = [...pts.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        setDraft(null);
        setLocal((l) => {
          pinch.current = { d0: dist(), z0: l.view.zoom, v0: { x: l.view.x, y: l.view.y }, m0: mid() };
          return l;
        });
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = pinch.current;
      if (!p || pts.size < 2) return;
      const r = el.getBoundingClientRect();
      const m = mid();
      const nz = Math.min(3, Math.max(0.1, (p.z0 * dist()) / p.d0));
      const wx = (p.m0.x - r.left - p.v0.x) / p.z0, wy = (p.m0.y - r.top - p.v0.y) / p.z0;
      setLocal((l) => ({ ...l, view: { zoom: nz, x: m.x - r.left - wx * nz, y: m.y - r.top - wy * nz } }));
    };
    const up = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size < 2 && pinch.current) {
        pinch.current = null;
        setLocal((l) => (update(page.id, { canvas: l }), l));
      }
    };
    el.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, [page.id, update]);

  const commit = (next: CanvasData, immediate = false, snapshot = true) => {
    if (snapshot) history.current = [...history.current.slice(-40), local];
    setLocal(next);
    if (saveT.current) clearTimeout(saveT.current);
    const run = () => update(page.id, { canvas: next });
    if (immediate) run();
    else saveT.current = setTimeout(run, 400);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (prev) commit(prev, true, false);
  };
  useEffect(() => () => saveT.current && clearTimeout(saveT.current), []);

  const { x: vx, y: vy, zoom } = local.view;
  const toWorld = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (cx - r.left - vx) / zoom, y: (cy - r.top - vy) / zoom };
  };
  const center = () => {
    const r = box.current!.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  };

  const addNode = (n: Partial<CanvasNode>, at?: { x: number; y: number }) => {
    const c = at || center();
    const w = n.w ?? 220, h = n.h ?? 140;
    const node: CanvasNode = { id: uid('n'), kind: 'note', x: c.x - w / 2, y: c.y - h / 2, w, h, color: NOTE_COLORS[0], text: '', ...n };
    commit({ ...local, nodes: [...local.nodes, node] }, true);
    setSel(node.id);
    if (['note', 'shape', 'text'].includes(node.kind)) setEdit(node.id);
    setTool('select');
    return node;
  };
  const patchNode = (id: string, p: Partial<CanvasNode>, immediate = false) =>
    commit({ ...local, nodes: local.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) }, immediate, immediate);
  const remove = (id: string) =>
    commit({ ...local, nodes: local.nodes.filter((n) => n.id !== id), edges: local.edges.filter((e) => e.id !== id && e.from !== id && e.to !== id) }, true);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') return e.preventDefault(), undo();
      if (sel && !edit && (e.key === 'Delete' || e.key === 'Backspace')) return remove(sel), setSel(null);
      const map: Record<string, Tool> = { v: 'select', h: 'hand', p: 'pen', e: 'eraser', c: 'connector', f: 'frame', t: 'text', n: 'note', s: 'shape' };
      if (!e.ctrlKey && !e.metaKey && map[e.key]) setTool(map[e.key]);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const track = (move: (ev: PointerEvent) => void, up: (ev: PointerEvent) => void) => {
    const u = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', u);
      up(ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', u);
  };

  const eraseAt = (cx: number, cy: number) => {
    const el = (document.elementFromPoint(cx, cy) as HTMLElement | null)?.closest('[data-node]') as HTMLElement | null;
    const id = el?.dataset.node;
    if (!id) return;
    setLocal((l) => {
      const n = l.nodes.find((x) => x.id === id);
      if (!n || n.kind === 'page') return l;
      return { ...l, nodes: l.nodes.filter((x) => x.id !== id), edges: l.edges.filter((e) => e.from !== id && e.to !== id) };
    });
  };

  // ------------------------------------------------------ fundo do quadro
  const onBgDown = (e: React.PointerEvent) => {
    const hitEl = (e.target as HTMLElement).closest('[data-node]') as HTMLElement | null;
    // Molduras contam como fundo para as ferramentas de criação (dá para criar dentro delas).
    const creating = ['note', 'text', 'shape', 'frame'].includes(tool);
    const onNode = hitEl && !(creating && hitEl.classList.contains('k-frame')) ? hitEl : null;
    const p = toWorld(e.clientX, e.clientY);
    if (tool === 'pen') {
      e.preventDefault();
      setDraft({ kind: 'pen', pts: [p.x, p.y] });
      track(
        (ev) => {
          if (pinch.current) return;
          const q2 = toWorld(ev.clientX, ev.clientY);
          setDraft((d) => (d && d.kind === 'pen' ? { kind: 'pen', pts: [...d.pts, q2.x, q2.y] } : d));
        },
        () =>
          setDraft((d) => {
            if (d && d.kind === 'pen' && d.pts.length > 4) {
              const xs = d.pts.filter((_, i) => i % 2 === 0), ys = d.pts.filter((_, i) => i % 2 === 1);
              const pad = penSize + 4;
              const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
              const node: CanvasNode = {
                id: uid('n'), kind: 'draw', x: minX, y: minY, w: Math.max(...xs) - minX + pad, h: Math.max(...ys) - minY + pad,
                color: ink, stroke: penSize, points: d.pts.map((v, i) => (i % 2 === 0 ? v - minX : v - minY)),
              };
              setLocal((l) => {
                const next = { ...l, nodes: [...l.nodes, node] };
                commit(next, true);
                return next;
              });
            }
            return null;
          }),
      );
      return;
    }
    if (tool === 'eraser') {
      eraseAt(e.clientX, e.clientY);
      track((ev) => eraseAt(ev.clientX, ev.clientY), () => setLocal((l) => (commit(l, true), l)));
      return;
    }
    if (onNode) return;
    if (tool === 'frame') {
      e.preventDefault();
      setDraft({ kind: 'frame', x: p.x, y: p.y, w: 0, h: 0 });
      track(
        (ev) => {
          const q2 = toWorld(ev.clientX, ev.clientY);
          setDraft({ kind: 'frame', x: Math.min(p.x, q2.x), y: Math.min(p.y, q2.y), w: Math.abs(q2.x - p.x), h: Math.abs(q2.y - p.y) });
        },
        () =>
          setDraft((d) => {
            if (d && d.kind === 'frame') {
              const r = d.w < 40 || d.h < 40 ? { x: p.x - 200, y: p.y - 150, w: 400, h: 300 } : d;
              const n = local.nodes.filter((x) => x.kind === 'frame').length + 1;
              addNode({ kind: 'frame', ...r, color: 'transparent', text: `${t('canvas.frame')} ${n}` }, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
              setEdit(null);
            }
            return null;
          }),
      );
      return;
    }
    if (['text', 'note', 'shape'].includes(tool)) e.preventDefault();
    if (tool === 'text') return void addNode({ kind: 'text', w: 240, h: 48, color: ink, fontSize: 22 }, p);
    if (tool === 'note') return void addNode({ kind: 'note', color: NOTE_COLORS[0] }, p);
    if (tool === 'shape') return void addNode({ kind: 'shape', shape: shapeKind, color: '#fcd34d', w: 180, h: shapeKind === 'diamond' ? 160 : 120 }, p);

    setSel(null);
    setEdit(null);
    const sx = e.clientX, sy = e.clientY, ox = vx, oy = vy;
    track(
      (ev) => !pinch.current && setLocal((l) => ({ ...l, view: { ...l.view, x: ox + ev.clientX - sx, y: oy + ev.clientY - sy } })),
      () => setLocal((l) => (commit(l, false, false), l)),
    );
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const r = box.current!.getBoundingClientRect();
      const nz = Math.min(3, Math.max(0.1, zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      commit({ ...local, view: { zoom: nz, x: mx - ((mx - vx) / zoom) * nz, y: my - ((my - vy) / zoom) * nz } }, false, false);
    } else {
      commit({ ...local, view: { ...local.view, x: vx - e.deltaX, y: vy - e.deltaY } }, false, false);
    }
  };

  // ------------------------------------------------------------ nós
  const dragNode = (e: React.PointerEvent, n: CanvasNode, mode: 'move' | 'resize') => {
    if (tool === 'pen' || tool === 'eraser') return;
    if (mode === 'move' && n.kind === 'frame' && ['note', 'text', 'shape', 'frame'].includes(tool)) return; // deixa o clique chegar ao fundo
    if (tool === 'connector' && mode === 'move') return startLink(e, n);
    if (edit === n.id && mode === 'move') return;
    e.stopPropagation();
    setSel(n.id);
    const sx = e.clientX, sy = e.clientY, o = { ...n };
    // Molduras levam junto o que está dentro delas.
    const inside = n.kind === 'frame' && mode === 'move'
      ? local.nodes.filter((x) => x.id !== n.id && x.x >= n.x && x.y >= n.y && x.x + x.w <= n.x + n.w && x.y + x.h <= n.y + n.h).map((x) => ({ id: x.id, x: x.x, y: x.y }))
      : [];
    const before = local;
    track(
      (ev) => {
        const dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;
        setLocal((l) => ({
          ...l,
          nodes: l.nodes.map((x) => {
            if (x.id === n.id) {
              if (mode === 'move') return { ...x, x: o.x + dx, y: o.y + dy };
              const w = Math.max(40, o.w + dx), h = Math.max(30, o.h + dy);
              if (x.kind === 'draw' && x.points) {
                const sxr = w / o.w, syr = h / o.h;
                return { ...x, w, h, points: o.points!.map((v, i) => (i % 2 === 0 ? v * sxr : v * syr)) };
              }
              return { ...x, w, h };
            }
            const inn = inside.find((i) => i.id === x.id);
            return inn ? { ...x, x: inn.x + dx, y: inn.y + dy } : x;
          }),
        }));
      },
      () => {
        history.current = [...history.current.slice(-40), before];
        setLocal((l) => (commit(l, true, false), l));
      },
    );
  };

  /** Ponto de encaixe mais próximo (magnetismo): lado de um nó perto do ponteiro. */
  const findSnap = (p: { x: number; y: number }, exclude?: string): Snap | null => {
    const R = 44 / zoom;
    let best: Snap | null = null;
    let bestD = R;
    for (const n of local.nodes) {
      if (n.id === exclude || n.kind === 'draw') continue;
      for (const side of SIDES) {
        const sp = sidePoint(n, side);
        const d = Math.hypot(sp.x - p.x, sp.y - p.y);
        if (d < bestD) (bestD = d), (best = { id: n.id, side, ...sp });
      }
    }
    if (best) return best;
    // Dentro de um nó: escolhe o lado mais próximo do ponteiro.
    const m = 16 / zoom; // tolerância em volta do nó
    const inside = [...local.nodes].reverse().find((n) => n.id !== exclude && n.kind !== 'draw' && n.kind !== 'frame' && p.x >= n.x - m && p.x <= n.x + n.w + m && p.y >= n.y - m && p.y <= n.y + n.h + m)
      || local.nodes.find((n) => n.id !== exclude && n.kind === 'frame' && p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + 28);
    if (!inside) return null;
    const side = nearestSide(inside, p);
    return { id: inside.id, side, ...sidePoint(inside, side) };
  };

  const startLink = (e: React.PointerEvent, n: CanvasNode, fromSide?: Side) => {
    e.stopPropagation();
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    setSel(null);
    setDraft({ kind: 'link', from: n.id, fromSide, ...p, snap: null });
    let last: Snap | null = null;
    track(
      (ev) => {
        const q2 = toWorld(ev.clientX, ev.clientY);
        last = findSnap(q2, n.id);
        setDraft((d) => (d && d.kind === 'link' ? { ...d, ...(last ? { x: last.x, y: last.y } : q2), snap: last } : d));
      },
      () => {
        setDraft(null);
        const to = last;
        if (!to || to.id === n.id) return;
        if (local.edges.some((x) => x.from === n.id && x.to === to.id && (x.fromSide || '') === (fromSide || '') && (x.toSide || '') === to.side)) return;
        const edge: CanvasEdge = { id: uid('e'), from: n.id, to: to.id, fromSide, toSide: to.side, style: edgeStyle, arrow: 'end', color: ink === '#ffffff' ? undefined : ink };
        commit({ ...local, edges: [...local.edges, edge] }, true);
        setSel(edge.id);
      },
    );
  };

  /** Arrasta uma ponta de um conector existente para outro ponto ou outro nó. */
  const startRelink = (e: React.PointerEvent, edge: CanvasEdge, end: 'from' | 'to') => {
    e.stopPropagation();
    e.preventDefault();
    const other = end === 'from' ? edge.to : edge.from;
    let last: Snap | null = null;
    const p = toWorld(e.clientX, e.clientY);
    setDraft({ kind: 'relink', edge: edge.id, end, ...p });
    track(
      (ev) => {
        const q2 = toWorld(ev.clientX, ev.clientY);
        last = findSnap(q2, other);
        setDraft((d) => (d && d.kind === 'relink' ? { ...d, ...(last ? { x: last.x, y: last.y } : q2), snap: last } : d));
      },
      () => {
        setDraft(null);
        if (!last) return;
        const patch: Partial<CanvasEdge> = end === 'from' ? { from: last.id, fromSide: last.side } : { to: last.id, toSide: last.side };
        commit({ ...local, edges: local.edges.map((x) => (x.id === edge.id ? { ...x, ...patch } : x)) }, true);
      },
    );
  };

  const fit = () => {
    if (!local.nodes.length) return commit({ ...local, view: { x: 0, y: 0, zoom: 1 } }, false, false);
    const r = box.current!.getBoundingClientRect();
    const minX = Math.min(...local.nodes.map((n) => n.x)), minY = Math.min(...local.nodes.map((n) => n.y));
    const maxX = Math.max(...local.nodes.map((n) => n.x + n.w)), maxY = Math.max(...local.nodes.map((n) => n.y + n.h));
    const z = Math.min(1.5, Math.max(0.1, Math.min((r.width - 120) / (maxX - minX), (r.height - 160) / (maxY - minY))));
    commit({ ...local, view: { zoom: z, x: (r.width - (maxX - minX) * z) / 2 - minX * z, y: (r.height - (maxY - minY) * z) / 2 - minY * z - 30 } }, false, false);
  };

  const edgeGeom = (e: CanvasEdge, a: CanvasNode, b: CanvasNode) => {
    const fs = e.fromSide || autoSides(a, b)[0];
    const ts = e.toSide || autoSides(a, b)[1];
    const p1 = sidePoint(a, fs), p2 = sidePoint(b, ts);
    return { p1, p2, fs, ts, d: edgePath(p1, fs, p2, ts, e.style || 'curve') };
  };
  const strokePath = (pts: number[]) => {
    if (pts.length < 4) return '';
    let d = `M${pts[0]},${pts[1]}`;
    for (let i = 2; i < pts.length - 2; i += 2) {
      const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2;
      d += ` Q${pts[i]},${pts[i + 1]} ${mx},${my}`;
    }
    return d + ` L${pts[pts.length - 2]},${pts[pts.length - 1]}`;
  };

  const editLabel = (e: CanvasEdge) => {
    void askText({ title: t('canvas.label'), value: e.label || '', placeholder: t('canvas.label') }).then((label) => {
    if (label !== null) commit({ ...local, edges: local.edges.map((x) => (x.id === e.id ? { ...x, label } : x)) }, true);
    });
  };
  const bounds = (() => {
    const pad = 4000;
    if (!local.nodes.length) return { x: -pad, y: -pad, w: pad * 2, h: pad * 2 };
    const minX = Math.min(...local.nodes.map((n) => n.x)) - pad, minY = Math.min(...local.nodes.map((n) => n.y)) - pad;
    const maxX = Math.max(...local.nodes.map((n) => n.x + n.w)) + pad, maxY = Math.max(...local.nodes.map((n) => n.y + n.h)) + pad;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  })();
  const realFrames = local.nodes.filter((n) => n.kind === 'frame');
  /** Slides: as molduras ou, sem molduras, enquadramentos automáticos (visão geral + cada grupo de ideias). */
  const frames = useMemo(() => (realFrames.length ? realFrames : autoSlides(local.nodes, local.edges, t('present.overview'))), [local.nodes, local.edges]); // eslint-disable-line react-hooks/exhaustive-deps
  const autoFrames = !realFrames.length;

  const [viewPage, setViewPage] = useState<string | null>(null);
  /** Na apresentação, links para páginas abrem numa tela limpa com botão de voltar. */
  const presentFollow = (l?: CanvasNode['link']) => {
    if (!l || l.type === 'none' || !l.target) return false;
    if (l.type === 'page') return setViewPage(l.target), true;
    return followLink(l);
  };
  /** Situação do elemento no slide atual da apresentação. */
  const presentState = (n: CanvasNode) => {
    const fr = frames[slide];
    const assigned = n.slides?.length ? n.slides.filter((id) => frames.some((f) => f.id === id)) : [];
    const inFrame = !fr || (n.x + n.w / 2 >= fr.x && n.x + n.w / 2 <= fr.x + fr.w && n.y + n.h / 2 >= fr.y && n.y + n.h / 2 <= fr.y + fr.h);
    const onSlide = n.kind !== 'frame' && (assigned.length ? !!fr && assigned.includes(fr.id) : inFrame);
    return { onSlide, hidden: assigned.length > 0 && !onSlide };
  };
  const startPresenting = () => {
    savedView.current = local.view;
    setSel(null);
    setEdit(null);
    setTool('select');
    setSlide(0);
    setPresenting(true);
    shell.current?.requestFullscreen?.().catch(() => undefined);
  };
  const stopPresenting = () => {
    cancelAnimationFrame(flight.current);
    setViewPage(null);
    setPresenting(false);
    if (savedView.current) setLocal((l) => ({ ...l, view: savedView.current! }));
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
  };
  const viewRef = useRef(local.view);
  viewRef.current = local.view;
  const flight = useRef(0);
  /** Enquadramento de um slide: cabe na tela, com respiro, descontando a barra de controles. */
  const viewFor = (f: { x: number; y: number; w: number; h: number }, r: DOMRect, pad = 28) => {
    const z = Math.min(4, Math.max(0.05, Math.min((r.width - pad * 2) / Math.max(1, f.w), (r.height - pad * 2 - 56) / Math.max(1, f.h))));
    return { zoom: z, x: (r.width - f.w * z) / 2 - f.x * z, y: (r.height - 56 - f.h * z) / 2 - f.y * z };
  };
  useEffect(() => {
    if (!presenting) return;
    const go = (instant = false) => {
      const r = box.current?.getBoundingClientRect();
      const f = frames[slide];
      if (!r || !f) return;
      const to = viewFor(f, r, f.id.startsWith('auto-0') ? 70 : 28);
      const tr = instant ? 'none' : f.slideTr || (local.present?.transition === 'slide' ? 'smooth' : local.present?.transition) || 'fly';
      const dur = (f.slideDur || local.present?.duration || 1.1) * 1000;
      cancelAnimationFrame(flight.current);
      if (tr === 'none') return setLocal((l) => ({ ...l, view: to }));
      if (tr === 'fade') {
        shell.current?.classList.add('fading');
        setTimeout(() => {
          setLocal((l) => ({ ...l, view: to }));
          requestAnimationFrame(() => shell.current?.classList.remove('fading'));
        }, dur / 2);
        return;
      }
      // Voo contínuo pelo quadro: centro e zoom interpolados; no "fly" a câmera se afasta no meio do caminho.
      const from = viewRef.current;
      const W = r.width, H = r.height - 56;
      const c0 = { x: (W / 2 - from.x) / from.zoom, y: (H / 2 - from.y) / from.zoom };
      const c1 = { x: (W / 2 - to.x) / to.zoom, y: (H / 2 - to.y) / to.zoom };
      const dist = Math.hypot(c1.x - c0.x, c1.y - c0.y);
      const zFitBoth = Math.min(W / (dist + f.w + 200), H / (dist + f.h + 200));
      const l0 = Math.log(from.zoom), l1 = Math.log(to.zoom);
      const dip = tr === 'fly' ? Math.max(0, Math.min(l0, l1) - Math.log(Math.max(0.04, zFitBoth))) : 0;
      const t0 = performance.now();
      const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = ease(k);
        const z = Math.exp(l0 + (l1 - l0) * e - dip * Math.sin(Math.PI * e));
        const cx = c0.x + (c1.x - c0.x) * e, cy = c0.y + (c1.y - c0.y) * e;
        setLocal((l) => ({ ...l, view: { zoom: z, x: W / 2 - cx * z, y: H / 2 - cy * z } }));
        if (k < 1) flight.current = requestAnimationFrame(tick);
      };
      flight.current = requestAnimationFrame(tick);
    };
    go();
    const onResize = () => go(true);
    window.addEventListener('resize', onResize);
    return () => (cancelAnimationFrame(flight.current), window.removeEventListener('resize', onResize));
  }, [presenting, slide, frames.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Ao entrar: começa pela visão geral e voa até o primeiro slide.
  useEffect(() => {
    if (!presenting) return;
    const r = box.current?.getBoundingClientRect();
    if (!r || !local.nodes.length) return;
    const xs = local.nodes.map((n) => n.x), ys = local.nodes.map((n) => n.y);
    const all = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...local.nodes.map((n) => n.x + n.w)) - Math.min(...xs), h: Math.max(...local.nodes.map((n) => n.y + n.h)) - Math.min(...ys) };
    setLocal((l) => ({ ...l, view: viewFor(all, r, 80) }));
  }, [presenting]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const f = () => !document.fullscreenElement && presenting && stopPresenting();
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  });

  /** Toca o efeito do elemento ali mesmo, para conferir antes de apresentar. */
  const previewAnim = (id: string) => {
    const el = box.current?.querySelector(`[data-node="${id}"]`) as HTMLElement | null;
    const n = local.nodes.find((x) => x.id === id);
    if (!el || !n?.anim || n.anim === 'none') return;
    el.classList.remove('pa', 'pa-' + n.anim);
    void el.offsetWidth;
    el.style.setProperty('--delay', '0s');
    el.classList.add('pa', 'pa-' + n.anim);
    setTimeout(() => el.classList.remove('pa', 'pa-' + n.anim), ((n.animDur || 0.7) + 0.2) * 1000 + (['pulse', 'float', 'wiggle'].includes(n.anim) ? 2500 : 0));
  };

  const selNode = local.nodes.find((n) => n.id === sel);
  const selEdge = local.edges.find((e) => e.id === sel);
  const candidates = livePages(pages).filter((p) => normalize(p.title || '').includes(normalize(q))).slice(0, 12);
  const ordered = [...local.nodes].sort((a, b) => (a.kind === 'frame' ? -1 : 0) - (b.kind === 'frame' ? -1 : 0));
  const T = ({ id, icon, label }: { id: Tool; icon: React.ReactNode; label: string }) => (
    <button className={'dock-btn' + (tool === id ? ' on' : '')} onClick={() => setTool(id)} title={label}>{icon}</button>
  );

  return (
    <div ref={shell} className={"canvas-shell" + (presenting ? " presenting tr-" + (frames[slide]?.slideTr || local.present?.transition || "fly") : "")} style={{ ["--tr-dur" as any]: `${local.present?.duration || 0.7}s` }}>
      <div
        ref={box}
        className={`canvas-area tool-${tool}`}
        onPointerDown={onBgDown}
        onWheel={onWheel}
        onDoubleClick={(e) => {
          if (tool !== 'select' || (e.target as HTMLElement).closest('[data-node]')) return;
          addNode({ kind: 'note' }, toWorld(e.clientX, e.clientY));
        }}
        style={{ backgroundPosition: `${vx}px ${vy}px`, backgroundSize: `${24 * zoom}px ${24 * zoom}px` }}
      >
        {!local.nodes.length && <div className="canvas-hint">{t('canvas.hint')}</div>}
        <div className="canvas-world" style={{ transform: `translate(${vx}px, ${vy}px) scale(${zoom})` }}>
          {ordered.map((n) => {
            const target = n.pageId ? pages[n.pageId] : undefined;
            // Com slides escolhidos, o elemento só aparece neles; sem escolha, vale a posição dentro da moldura.
            const ps = presenting ? presentState(n) : { onSlide: false, hidden: false };
            const onSlide = presenting && ps.onSlide;
            const hiddenHere = presenting && ps.hidden;
            const animCls = (presenting && n.anim && n.anim !== 'none' ? (onSlide ? ` pa pa-${n.anim}` : ' pa-wait') : '') + (hiddenHere ? ' pa-hidden' : '');
            const order = onSlide ? ordered.filter((x) => x.kind !== 'frame' && x.anim && x.anim !== 'none').sort((a, b) => a.y - b.y || a.x - b.x).findIndex((x) => x.id === n.id) : 0;
            return (
              <div
                key={presenting && onSlide ? `${n.id}-s${slide}` : n.id}
                data-node={n.id}
                className={`cnode k-${n.kind} ${n.shape ? 's-' + n.shape : ''} ${sel === n.id ? 'sel' : ''} ${n.color === '#1e293b' ? 'dark' : ''} ${(draft?.kind === 'link' || draft?.kind === 'relink') && draft.snap?.id === n.id ? 'snap' : ''}${n.fill && n.fill !== 'solid' ? ' fill-' + n.fill : ''}${n.link && n.link.type !== 'none' && n.link.target ? ' has-link' : ''}${animCls}`}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h, ['--node' as any]: n.color, ['--delay' as any]: n.animDelay != null ? `${n.animDelay}s` : `${Math.max(0, order) * 140 + 250}ms`, ['--adur' as any]: `${n.animDur || 0.7}s` }}
                onPointerDown={(e) => {
                  if (presenting) return;
                  if ((e.ctrlKey || e.metaKey) && n.link && followLink(n.link)) return e.stopPropagation();
                  dragNode(e, n, 'move');
                }}
                onClick={(e) => presenting && n.link && presentFollow(n.link) && e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (n.kind === 'page' && target) useUi.getState().go({ name: 'page', id: target.id });
                  else if (n.kind === 'chart' && n.chart) useUi.getState().go({ name: 'page', id: n.chart.reportId });
                  else if (['note', 'shape', 'text', 'frame', 'button'].includes(n.kind)) setEdit(n.id);
                }}
              >
                {n.kind === 'frame' && (
                  <div className="frame-label" onPointerDown={(e) => e.stopPropagation()}>
                    {edit === n.id ? (
                      <input autoFocus value={n.text || ''} onChange={(e) => patchNode(n.id, { text: e.target.value })} onBlur={() => setEdit(null)} />
                    ) : (
                      <span onDoubleClick={() => setEdit(n.id)}>{n.text || t('canvas.frame')}</span>
                    )}
                  </div>
                )}
                {n.kind === 'shape' && (
                  <svg className="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style={n.fill === 'gradient' ? { fill: `url(#gr-${n.id})` } : undefined}>
                    {n.fill === 'gradient' && (
                      <defs>
                        <linearGradient id={`gr-${n.id}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor={n.color} />
                          <stop offset="1" stopColor="#22d3ee" />
                        </linearGradient>
                      </defs>
                    )}
                    {n.shape === 'ellipse' ? <ellipse cx="50" cy="50" rx="49" ry="49" /> : n.shape === 'diamond' ? <polygon points="50,1 99,50 50,99 1,50" /> : n.shape === 'triangle' ? <polygon points="50,2 98,98 2,98" /> : <rect x="1" y="1" width="98" height="98" rx="6" />}
                  </svg>
                )}
                {n.kind === 'draw' && n.points && (
                  <svg className="draw-svg" width={n.w} height={n.h}>
                    <path d={strokePath(n.points)} stroke={n.color} strokeWidth={n.stroke || 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {(n.kind === 'note' || n.kind === 'shape' || n.kind === 'text') &&
                  (edit === n.id ? (
                    <textarea autoFocus className="cnode-text" style={n.kind === 'text' ? { fontSize: n.fontSize, color: n.color } : undefined} value={n.text || ''} onChange={(e) => patchNode(n.id, { text: e.target.value })} onBlur={() => setEdit(null)} onKeyDown={(e) => e.key === 'Escape' && (e.currentTarget.blur(), setEdit(null))} onPointerDown={(e) => e.stopPropagation()} />
                  ) : (
                    <div className="cnode-text view" style={n.kind === 'text' ? { fontSize: n.fontSize, color: n.color } : undefined}>{n.text || <span className="ph">{t(n.kind === 'text' ? 'canvas.text' : 'canvas.empty')}</span>}</div>
                  ))}
                {n.kind === 'page' && (
                  <div className="cnode-page">
                    <div className="cnode-page-head"><PageIcon icon={target?.icon || '📄'} size={16} /><b className="ellipsis">{target?.title || t('page.untitled')}</b></div>
                    {target ? <div className="cnode-doc prose" dangerouslySetInnerHTML={{ __html: target.type === 'page' ? pageToHtml(target) : `<p>${t('canvas.openToSee')}</p>` }} /> : <p>{t('editor.brokenLink')}</p>}
                  </div>
                )}
                {n.kind === 'image' && n.src && <img src={n.src} alt="" draggable={false} />}
                {n.kind === 'button' && (
                  <div className="cnode-button">
                    {edit === n.id ? (
                      <input autoFocus className="input" value={n.text || ''} onChange={(e) => patchNode(n.id, { text: e.target.value })} onBlur={() => setEdit(null)} onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && setEdit(null)} onPointerDown={(e) => e.stopPropagation()} />
                    ) : (
                      <ButtonView b={nodeButton(n)} onClick={() => (presenting ? void presentFollow(n.link) : undefined)} />
                    )}
                  </div>
                )}
                {n.kind === 'chart' && (() => {
                  const rep = n.chart ? pages[n.chart.reportId] : undefined;
                  const w = rep?.report?.widgets.find((x) => x.id === n.chart!.widgetId);
                  return (
                    <div className="cnode-chart">
                      <b className="ellipsis">{w?.title || rep?.title || t('canvas.chart')}</b>
                      {rep?.report && w ? <Chart w={w} report={rep.report} height={Math.max(80, n.h - 52)} /> : <p className="muted small">{t('editor.brokenLink')}</p>}
                    </div>
                  );
                })()}
                {n.link && n.link.type !== 'none' && n.link.target && !presenting && (
                  <button className="cnode-linkbadge" title={`${t('canvas.followLink')}: ${linkLabel(n.link)}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => (e.stopPropagation(), followLink(n.link))}><Link2 size={12} /></button>
                )}
                {n.kind !== 'draw' && SIDES.map((sd) => (
                  <span
                    key={sd}
                    className={'anchor a-' + sd + ((draft?.kind === 'link' || draft?.kind === 'relink') && draft.snap?.id === n.id && draft.snap.side === sd ? ' hot' : '')}
                    title={t('canvas.connect')}
                    onPointerDown={(e) => startLink(e, n, sd)}
                  />
                ))}
                <span className="cnode-resize" onPointerDown={(e) => dragNode(e, n, 'resize')} />
              </div>
            );
          })}
          <svg className="canvas-edges" style={{ left: bounds.x, top: bounds.y }} width={bounds.w} height={bounds.h} viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="context-stroke" />
              </marker>
            </defs>
            {local.edges.map((e) => {
              const a = local.nodes.find((n) => n.id === e.from), b = local.nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              const relink = draft?.kind === 'relink' && draft.edge === e.id ? draft : null;
              let { p1, p2, d } = edgeGeom(e, a, b);
              if (relink) {
                const fs = e.fromSide || autoSides(a, b)[0], ts = e.toSide || autoSides(a, b)[1];
                if (relink.end === 'from') (p1 = { x: relink.x, y: relink.y }), (d = edgePath(p1, relink.snap?.side || fs, p2, ts, e.style || 'curve'));
                else (p2 = { x: relink.x, y: relink.y }), (d = edgePath(p1, fs, p2, relink.snap?.side || ts, e.style || 'curve'));
              }
              const arrow = e.arrow || 'end';
              const on = sel === e.id;
              let pe = '';
              let edelay = 0;
              if (presenting) {
                const sa = presentState(a), sb = presentState(b);
                if (sa.hidden || sb.hidden) pe = ' pe-hidden';
                else if (sa.onSlide && sb.onSlide) {
                  pe = ' pe-draw';
                  const nd = (n: CanvasNode) => (n.anim && n.anim !== 'none' ? (n.animDelay ?? 0.25) + (n.animDur || 0.7) : 0.2);
                  edelay = Math.max(nd(a), nd(b)) + 0.15;
                }
              }
              return (
                <g key={presenting && pe === ' pe-draw' ? `${e.id}-s${slide}` : e.id} className={'edge' + (on ? ' on' : '') + pe} style={{ ['--edge' as any]: e.color || 'var(--muted)', ['--edelay' as any]: `${edelay}s` }}
                  onPointerDown={(ev) => (ev.stopPropagation(), setSel(e.id), setEdit(null))}
                  onDoubleClick={(ev) => { ev.stopPropagation(); editLabel(e); }}>
                  <path d={d} className="edge-hit" />
                  <path d={d} pathLength={1} className="edge-line" markerEnd={arrow !== 'none' ? 'url(#arrow)' : undefined} markerStart={arrow === 'both' ? 'url(#arrow)' : undefined} />
                  {e.label && <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 8} textAnchor="middle">{e.label}</text>}
                  {on && (
                    <>
                      <circle className="edge-end" cx={p1.x} cy={p1.y} r={7 / zoom} onPointerDown={(ev) => startRelink(ev, e, 'from')} />
                      <circle className="edge-end" cx={p2.x} cy={p2.y} r={7 / zoom} onPointerDown={(ev) => startRelink(ev, e, 'to')} />
                    </>
                  )}
                </g>
              );
            })}
            {draft?.kind === 'link' && (() => {
              const a = local.nodes.find((n) => n.id === draft.from);
              if (!a) return null;
              const fs = draft.fromSide || nearestSide(a, draft);
              const ts = draft.snap?.side || oppositeSide(fs);
              return <path d={edgePath(sidePoint(a, fs), fs, draft, ts, edgeStyle)} className="edge-draft" markerEnd="url(#arrow)" />;
            })()}
            {draft?.kind === 'pen' && <path d={strokePath(draft.pts)} stroke={ink} strokeWidth={penSize} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {draft?.kind === 'frame' && <rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} className="frame-draft" />}
          </svg>
        </div>

        {(selNode || selEdge) && (
          <div className="canvas-props" onPointerDown={(e) => e.stopPropagation()}>
            {selNode && !['image', 'page', 'frame', 'chart'].includes(selNode.kind) &&
              (selNode.kind === 'draw' || selNode.kind === 'text' || selNode.kind === 'button' ? INK : NOTE_COLORS).map((c) => (
                <button key={c} className={'color-dot sm' + (selNode.color === c ? ' on' : '')} style={{ background: c }} onClick={() => patchNode(selNode.id, { color: c }, true)} />
              ))}
            {selNode?.kind === 'text' && (
              <>
                <button className="tb" onClick={() => patchNode(selNode.id, { fontSize: Math.max(12, (selNode.fontSize || 22) - 4) }, true)}>A−</button>
                <button className="tb" onClick={() => patchNode(selNode.id, { fontSize: Math.min(96, (selNode.fontSize || 22) + 4) }, true)}>A+</button>
              </>
            )}
            {selNode?.kind === 'button' && (
              <>
                <span className="tb-sep" />
                <Select value={selNode.button?.variant || 'gradient'} options={(['gradient', 'solid', 'soft', 'outline', 'ghost', 'glass'] as const).map((v) => ({ value: v, label: t(`comp.variant.${v}` as any) }))} onChange={(variant) => patchNode(selNode.id, { button: { ...(selNode.button || { shape: 'pill', size: 'md' }), variant } as any }, true)} />
                <Select value={selNode.button?.shape || 'pill'} options={(['pill', 'rounded', 'square'] as const).map((v) => ({ value: v, label: t(`comp.shape.${v}` as any) }))} onChange={(shape) => patchNode(selNode.id, { button: { ...(selNode.button || { variant: 'gradient', size: 'md' }), shape } as any }, true)} />
              </>
            )}
            {selNode && (selNode.kind === 'shape' || selNode.kind === 'note') && (
              <Select value={selNode.fill || 'solid'} options={(['solid', 'gradient', 'glass'] as const).map((v) => ({ value: v, label: t(`canvas.fill.${v}` as any) }))} onChange={(fill) => patchNode(selNode.id, { fill: fill as any }, true)} />
            )}
            {selNode && selNode.kind !== 'draw' && selNode.kind !== 'frame' && (
              <>
                <span className="tb-sep" />
                <button ref={linkRef} className={'tb' + (selNode.link && selNode.link.type !== 'none' && selNode.link.target ? ' on' : '')} title={t('canvas.link')} onClick={() => setLinkOpen(!linkOpen)}><Link2 size={15} /></button>
                <button ref={animRef} className={'tb wide' + (selNode.anim && selNode.anim !== 'none' || selNode.slides?.length ? ' on' : '')} title={t('present.elTitle')} onClick={() => setAnimOpen(!animOpen)}>
                  <Sparkle size={15} /> <span className="hide-xs">{selNode.anim && selNode.anim !== 'none' ? t(`canvas.anim.${selNode.anim}` as any) : t('present.elButton')}</span>
                </button>
                <Popover anchor={animRef.current} open={animOpen} onClose={() => setAnimOpen(false)}>
                  <PresentSettings node={selNode} frames={realFrames} onChange={(p) => patchNode(selNode.id, p, true)} onPreview={() => previewAnim(selNode.id)} />
                </Popover>
                <Popover anchor={linkRef.current} open={linkOpen} onClose={() => setLinkOpen(false)}>
                  <div className="pad" style={{ width: 300 }}>
                    <div className="field-label"><Link2 size={12} /> {t('canvas.linkHint')}</div>
                    <LinkPicker value={selNode.link || { type: 'none', target: '' }} onChange={(link) => patchNode(selNode.id, { link }, true)} />
                  </div>
                </Popover>
              </>
            )}
            {selEdge && (
              <>
                {(['straight', 'elbow', 'curve'] as const).map((s) => (
                  <button key={s} className={'tb' + ((selEdge.style || 'straight') === s ? ' on' : '')} onClick={() => commit({ ...local, edges: local.edges.map((x) => (x.id === selEdge.id ? { ...x, style: s } : x)) }, true)}>
                    {s === 'straight' ? <Slash size={15} /> : s === 'elbow' ? <CornerDownRight size={15} /> : <Spline size={15} />}
                  </button>
                ))}
                <span className="tb-sep" />
                {(['none', 'end', 'both'] as const).map((a) => (
                  <button key={a} className={'tb' + ((selEdge.arrow || 'end') === a ? ' on' : '')} title={t(`canvas.arrow.${a}` as any)} onClick={() => commit({ ...local, edges: local.edges.map((x) => (x.id === selEdge.id ? { ...x, arrow: a } : x)) }, true)}>
                    {a === 'none' ? <LineIcon size={15} /> : a === 'end' ? <MoveRight size={15} /> : <MoveHorizontal size={15} />}
                  </button>
                ))}
                <button className="tb" title={t('canvas.label')} onClick={() => editLabel(selEdge)}><Tag size={15} /></button>
                <span className="tb-sep" />
                {INK.slice(0, 8).map((c) => <button key={c} className={'color-dot sm' + (selEdge.color === c ? ' on' : '')} style={{ background: c }} onClick={() => commit({ ...local, edges: local.edges.map((x) => (x.id === selEdge.id ? { ...x, color: c } : x)) }, true)} />)}
              </>
            )}
            <button className="tb" onClick={() => (remove(sel!), setSel(null))} title={t('common.delete')}><Trash2 size={16} /></button>
          </div>
        )}

        <div className="canvas-zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button className="tb" onClick={fit} title={t('canvas.fit')}><Maximize size={16} /></button>
          <button className="tb" onClick={() => commit({ ...local, view: { ...local.view, zoom: Math.max(0.1, zoom * 0.85) } }, false, false)}><Minus size={16} /></button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="tb" onClick={() => commit({ ...local, view: { ...local.view, zoom: Math.min(3, zoom * 1.15) } }, false, false)}><Plus size={16} /></button>
          <button className="tb" onClick={undo} title={t('tb.undo')} disabled={!history.current.length}><Undo2 size={16} /></button>
        </div>
        <button className="canvas-present btn primary sm" onPointerDown={(e) => e.stopPropagation()} onClick={startPresenting} title={t('present.start')}>
          <Presentation size={15} /> <span className="hide-xs">{t('present.start')}</span>{frames.length ? ` · ${frames.length}` : ''}
        </button>

        <div className="dock" onPointerDown={(e) => e.stopPropagation()}>
          <T id="select" icon={<MousePointer2 size={19} />} label={`${t('canvas.select')} (V)`} />
          <T id="hand" icon={<Hand size={19} />} label={`${t('canvas.hand')} (H)`} />
          <T id="connector" icon={<Waypoints size={19} />} label={`${t('canvas.connector')} (C)`} />
          <T id="frame" icon={<Frame size={19} />} label={`${t('canvas.frame')} (F)`} />
          <span className="dock-sep" />
          <T id="pen" icon={<PenLine size={19} />} label={`${t('canvas.pen')} (P)`} />
          <T id="eraser" icon={<Eraser size={19} />} label={`${t('canvas.eraser')} (E)`} />
          <T id="shape" icon={shapeKind === 'ellipse' ? <Circle size={19} /> : shapeKind === 'diamond' ? <Diamond size={19} /> : shapeKind === 'triangle' ? <Triangle size={19} /> : <Square size={19} />} label={`${t('canvas.shape')} (S)`} />
          <T id="text" icon={<Type size={19} />} label={`${t('canvas.text')} (T)`} />
          <T id="note" icon={<StickyNote size={19} />} label={`${t('canvas.note')} (N)`} />
          <button ref={pickRef} className="dock-btn" onClick={() => setPickOpen(true)} title={t('canvas.page')}><FileText size={19} /></button>
          <button className="dock-btn" onClick={() => addNode({ kind: 'button', text: t('comp.newButton'), w: 200, h: 56, color: '#7c3aed', button: { variant: 'gradient', shape: 'pill', size: 'md' }, link: { type: 'none', target: '' } })} title={t('canvas.button')}><MousePointerClick size={19} /></button>
          <button ref={chartRef} className="dock-btn" onClick={() => setChartOpen(true)} title={t('canvas.chart')}><BarChart3 size={19} /></button>
          <button className="dock-btn" onClick={async () => { const [src] = await pickImages(false, 1400); if (src) addNode({ kind: 'image', src, w: 320, h: 220, color: '#ffffff' }); }} title={t('canvas.image')}><ImagePlus size={19} /></button>
          {(tool === 'pen' || tool === 'connector' || tool === 'text') && (
            <div className="dock-sub">
              {INK.map((c) => <button key={c} className={'color-dot sm' + (ink === c ? ' on' : '')} style={{ background: c }} onClick={() => setInk(c)} />)}
              {tool === 'pen' && [2, 4, 8].map((s) => <button key={s} className={'tb' + (penSize === s ? ' on' : '')} onClick={() => setPenSize(s)}><span className="pen-dot" style={{ width: s + 2, height: s + 2 }} /></button>)}
              {tool === 'connector' && (['straight', 'elbow', 'curve'] as const).map((s) => (
                <button key={s} className={'tb' + (edgeStyle === s ? ' on' : '')} onClick={() => setEdgeStyle(s)}>{s === 'straight' ? <Slash size={15} /> : s === 'elbow' ? <CornerDownRight size={15} /> : <Spline size={15} />}</button>
              ))}
            </div>
          )}
          {tool === 'shape' && (
            <div className="dock-sub">
              {(['rect', 'ellipse', 'diamond', 'triangle'] as const).map((s) => (
                <button key={s} className={'tb' + (shapeKind === s ? ' on' : '')} onClick={() => setShapeKind(s)}>
                  {s === 'rect' ? <Square size={16} /> : s === 'ellipse' ? <Circle size={16} /> : s === 'diamond' ? <Diamond size={16} /> : <Triangle size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {presenting && (
        <Presenter
          frames={frames}
          auto={autoFrames}
          transition={local.present?.transition || 'fly'}
          duration={local.present?.duration || 1.1}
          timer={local.present?.timer}
          paused={!!viewPage}
          onSettings={(present) => commit({ ...local, present }, true)}
          index={slide}
          setIndex={setSlide}
          onClose={stopPresenting}
          onReorder={(ids) => {
            const order = new Map(ids.map((id: string, i: number) => [id, i]));
            const fr = local.nodes.filter((n) => n.kind === 'frame').sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
            let k = 0;
            commit({ ...local, nodes: local.nodes.map((n) => (n.kind === 'frame' ? fr[k++] : n)) }, true);
          }}
        />
      )}
      {presenting && viewPage && pages[viewPage] && <PresentPage page={pages[viewPage]} onBack={() => setViewPage(null)} onOpen={(id) => setViewPage(id)} />}
      <Popover anchor={chartRef.current} open={chartOpen} onClose={() => setChartOpen(false)}>
        <div className="menu" style={{ width: 300, maxHeight: 360, overflow: 'auto' }}>
          {livePages(pages).filter((p) => p.type === 'report' && p.report?.widgets.length).flatMap((p) =>
            p.report!.widgets.map((w) => (
              <button key={p.id + w.id} className="menu-item" onClick={() => (addNode({ kind: 'chart', chart: { reportId: p.id, widgetId: w.id }, w: 420, h: 300, color: '#ffffff' }), setChartOpen(false))}>
                <BarChart3 size={15} /> <span className="grow ellipsis">{w.title || p.title}</span> <small className="muted">{p.title}</small>
              </button>
            )),
          )}
          {!livePages(pages).some((p) => p.type === 'report' && p.report?.widgets.length) && <p className="muted small pad">{t('canvas.noCharts')}</p>}
        </div>
      </Popover>
      <Popover anchor={pickRef.current} open={pickOpen} onClose={() => setPickOpen(false)}>
        <div className="stack pad" style={{ width: 300 }}>
          <input className="input" autoFocus placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="menu">
            {candidates.map((p) => (
              <button key={p.id} className="menu-item" onClick={() => (addNode({ kind: 'page', pageId: p.id, w: 420, h: 320, color: '#ffffff' }), setPickOpen(false))}>
                <PageIcon icon={p.icon} size={16} /> {p.title || t('page.untitled')}
              </button>
            ))}
          </div>
        </div>
      </Popover>
    </div>
  );
}
