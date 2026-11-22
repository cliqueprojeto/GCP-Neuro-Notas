import type { CanvasEdge, CanvasNode, Side } from '../lib/types';
import { uid } from '../lib/crypto';

/** Banco de diagramas por categoria (como o SmartArt): cada modelo gera nós e conectores a partir de uma lista de itens. */
export type DiagCat = 'list' | 'process' | 'cycle' | 'hierarchy' | 'relation' | 'matrix' | 'pyramid' | 'mind' | 'other';
export const DIAG_CATS: DiagCat[] = ['list', 'process', 'cycle', 'hierarchy', 'mind', 'relation', 'matrix', 'pyramid', 'other'];
export interface DiagItem { text: string; level: number }
export interface DiagOut { nodes: CanvasNode[]; edges: CanvasEdge[] }
export interface DiagTemplate { id: string; cat: DiagCat; tree?: boolean; min: number; max: number; def: number; gen: (items: DiagItem[], pal: string[]) => DiagOut }

export const PALETTES: Record<string, string[]> = {
  vivid: ['#8b5cf6', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1'],
  pastel: ['#ddd6fe', '#bfdbfe', '#bbf7d0', '#fde68a', '#fecaca', '#fbcfe8', '#99f6e4', '#c7d2fe'],
  ocean: ['#0ea5e9', '#0284c7', '#0369a1', '#06b6d4', '#14b8a6', '#0891b2', '#075985', '#22d3ee'],
  sunset: ['#f97316', '#fb7185', '#f59e0b', '#e11d48', '#fbbf24', '#c026d3', '#ea580c', '#f472b6'],
  forest: ['#16a34a', '#65a30d', '#15803d', '#84cc16', '#059669', '#4d7c0f', '#22c55e', '#a3e635'],
  mono: ['#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#5b21b6', '#4c1d95', '#ddd6fe'],
  graphite: ['#1e293b', '#334155', '#475569', '#64748b', '#0f172a', '#94a3b8', '#1f2937', '#52525b'],
};

const box = (x: number, y: number, w: number, h: number, text: string, color: string, extra: Partial<CanvasNode> = {}): CanvasNode =>
  ({ id: uid('n'), kind: 'shape', shape: 'rect', x, y, w, h, text, color, ...extra });
const edge = (a: CanvasNode, b: CanvasNode, p: Partial<CanvasEdge> = {}): CanvasEdge => ({ id: uid('e'), from: a.id, to: b.id, arrow: 'end', style: 'curve', ...p });
const tops = (items: DiagItem[]) => items.filter((i) => i.level === 0);
const pc = (pal: string[], i: number) => pal[i % pal.length];
const lighten = (hex: string, k = 0.55) => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * k).toString(16).padStart(2, '0');
  return `#${m(r)}${m(g)}${m(b)}`;
};
/** Agrupa a lista com recuo em árvore: { text, children }. */
interface TNode { text: string; children: TNode[] }
function toTree(items: DiagItem[]): TNode[] {
  const roots: TNode[] = [];
  const stack: { lvl: number; n: TNode }[] = [];
  for (const it of items) {
    const n = { text: it.text, children: [] };
    while (stack.length && stack[stack.length - 1].lvl >= it.level) stack.pop();
    if (stack.length) stack[stack.length - 1].n.children.push(n);
    else roots.push(n);
    stack.push({ lvl: it.level, n });
  }
  return roots;
}
const leaves = (t: TNode): number => (t.children.length ? t.children.reduce((s, c) => s + leaves(c), 0) : 1);

const W = 190, H = 96, G = 46;

export const DIAGRAMS: DiagTemplate[] = [
  /* ---------- Lista ---------- */
  { id: 'list-blocks', cat: 'list', min: 2, max: 8, def: 4, gen: (it, pal) => ({ nodes: tops(it).map((x, i) => box(i * (W + 24), 0, W, H + 20, x.text, pc(pal, i))), edges: [] }) },
  { id: 'list-stack', cat: 'list', min: 2, max: 8, def: 4, gen: (it, pal) => {
    const nodes: CanvasNode[] = [];
    tops(it).forEach((x, i) => {
      nodes.push(box(0, i * 84, 70, 70, String(i + 1), pc(pal, i), { shape: 'ellipse' }));
      nodes.push(box(86, i * 84 + 4, 380, 62, x.text, lighten(pc(pal, i), 0.78)));
    });
    return { nodes, edges: [] };
  } },
  { id: 'list-grouped', cat: 'list', tree: true, min: 2, max: 12, def: 9, gen: (it, pal) => {
    const nodes: CanvasNode[] = [];
    toTree(it).forEach((g, i) => {
      const x = i * (W + 40);
      nodes.push(box(x, 0, W + 10, 70, g.text, pc(pal, i)));
      g.children.forEach((c, j) => nodes.push(box(x + 12, 86 + j * 64, W - 14, 52, c.text, lighten(pc(pal, i), 0.75))));
    });
    return { nodes, edges: [] };
  } },
  { id: 'list-grid', cat: 'list', min: 2, max: 12, def: 6, gen: (it, pal) => {
    const t = tops(it), cols = t.length <= 4 ? 2 : 3;
    return { nodes: t.map((x, i) => box((i % cols) * (W + 22), Math.floor(i / cols) * (H + 22), W, H, x.text, pc(pal, i))), edges: [] };
  } },
  /* ---------- Processo ---------- */
  { id: 'process-basic', cat: 'process', min: 2, max: 8, def: 4, gen: (it, pal) => {
    const nodes = tops(it).map((x, i) => box(i * (W + G + 20), 0, W, H, x.text, pc(pal, i)));
    return { nodes, edges: nodes.slice(1).map((n, i) => edge(nodes[i], n, { fromSide: 'r', toSide: 'l', style: 'straight', width: 3 })) };
  } },
  { id: 'process-chevron', cat: 'process', min: 2, max: 8, def: 5, gen: (it, pal) => ({
    nodes: tops(it).map((x, i) => box(i * (W - 22), 0, W, H, x.text, pc(pal, i), { shape: 'poly', poly: i === 0 ? '0,0 82,0 100,50 82,100 0,100' : '0,0 82,0 100,50 82,100 0,100 18,50' })), edges: [] }) },
  { id: 'process-steps', cat: 'process', min: 2, max: 7, def: 4, gen: (it, pal) => {
    const t = tops(it);
    const nodes = t.map((x, i) => box(i * (W + 12), (t.length - 1 - i) * 70, W, 70 + 0, x.text, pc(pal, i)));
    return { nodes, edges: nodes.slice(1).map((n, i) => edge(nodes[i], n, { fromSide: 't', toSide: 'l', style: 'elbow' })) };
  } },
  { id: 'process-timeline', cat: 'process', min: 2, max: 8, def: 5, gen: (it, pal) => {
    const t = tops(it), step = W + 20;
    const nodes: CanvasNode[] = [box(-20, 104, step * t.length + 20, 8, '', '#94a3b8')];
    const edges: CanvasEdge[] = [];
    t.forEach((x, i) => {
      const cx = i * step + W / 2;
      const dot = box(cx - 18, 90, 36, 36, String(i + 1), pc(pal, i), { shape: 'ellipse' });
      const up = i % 2 === 0;
      const card = box(i * step, up ? -30 : 170, W, 76, x.text, lighten(pc(pal, i), 0.78));
      nodes.push(dot, card);
      edges.push(edge(dot, card, { arrow: 'none', style: 'straight', fromSide: up ? 't' : 'b', toSide: up ? 'b' : 't', color: pc(pal, i) }));
    });
    return { nodes, edges };
  } },
  { id: 'process-vertical', cat: 'process', min: 2, max: 8, def: 4, gen: (it, pal) => {
    const nodes = tops(it).map((x, i) => box(0, i * (H + G), W + 120, H - 10, x.text, pc(pal, i)));
    return { nodes, edges: nodes.slice(1).map((n, i) => edge(nodes[i], n, { fromSide: 'b', toSide: 't', style: 'straight', width: 3 })) };
  } },
  /* ---------- Ciclo ---------- */
  { id: 'cycle-basic', cat: 'cycle', min: 3, max: 8, def: 5, gen: (it, pal) => {
    const t = tops(it), R = 120 + t.length * 22;
    const nodes = t.map((x, i) => { const a = -Math.PI / 2 + (i / t.length) * Math.PI * 2; return box(Math.cos(a) * R - 75, Math.sin(a) * R - 45, 150, 90, x.text, pc(pal, i), { shape: 'ellipse' }); });
    return { nodes, edges: nodes.map((n, i) => edge(n, nodes[(i + 1) % nodes.length], { style: 'curve', width: 3, color: pc(pal, i) })) };
  } },
  { id: 'cycle-hub', cat: 'cycle', min: 3, max: 8, def: 6, gen: (it, pal) => {
    const t = tops(it), R = 150 + t.length * 18;
    const hub = box(-85, -85, 170, 170, t[0]?.text || '', pc(pal, 0), { shape: 'ellipse' });
    const nodes = [hub, ...t.slice(1).map((x, i, arr) => { const a = -Math.PI / 2 + (i / arr.length) * Math.PI * 2; return box(Math.cos(a) * R - 70, Math.sin(a) * R - 42, 140, 84, x.text, pc(pal, i + 1), { shape: 'ellipse' }); })];
    const ring = nodes.slice(1);
    return { nodes, edges: ring.map((n, i) => edge(n, ring[(i + 1) % ring.length], { style: 'curve', color: pc(pal, i + 1) })) };
  } },
  { id: 'cycle-radial', cat: 'cycle', min: 3, max: 9, def: 6, gen: (it, pal) => {
    const t = tops(it), R = 170 + t.length * 14;
    const hub = box(-90, -90, 180, 180, t[0]?.text || '', pc(pal, 0), { shape: 'ellipse' });
    const out = t.slice(1).map((x, i, arr) => { const a = -Math.PI / 2 + (i / arr.length) * Math.PI * 2; return box(Math.cos(a) * R - 70, Math.sin(a) * R - 70, 140, 140, x.text, lighten(pc(pal, i + 1), 0.25), { shape: 'ellipse' }); });
    return { nodes: [hub, ...out], edges: out.map((n) => edge(hub, n, { arrow: 'none', style: 'straight', width: 3 })) };
  } },
  /* ---------- Hierarquia ---------- */
  { id: 'org-chart', cat: 'hierarchy', tree: true, min: 2, max: 20, def: 7, gen: (it, pal) => {
    const nodes: CanvasNode[] = [], edges: CanvasEdge[] = [];
    const cw = W + 24, ch = H + 70;
    let cursor = 0;
    const place = (t: TNode, depth: number, color: string): CanvasNode => {
      const kids = t.children.map((c, i) => place(c, depth + 1, depth === 0 ? pc(pal, i + 1) : lighten(color, 0.35)));
      let x: number;
      if (kids.length) x = (kids[0].x + kids[kids.length - 1].x) / 2;
      else (x = cursor * cw), cursor++;
      const n = box(x, depth * ch, W, H - 10, t.text, depth === 0 ? pc(pal, 0) : color);
      nodes.push(n);
      kids.forEach((k) => edges.push(edge(n, k, { style: 'elbow', arrow: 'none', fromSide: 'b', toSide: 't' })));
      return n;
    };
    toTree(it).forEach((r) => place(r, 0, pc(pal, 0)));
    return { nodes, edges };
  } },
  { id: 'tree-horizontal', cat: 'hierarchy', tree: true, min: 2, max: 20, def: 7, gen: (it, pal) => {
    const nodes: CanvasNode[] = [], edges: CanvasEdge[] = [];
    const cw = W + 80, ch = 78;
    let cursor = 0;
    const place = (t: TNode, depth: number, color: string): CanvasNode => {
      const kids = t.children.map((c, i) => place(c, depth + 1, depth === 0 ? pc(pal, i + 1) : lighten(color, 0.35)));
      let y: number;
      if (kids.length) y = (kids[0].y + kids[kids.length - 1].y) / 2;
      else (y = cursor * ch), cursor++;
      const n = box(depth * cw, y, W, 62, t.text, color);
      nodes.push(n);
      kids.forEach((k) => edges.push(edge(n, k, { style: 'curve', arrow: 'none', fromSide: 'r', toSide: 'l', color })));
      return n;
    };
    toTree(it).forEach((r) => place(r, 0, pc(pal, 0)));
    return { nodes, edges };
  } },
  /* ---------- Mapa mental ---------- */
  { id: 'mind-map', cat: 'mind', tree: true, min: 2, max: 30, def: 11, gen: (it, pal) => {
    const roots = toTree(it);
    const root = roots[0] || { text: '', children: [] };
    const nodes: CanvasNode[] = [], edges: CanvasEdge[] = [];
    const center = box(-110, -55, 220, 110, root.text, pc(pal, 0), { shape: 'ellipse', fontSize: 20 });
    nodes.push(center);
    const branches = root.children;
    const right = branches.filter((_, i) => i % 2 === 0), left = branches.filter((_, i) => i % 2 === 1);
    const side = (list: TNode[], dir: 1 | -1, startIdx: number) => {
      const total = list.reduce((s, b) => s + Math.max(1, leaves(b)), 0);
      let yCur = -(total * 62) / 2;
      list.forEach((b, k) => {
        const color = pc(pal, startIdx + k * 2 + 1);
        const span = Math.max(1, leaves(b)) * 62;
        const by = yCur + span / 2 - 28;
        const bn = box(dir > 0 ? 210 : -210 - 180, by, 180, 56, b.text, color);
        nodes.push(bn);
        edges.push(edge(center, bn, { arrow: 'none', style: 'curve', color, width: 3, fromSide: dir > 0 ? 'r' : 'l', toSide: dir > 0 ? 'l' : 'r' }));
        let cy = yCur;
        const sub = (t: TNode, depth: number, parent: CanvasNode) => {
          t.children.forEach((c) => {
            const s = Math.max(1, leaves(c)) * 62;
            const x = dir > 0 ? 210 + depth * 220 : -210 - 180 - depth * 220;
            const cn = box(x, cy + s / 2 - 22, 170, 44, c.text, lighten(color, 0.72), { shape: 'rect' });
            nodes.push(cn);
            edges.push(edge(parent, cn, { arrow: 'none', style: 'curve', color, fromSide: dir > 0 ? 'r' : 'l', toSide: dir > 0 ? 'l' : 'r' }));
            if (c.children.length) sub(c, depth + 1, cn);
            else cy += s;
          });
        };
        if (b.children.length) sub(b, 1, bn);
        yCur += span;
      });
    };
    side(right, 1, 0);
    side(left, -1, 1);
    return { nodes, edges };
  } },
  { id: 'mind-bubbles', cat: 'mind', tree: true, min: 2, max: 24, def: 9, gen: (it, pal) => {
    const root = toTree(it)[0] || { text: '', children: [] };
    const nodes: CanvasNode[] = [], edges: CanvasEdge[] = [];
    const c = box(-90, -90, 180, 180, root.text, pc(pal, 0), { shape: 'ellipse' });
    nodes.push(c);
    const n = root.children.length || 1, R = 230 + n * 10;
    root.children.forEach((b, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const color = pc(pal, i + 1);
      const bx = Math.cos(a) * R, by = Math.sin(a) * R;
      const bn = box(bx - 70, by - 70, 140, 140, b.text, color, { shape: 'ellipse' });
      nodes.push(bn);
      edges.push(edge(c, bn, { arrow: 'none', style: 'straight', color, width: 3 }));
      b.children.forEach((s, j) => {
        const aa = a + (j - (b.children.length - 1) / 2) * 0.42;
        const sn = box(bx + Math.cos(aa) * 150 - 50, by + Math.sin(aa) * 150 - 50, 100, 100, s.text, lighten(color, 0.6), { shape: 'ellipse' });
        nodes.push(sn);
        edges.push(edge(bn, sn, { arrow: 'none', style: 'straight', color }));
      });
    });
    return { nodes, edges };
  } },
  /* ---------- Relação ---------- */
  { id: 'venn', cat: 'relation', min: 2, max: 4, def: 3, gen: (it, pal) => {
    const t = tops(it).slice(0, 4), S = 250;
    const pos = t.length === 2 ? [[0, 0], [160, 0]] : t.length === 3 ? [[0, 0], [160, 0], [80, 135]] : [[0, 0], [160, 0], [0, 150], [160, 150]];
    return { nodes: t.map((x, i) => box(pos[i][0], pos[i][1], S, S, x.text, pc(pal, i), { shape: 'ellipse', fill: 'glass' })), edges: [] };
  } },
  { id: 'converge', cat: 'relation', min: 3, max: 8, def: 5, gen: (it, pal) => {
    const t = tops(it), ins = t.slice(1);
    const target = box(W + 160, ((ins.length - 1) * 86) / 2 - 20, W + 10, H + 40, t[0]?.text || '', pc(pal, 0), { shape: 'ellipse' });
    const src = ins.map((x, i) => box(0, i * 86, W, 66, x.text, pc(pal, i + 1)));
    return { nodes: [target, ...src], edges: src.map((s, i) => edge(s, target, { fromSide: 'r', toSide: 'l', color: pc(pal, i + 1), width: 2 })) };
  } },
  { id: 'diverge', cat: 'relation', min: 3, max: 8, def: 5, gen: (it, pal) => {
    const t = tops(it), outs = t.slice(1);
    const src = box(0, ((outs.length - 1) * 86) / 2 - 20, W + 10, H + 40, t[0]?.text || '', pc(pal, 0), { shape: 'ellipse' });
    const dst = outs.map((x, i) => box(W + 170, i * 86, W, 66, x.text, pc(pal, i + 1)));
    return { nodes: [src, ...dst], edges: dst.map((d, i) => edge(src, d, { fromSide: 'r', toSide: 'l', color: pc(pal, i + 1) })) };
  } },
  { id: 'versus', cat: 'relation', tree: true, min: 2, max: 12, def: 8, gen: (it, pal) => {
    const g = toTree(it).slice(0, 2);
    const nodes: CanvasNode[] = [];
    g.forEach((col, i) => {
      const x = i * (W + 140);
      nodes.push(box(x, 0, W + 40, 76, col.text, pc(pal, i === 0 ? 2 : 4)));
      col.children.forEach((c, j) => nodes.push(box(x, 92 + j * 62, W + 40, 50, c.text, lighten(pc(pal, i === 0 ? 2 : 4), 0.75))));
    });
    if (g.length === 2) nodes.push(box(W + 52, 8, 76, 60, 'VS', '#1e293b', { shape: 'ellipse' }));
    return { nodes, edges: [] };
  } },
  /* ---------- Matriz ---------- */
  { id: 'matrix-2x2', cat: 'matrix', min: 4, max: 4, def: 4, gen: (it, pal) => ({
    nodes: tops(it).slice(0, 4).map((x, i) => box((i % 2) * 262, Math.floor(i / 2) * 182, 250, 170, x.text, pc(pal, i), { shape: 'rect' })), edges: [] }) },
  { id: 'swot', cat: 'matrix', tree: true, min: 4, max: 16, def: 8, gen: (it) => {
    const cols = ['#22c55e', '#f59e0b', '#38bdf8', '#ef4444'];
    const g = toTree(it).slice(0, 4);
    return { nodes: g.map((q, i) => box((i % 2) * 302, Math.floor(i / 2) * 222, 290, 210, q.text + (q.children.length ? '\n\n' + q.children.map((c) => '• ' + c.text).join('\n') : ''), lighten(cols[i], 0.7))), edges: [] };
  } },
  { id: 'matrix-axis', cat: 'matrix', min: 4, max: 4, def: 4, gen: (it, pal) => {
    const t = tops(it).slice(0, 4);
    const nodes = t.map((x, i) => box((i % 2) * 270 + 10, Math.floor(i / 2) * 190 + 10, 240, 160, x.text, lighten(pc(pal, i), 0.55)));
    nodes.push(box(-20, 186, 580, 6, '', '#475569'), box(266, -20, 6, 420, '', '#475569'));
    return { nodes, edges: [] };
  } },
  /* ---------- Pirâmide ---------- */
  { id: 'pyramid', cat: 'pyramid', min: 2, max: 7, def: 4, gen: (it, pal) => {
    const t = tops(it), n = t.length, LH = 74, BW = 120 + n * 110;
    return { nodes: t.map((x, i) => {
      const topW = (BW * i) / n, botW = (BW * (i + 1)) / n, inset = ((botW - topW) / 2 / botW) * 100;
      return box((BW - botW) / 2, i * (LH + 4), botW, LH, x.text, pc(pal, i), { shape: 'poly', poly: i === 0 ? '50,0 100,100 0,100' : `${inset.toFixed(1)},0 ${(100 - inset).toFixed(1)},0 100,100 0,100` });
    }), edges: [] };
  } },
  { id: 'funnel', cat: 'pyramid', min: 2, max: 7, def: 4, gen: (it, pal) => {
    const t = tops(it), n = t.length, LH = 70, BW = 200 + n * 90, minW = 120;
    return { nodes: t.map((x, i) => {
      const topW = BW - ((BW - minW) * i) / n, botW = BW - ((BW - minW) * (i + 1)) / n, inset = ((topW - botW) / 2 / topW) * 100;
      return box((BW - topW) / 2, i * (LH + 4), topW, LH, x.text, pc(pal, i), { shape: 'poly', poly: `0,0 100,0 ${(100 - inset).toFixed(1)},100 ${inset.toFixed(1)},100` });
    }), edges: [] };
  } },
  { id: 'pyramid-list', cat: 'pyramid', min: 2, max: 6, def: 4, gen: (it, pal) => {
    const t = tops(it), n = t.length, LH = 70, BW = 300;
    const nodes: CanvasNode[] = [];
    t.forEach((x, i) => {
      const topW = (BW * i) / n, botW = (BW * (i + 1)) / n, inset = ((botW - topW) / 2 / botW) * 100;
      nodes.push(box((BW - botW) / 2, i * (LH + 4), botW, LH, String(i + 1), pc(pal, i), { shape: 'poly', poly: i === 0 ? '50,0 100,100 0,100' : `${inset.toFixed(1)},0 ${(100 - inset).toFixed(1)},0 100,100 0,100` }));
      nodes.push(box(BW + 30, i * (LH + 4) + 8, 300, LH - 16, x.text, lighten(pc(pal, i), 0.8)));
    });
    return { nodes, edges: [] };
  } },
  /* ---------- Outros ---------- */
  { id: 'fishbone', cat: 'other', tree: true, min: 3, max: 16, def: 9, gen: (it, pal) => {
    const roots = toTree(it), head = roots[0] || { text: '', children: [] };
    const causes = head.children;
    const half = Math.ceil(causes.length / 2), L = 260 * Math.max(2, half);
    const nodes: CanvasNode[] = [], edges: CanvasEdge[] = [];
    const spineA = box(-10, 196, 10, 10, '', '#475569', { shape: 'ellipse' });
    const headN = box(L, 150, 200, 100, head.text, pc(pal, 0), { shape: 'poly', poly: '0,0 80,0 100,50 80,100 0,100' });
    nodes.push(spineA, headN);
    edges.push(edge(spineA, headN, { arrow: 'none', style: 'straight', width: 5, fromSide: 'r', toSide: 'l', color: '#475569' }));
    causes.forEach((c, i) => {
      const up = i % 2 === 0, k = Math.floor(i / 2);
      const x = 40 + k * 260;
      const cn = box(x, up ? 0 : 340, 200, 62, c.text, pc(pal, i + 1));
      const anchor = box(x + 150, 198, 6, 6, '', '#475569', { shape: 'ellipse' });
      nodes.push(cn, anchor);
      edges.push(edge(cn, anchor, { arrow: 'end', style: 'straight', fromSide: up ? 'b' : 't', color: pc(pal, i + 1), width: 2 }));
      c.children.forEach((s, j) => nodes.push(box(x - 10, up ? 74 + j * 34 : 290 - j * 34, 150, 28, s.text, lighten(pc(pal, i + 1), 0.8))));
    });
    return { nodes, edges };
  } },
  { id: 'roadmap', cat: 'other', min: 2, max: 8, def: 5, gen: (it, pal) => {
    const t = tops(it);
    const nodes: CanvasNode[] = [], edges: CanvasEdge[] = [];
    t.forEach((x, i) => {
      const pin = box(i * 230, i % 2 ? 120 : 0, 64, 64, String(i + 1), pc(pal, i), { shape: 'poly', poly: '50,0 100,40 50,100 0,40' });
      const card = box(i * 230 - 50, (i % 2 ? 120 : 0) + 80, 170, 64, x.text, lighten(pc(pal, i), 0.8));
      nodes.push(pin, card);
      if (i) edges.push(edge(nodes[(i - 1) * 2], pin, { arrow: 'none', style: 'curve', dash: 'dashed', width: 3, color: '#94a3b8', fromSide: 'r', toSide: 'l' }));
    });
    return { nodes, edges };
  } },
];

/** Converte texto (um item por linha; recuo com espaços, tab ou "-" define o nível) em itens. */
export function parseItems(text: string): DiagItem[] {
  return text.split('\n').map((l) => {
    const m = l.match(/^(\s*)([-*•]\s*)?(.*)$/)!;
    const indent = m[1].replace(/\t/g, '  ').length;
    return { text: m[3].trim(), level: Math.floor(indent / 2) + (m[2] && indent === 0 && l.trim().startsWith('-') ? 1 : 0) };
  }).filter((x) => x.text);
}

/** Itens de exemplo para cada modelo, no idioma do usuário. */
export function sampleText(tpl: DiagTemplate, count: number, L: (k: string) => string): string {
  const step = (i: number) => `${L('diag.s.item')} ${i + 1}`;
  if (tpl.id === 'swot') return [L('diag.s.strengths'), '  …', L('diag.s.weaknesses'), '  …', L('diag.s.opportunities'), '  …', L('diag.s.threats'), '  …'].join('\n');
  if (tpl.id === 'versus') return [L('diag.s.pros'), '  …', '  …', '  …', L('diag.s.cons'), '  …', '  …', '  …'].join('\n');
  if (tpl.id === 'matrix-2x2' || tpl.id === 'matrix-axis') return [L('diag.s.q1'), L('diag.s.q2'), L('diag.s.q3'), L('diag.s.q4')].join('\n');
  if (tpl.id === 'mind-map' || tpl.id === 'mind-bubbles') {
    const lines = [L('diag.s.central')];
    const br = Math.max(2, Math.round((count - 1) / 2.5));
    for (let i = 0; i < br; i++) { lines.push(`  ${L('diag.s.branch')} ${i + 1}`); if (lines.length < count) lines.push(`    ${L('diag.s.idea')} ${i + 1}.1`); if (lines.length < count && i % 2 === 0) lines.push(`    ${L('diag.s.idea')} ${i + 1}.2`); }
    return lines.slice(0, Math.max(count, br + 1)).join('\n');
  }
  if (tpl.id === 'fishbone') {
    const lines = [L('diag.s.effect')];
    for (let i = 0; i < Math.max(2, Math.round((count - 1) / 2)); i++) lines.push(`  ${L('diag.s.cause')} ${i + 1}`, `    ${L('diag.s.detail')}`);
    return lines.join('\n');
  }
  if (tpl.id === 'org-chart' || tpl.id === 'tree-horizontal') {
    const lines = [L('diag.s.root')];
    const br = Math.max(2, Math.min(4, Math.round((count - 1) / 2)));
    let used = 1;
    for (let i = 0; i < br; i++) { lines.push(`  ${L('diag.s.branch')} ${i + 1}`); used++; }
    for (let i = 0; used < count; i++, used++) lines.splice(lines.findIndex((l) => l === `  ${L('diag.s.branch')} ${(i % br) + 1}`) + 1, 0, `    ${L('diag.s.item')} ${(i % br) + 1}.${Math.floor(i / br) + 1}`);
    return lines.join('\n');
  }
  if (tpl.id === 'list-grouped') {
    const lines: string[] = [];
    const g = Math.max(2, Math.round(count / 3));
    for (let i = 0; i < g; i++) lines.push(`${L('diag.s.group')} ${i + 1}`, `  ${step(0)}`, `  ${step(1)}`);
    return lines.join('\n');
  }
  if (tpl.cat === 'cycle' && tpl.id !== 'cycle-basic') return [L('diag.s.central'), ...Array.from({ length: count - 1 }, (_, i) => step(i))].join('\n');
  if (tpl.id === 'converge' || tpl.id === 'diverge') return [L('diag.s.central'), ...Array.from({ length: count - 1 }, (_, i) => step(i))].join('\n');
  return Array.from({ length: count }, (_, i) => (tpl.cat === 'process' ? `${L('diag.s.step')} ${i + 1}` : step(i))).join('\n');
}

/** Gera e posiciona o diagrama com o centro em (cx, cy). */
export function buildDiagram(tpl: DiagTemplate, text: string, palette: string, cx: number, cy: number, opts: { style?: 'square' | 'rounded' | 'pill'; frame?: string } = {}): DiagOut {
  const items = parseItems(text);
  const out = tpl.gen(items.length ? items : [{ text: '…', level: 0 }], PALETTES[palette] || PALETTES.vivid);
  if (opts.style && opts.style !== 'rounded') for (const n of out.nodes) if (n.shape === 'rect' && n.w > 20 && n.h > 20) n.corner = opts.style === 'pill' ? 'pill' : 'square';
  const minX = Math.min(...out.nodes.map((n) => n.x)), minY = Math.min(...out.nodes.map((n) => n.y));
  const maxX = Math.max(...out.nodes.map((n) => n.x + n.w)), maxY = Math.max(...out.nodes.map((n) => n.y + n.h));
  const dx = cx - (minX + maxX) / 2, dy = cy - (minY + maxY) / 2;
  for (const n of out.nodes) (n.x = Math.round(n.x + dx)), (n.y = Math.round(n.y + dy));
  if (opts.frame !== undefined) {
    const pad = 50;
    out.nodes.unshift({ id: uid('n'), kind: 'frame', x: Math.round(minX + dx - pad), y: Math.round(minY + dy - pad), w: Math.round(maxX - minX + pad * 2), h: Math.round(maxY - minY + pad * 2), color: '#ffffff', text: opts.frame });
  }
  return out;
}

