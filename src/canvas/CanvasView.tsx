import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle, Diamond, Eraser, FileText, Frame, Hand, ImagePlus, Maximize, Minus, MousePointer2, PenLine, Plus, Spline, Square, StickyNote,
  Trash2, Triangle, Type, Undo2, Waypoints, CornerDownRight, Slash,
} from 'lucide-react';
import type { CanvasData, CanvasEdge, CanvasNode, Page } from '../lib/types';
import { useT } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi } from '../store/ui';
import { uid } from '../lib/crypto';
import { pickImages } from '../lib/platform';
import { PageIcon, Popover } from '../components/ui';
import { normalize } from '../lib/doc';
import { pageToHtml } from '../lib/transfer';

type Tool = 'select' | 'hand' | 'pen' | 'eraser' | 'connector' | 'frame' | 'text' | 'note' | 'shape';
type ShapeKind = NonNullable<CanvasNode['shape']>;

const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa', '#e2e8f0', '#1e293b'];
const INK = ['#1f2937', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
const EMPTY: CanvasData = { nodes: [], edges: [], view: { x: 0, y: 0, zoom: 1 } };

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
  const [draft, setDraft] = useState<{ kind: 'link'; from: string; x: number; y: number } | { kind: 'pen'; pts: number[] } | { kind: 'frame'; x: number; y: number; w: number; h: number } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const saveT = useRef<ReturnType<typeof setTimeout>>();
  const history = useRef<CanvasData[]>([]);

  useEffect(() => setLocal(initial), [initial]);

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
    const onNode = (e.target as HTMLElement).closest('[data-node]');
    const p = toWorld(e.clientX, e.clientY);
    if (tool === 'pen') {
      e.preventDefault();
      setDraft({ kind: 'pen', pts: [p.x, p.y] });
      track(
        (ev) => {
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
      (ev) => setLocal((l) => ({ ...l, view: { ...l.view, x: ox + ev.clientX - sx, y: oy + ev.clientY - sy } })),
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

  const startLink = (e: React.PointerEvent, n: CanvasNode) => {
    e.stopPropagation();
    const p = toWorld(e.clientX, e.clientY);
    setDraft({ kind: 'link', from: n.id, ...p });
    track(
      (ev) => setDraft((d) => (d && d.kind === 'link' ? { ...d, ...toWorld(ev.clientX, ev.clientY) } : d)),
      (ev) => {
        const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-node]') as HTMLElement | null;
        const to = target?.dataset.node;
        setDraft(null);
        if (!to || to === n.id || local.edges.some((x) => x.from === n.id && x.to === to)) return;
        commit({ ...local, edges: [...local.edges, { id: uid('e'), from: n.id, to, style: edgeStyle, color: ink === '#ffffff' ? undefined : ink }] }, true);
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

  const anchorOf = (n: CanvasNode, toward: { x: number; y: number }) => {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const dx = toward.x - cx, dy = toward.y - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const s = Math.min(Math.abs(n.w / 2 / (dx || 1e-9)), Math.abs(n.h / 2 / (dy || 1e-9)));
    return { x: cx + dx * s, y: cy + dy * s };
  };
  const edgePath = (p1: { x: number; y: number }, p2: { x: number; y: number }, style: CanvasEdge['style']) => {
    if (style === 'elbow') {
      const mx = (p1.x + p2.x) / 2;
      return `M${p1.x},${p1.y} L${mx},${p1.y} L${mx},${p2.y} L${p2.x},${p2.y}`;
    }
    if (style === 'curve') {
      const dx = Math.abs(p2.x - p1.x) * 0.5 + 30;
      const sgn = p2.x >= p1.x ? 1 : -1;
      return `M${p1.x},${p1.y} C${p1.x + dx * sgn},${p1.y} ${p2.x - dx * sgn},${p2.y} ${p2.x},${p2.y}`;
    }
    return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
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

  const selNode = local.nodes.find((n) => n.id === sel);
  const selEdge = local.edges.find((e) => e.id === sel);
  const candidates = livePages(pages).filter((p) => normalize(p.title || '').includes(normalize(q))).slice(0, 12);
  const ordered = [...local.nodes].sort((a, b) => (a.kind === 'frame' ? -1 : 0) - (b.kind === 'frame' ? -1 : 0));
  const T = ({ id, icon, label }: { id: Tool; icon: React.ReactNode; label: string }) => (
    <button className={'dock-btn' + (tool === id ? ' on' : '')} onClick={() => setTool(id)} title={label}>{icon}</button>
  );

  return (
    <div className="canvas-shell">
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
            return (
              <div
                key={n.id}
                data-node={n.id}
                className={`cnode k-${n.kind} ${n.shape ? 's-' + n.shape : ''} ${sel === n.id ? 'sel' : ''} ${n.color === '#1e293b' ? 'dark' : ''}`}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h, ['--node' as any]: n.color }}
                onPointerDown={(e) => dragNode(e, n, 'move')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (n.kind === 'page' && target) useUi.getState().go({ name: 'page', id: target.id });
                  else if (['note', 'shape', 'text', 'frame'].includes(n.kind)) setEdit(n.id);
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
                  <svg className="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
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
                    <textarea autoFocus className="cnode-text" style={n.kind === 'text' ? { fontSize: n.fontSize, color: n.color } : undefined} value={n.text || ''} onChange={(e) => patchNode(n.id, { text: e.target.value })} onBlur={() => setEdit(null)} onPointerDown={(e) => e.stopPropagation()} />
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
                {n.kind !== 'draw' && <span className="cnode-link" title={t('canvas.connect')} onPointerDown={(e) => startLink(e, n)} />}
                <span className="cnode-resize" onPointerDown={(e) => dragNode(e, n, 'resize')} />
              </div>
            );
          })}
          <svg className="canvas-edges" width="1" height="1">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="context-stroke" />
              </marker>
            </defs>
            {local.edges.map((e) => {
              const a = local.nodes.find((n) => n.id === e.from), b = local.nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              const p1 = anchorOf(a, { x: b.x + b.w / 2, y: b.y + b.h / 2 }), p2 = anchorOf(b, { x: a.x + a.w / 2, y: a.y + a.h / 2 });
              const d = edgePath(p1, p2, e.style || 'straight');
              return (
                <g key={e.id} className={'edge' + (sel === e.id ? ' on' : '')} style={{ ['--edge' as any]: e.color || 'var(--muted)' }}
                  onPointerDown={(ev) => (ev.stopPropagation(), setSel(e.id))}
                  onDoubleClick={(ev) => { ev.stopPropagation(); const label = window.prompt(t('canvas.label'), e.label || ''); if (label !== null) commit({ ...local, edges: local.edges.map((x) => (x.id === e.id ? { ...x, label } : x)) }, true); }}>
                  <path d={d} className="edge-hit" />
                  <path d={d} className="edge-line" markerEnd="url(#arrow)" />
                  {e.label && <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 8} textAnchor="middle">{e.label}</text>}
                </g>
              );
            })}
            {draft?.kind === 'link' && (() => {
              const a = local.nodes.find((n) => n.id === draft.from);
              if (!a) return null;
              return <path d={edgePath(anchorOf(a, draft), draft, edgeStyle)} className="edge-draft" markerEnd="url(#arrow)" />;
            })()}
            {draft?.kind === 'pen' && <path d={strokePath(draft.pts)} stroke={ink} strokeWidth={penSize} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {draft?.kind === 'frame' && <rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} className="frame-draft" />}
          </svg>
        </div>

        {(selNode || selEdge) && (
          <div className="canvas-props" onPointerDown={(e) => e.stopPropagation()}>
            {selNode && !['image', 'page', 'frame'].includes(selNode.kind) &&
              (selNode.kind === 'draw' || selNode.kind === 'text' ? INK : NOTE_COLORS).map((c) => (
                <button key={c} className={'color-dot sm' + (selNode.color === c ? ' on' : '')} style={{ background: c }} onClick={() => patchNode(selNode.id, { color: c }, true)} />
              ))}
            {selNode?.kind === 'text' && (
              <>
                <button className="tb" onClick={() => patchNode(selNode.id, { fontSize: Math.max(12, (selNode.fontSize || 22) - 4) }, true)}>A−</button>
                <button className="tb" onClick={() => patchNode(selNode.id, { fontSize: Math.min(96, (selNode.fontSize || 22) + 4) }, true)}>A+</button>
              </>
            )}
            {selEdge && (
              <>
                {(['straight', 'elbow', 'curve'] as const).map((s) => (
                  <button key={s} className={'tb' + ((selEdge.style || 'straight') === s ? ' on' : '')} onClick={() => commit({ ...local, edges: local.edges.map((x) => (x.id === selEdge.id ? { ...x, style: s } : x)) }, true)}>
                    {s === 'straight' ? <Slash size={15} /> : s === 'elbow' ? <CornerDownRight size={15} /> : <Spline size={15} />}
                  </button>
                ))}
                {INK.slice(0, 8).map((c) => <button key={c} className="color-dot sm" style={{ background: c }} onClick={() => commit({ ...local, edges: local.edges.map((x) => (x.id === selEdge.id ? { ...x, color: c } : x)) }, true)} />)}
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
