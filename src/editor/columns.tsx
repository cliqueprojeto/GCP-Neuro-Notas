import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Square, Trash2, X } from 'lucide-react';
import { CustomColors } from '../components/ColorPicker';
import { useT } from '../i18n';

/** Proporções disponíveis por quantidade de colunas. */
export const LAYOUTS: { id: string; cols: number[] }[] = [
  { id: '1-1', cols: [1, 1] },
  { id: '2-1', cols: [2, 1] },
  { id: '1-2', cols: [1, 2] },
  { id: '1-1-1', cols: [1, 1, 1] },
  { id: '1-2-1', cols: [1, 2, 1] },
  { id: '2-1-1', cols: [2, 1, 1] },
  { id: '1-1-1-1', cols: [1, 1, 1, 1] },
  { id: '1-1-1-1-1', cols: [1, 1, 1, 1, 1] },
];
export const COL_STYLES = ['plain', 'cards', 'bordered', 'shaded', 'accent', 'glass'] as const;
export type ColStyle = (typeof COL_STYLES)[number];

/** Ícone de layout: miniatura nítida das colunas (retângulos retos, proporção real). */
export function LayoutIcon({ cols, size = 34, active }: { cols: number[]; style?: ColStyle | 'sidebar'; size?: number; active?: boolean }) {
  const H = Math.round(size), W = Math.round(size * 1.5), pad = Math.max(2, Math.round(size * 0.14)), gap = Math.max(1.5, size * 0.1);
  const total = cols.reduce((a, b) => a + b, 0);
  const inner = W - pad * 2 - gap * (cols.length - 1);
  const r = Math.max(1, size * 0.08);
  let x = pad;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={'layout-ic' + (active ? ' on' : '')} aria-hidden>
      <rect x="0.75" y="0.75" width={W - 1.5} height={H - 1.5} rx={r + 1.5} className="lic-frame" />
      {cols.map((c, i) => {
        const w = (inner * c) / total;
        const el = <rect key={i} x={x} y={pad} width={w} height={H - pad * 2} rx={r} className={'lic-col' + (c === Math.max(...cols) && cols.some((k) => k !== c) ? ' big' : '')} />;
        x += w + gap;
        return el;
      })}
    </svg>
  );
}

export interface ColBox { bStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double'; bWidth?: number; bColor?: string; bg?: string; bgAlpha?: number; radius?: number; target?: 'cols' | 'block' }
export const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double'] as const;

/** Variáveis CSS da borda/fundo personalizados (usadas na tela e na exportação). */
export function boxVars(b?: ColBox | null): Record<string, string> | null {
  if (!b || (!b.bg && (!b.bStyle || b.bStyle === 'none'))) return null;
  const v: Record<string, string> = {};
  v['--cb-border'] = b.bStyle && b.bStyle !== 'none' ? `${b.bWidth ?? 2}px ${b.bStyle} ${b.bColor || '#8b5cf6'}` : '0 solid transparent';
  v['--cb-bg'] = b.bg ? `color-mix(in srgb, ${b.bg} ${b.bgAlpha ?? 100}%, transparent)` : 'transparent';
  v['--cb-radius'] = `${b.radius ?? 14}px`;
  return v;
}
const styleStr = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';');

function ColumnsView({ node, updateAttributes, deleteNode, editor, getPos, selected }: NodeViewProps) {
  const t = useT();
  const layout = (node.attrs.layout as string) || '1-1';
  const style = (node.attrs.style as ColStyle) || 'plain';
  const box = (node.attrs.box as ColBox | null) || null;
  const bv = boxVars(box);
  const [boxOpen, setBoxOpen] = useState(false);
  const setBox = (p: Partial<ColBox>) => updateAttributes({ box: { target: 'cols', ...(box || {}), ...p } });
  const cols = layout.split('-').map(Number);
  const n = node.childCount;
  const editable = editor.isEditable;
  const [barOpen, setBarOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!barOpen) return;
    const off = (e: MouseEvent) => { const el = e.target as HTMLElement; if (!barRef.current?.contains(el) && !el.closest('.cols-chip, .popover, .eyedrop-layer')) (setBarOpen(false), setBoxOpen(false)); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [barOpen]);
  const setCount = (k: number) => {
    if (k < 1 || k > 5 || typeof getPos !== 'function') return;
    const pos = getPos();
    const tr = editor.state.tr;
    if (k > n) {
      const add = Array.from({ length: k - n }, () => editor.schema.nodes.column.create(null, editor.schema.nodes.paragraph.create()));
      tr.insert(pos + node.nodeSize - 1, add);
    } else {
      // junta o conteúdo das colunas removidas na última que fica
      let end = pos + node.nodeSize - 1;
      for (let i = n - 1; i >= k; i--) {
        const child = node.child(i);
        const start = end - child.nodeSize;
        const content = child.content;
        tr.delete(start, end);
        const target = tr.doc.resolve(start - 1);
        if (content.size && !(content.childCount === 1 && content.firstChild!.content.size === 0)) tr.insert(target.pos, content);
        end = start;
      }
    }
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, layout: Array(k).fill(1).join('-') });
    editor.view.dispatch(tr);
  };
  const choose = (id: string) => {
    const k = id.split('-').length;
    if (k !== n) setCount(k);
    // depois de ajustar a quantidade, aplica a proporção
    setTimeout(() => updateAttributes({ layout: id }), 0);
  };
  const template = (cols.length === n ? cols : Array(n).fill(1)).map((c) => `minmax(0, ${c}fr)`).join(' ');
  return (
    <NodeViewWrapper className={`cols-block cs-${style}` + (bv ? ` cb-custom cb-${box?.target === 'block' ? 'block' : 'cols'}` : '') + (selected ? ' sel' : '') + (barOpen ? ' open' : '')} data-layout={layout} style={bv || undefined}>
      {editable && (
        <button className="cols-chip" contentEditable={false} onMouseDown={(e) => e.preventDefault()} onClick={() => setBarOpen(!barOpen)} title={t('cols.edit')}>
          <LayoutIcon cols={cols.length === n ? cols : Array(n).fill(1)} size={14} active /> {t('cols.edit')}
        </button>
      )}
      {editable && (barOpen || selected) && (
        <div className="cols-bar" contentEditable={false} ref={barRef}>
          {LAYOUTS.map((l) => (
            <button key={l.id} className={'cols-opt' + (l.id === layout ? ' on' : '')} title={l.id.replace(/-/g, ' : ')} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(l.id)}>
              <LayoutIcon cols={l.cols} size={18} active={l.id === layout} />
            </button>
          ))}
          <span className="tb-sep" />
          <button className="icon-btn xs" title={t('cols.remove')} disabled={n <= 1} onClick={() => setCount(n - 1)}><Minus size={13} /></button>
          <span className="cols-n">{n}</span>
          <button className="icon-btn xs" title={t('cols.add')} disabled={n >= 5} onClick={() => setCount(n + 1)}><Plus size={13} /></button>
          <span className="tb-sep" />
          <select className="cols-style" value={style} onChange={(e) => updateAttributes({ style: e.target.value })}>
            {COL_STYLES.map((s) => <option key={s} value={s}>{t(`cols.style.${s}` as any)}</option>)}
          </select>
          <button className={'icon-btn xs' + (boxOpen || bv ? ' on' : '')} title={t('cols.box')} onClick={() => setBoxOpen(!boxOpen)}><Square size={13} /></button>
          <button className="icon-btn xs danger-h" title={t('common.delete')} onClick={deleteNode}><Trash2 size={13} /></button>
          <button className="icon-btn xs" title={t('common.close')} onClick={() => setBarOpen(false)}><X size={13} /></button>
          {boxOpen && <BoxPanel box={box} set={setBox} clear={() => updateAttributes({ box: null })} />}
        </div>
      )}
      <NodeViewContent className="cols-grid" style={{ gridTemplateColumns: template }} />
    </NodeViewWrapper>
  );
}

const BORDER_COLORS = ['#8b5cf6', '#3b82f6', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#64748b', '#0f172a'];
const BG_COLORS = ['#ede9fe', '#dbeafe', '#ccfbf1', '#dcfce7', '#fef9c3', '#ffedd5', '#fee2e2', '#fce7f3', '#f1f5f9', '#1e293b'];

/** Painel de borda e fundo personalizados das colunas. */
function BoxPanel({ box, set, clear }: { box: ColBox | null; set: (p: Partial<ColBox>) => void; clear: () => void }) {
  const t = useT();
  const b = box || {};
  const bs = b.bStyle || 'none';
  const keep = (e: React.MouseEvent) => (e.target as HTMLElement).tagName !== 'INPUT' && e.preventDefault();
  return (
    <div className="cols-box" onMouseDown={keep}>
      <div className="cb-row">
        <span className="cb-label">{t('cols.box.apply')}</span>
        <div className="seg sm">
          <button className={(b.target || 'cols') === 'cols' ? 'on' : ''} onClick={() => set({ target: 'cols' })}>{t('cols.box.eachCol')}</button>
          <button className={b.target === 'block' ? 'on' : ''} onClick={() => set({ target: 'block' })}>{t('cols.box.block')}</button>
        </div>
      </div>
      <div className="cb-label">{t('cols.box.border')}</div>
      <div className="cb-styles">
        {BORDER_STYLES.map((k) => (
          <button key={k} className={'cb-style' + (bs === k ? ' on' : '')} title={t(`cols.box.${k}` as any)} onClick={() => set({ bStyle: k, bWidth: b.bWidth ?? (k === 'double' ? 4 : 2) })}>
            <span style={{ borderTop: k === 'none' ? '2px solid transparent' : `${k === 'double' ? 4 : 2}px ${k} currentColor` }} />
            <small>{t(`cols.box.${k}` as any)}</small>
          </button>
        ))}
      </div>
      {bs !== 'none' && (
        <>
          <div className="cb-row">
            <span className="cb-label">{t('cols.box.width')}</span>
            <input type="range" min={1} max={10} value={b.bWidth ?? 2} onChange={(e) => set({ bWidth: +e.target.value })} />
            <b className="cb-val">{b.bWidth ?? 2}px</b>
          </div>
          <div className="color-row wrap">
            {BORDER_COLORS.map((c) => <button key={c} className={'color-dot sm' + (b.bColor === c ? ' on' : '')} style={{ background: c }} onClick={() => set({ bColor: c })} />)}
            <CustomColors small value={b.bColor} onPick={(c) => set({ bColor: c })} />
          </div>
        </>
      )}
      <div className="cb-label">{t('cols.box.bg')}</div>
      <div className="color-row wrap">
        <button className={'color-dot sm none' + (!b.bg ? ' on' : '')} title={t('cols.box.noBg')} onClick={() => set({ bg: undefined })}>×</button>
        {BG_COLORS.map((c) => <button key={c} className={'color-dot sm' + (b.bg === c ? ' on' : '')} style={{ background: c }} onClick={() => set({ bg: c })} />)}
        <CustomColors small value={b.bg} onPick={(c) => set({ bg: c })} />
      </div>
      {b.bg && (
        <div className="cb-row">
          <span className="cb-label">{t('cols.box.opacity')}</span>
          <input type="range" min={10} max={100} step={5} value={b.bgAlpha ?? 100} onChange={(e) => set({ bgAlpha: +e.target.value })} />
          <b className="cb-val">{b.bgAlpha ?? 100}%</b>
        </div>
      )}
      <div className="cb-row">
        <span className="cb-label">{t('cols.box.radius')}</span>
        <input type="range" min={0} max={28} value={b.radius ?? 14} onChange={(e) => set({ radius: +e.target.value })} />
        <b className="cb-val">{b.radius ?? 14}px</b>
      </div>
      <button className="btn ghost sm" onClick={clear}>{t('cols.box.reset')}</button>
    </div>
  );
}

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{1,5}',
  defining: true,
  isolating: true,
  draggable: true,
  addAttributes() {
    return {
      layout: { default: '1-1', parseHTML: (el) => el.getAttribute('data-layout') || '1-1', renderHTML: (a) => ({ 'data-layout': a.layout }) },
      style: { default: 'plain', parseHTML: (el) => el.getAttribute('data-style') || 'plain', renderHTML: (a) => ({ 'data-style': a.style }) },
      box: {
        default: null,
        parseHTML: (el) => { try { return JSON.parse(el.getAttribute('data-box') || 'null'); } catch { return null; } },
        renderHTML: (a) => (a.box ? { 'data-box': JSON.stringify(a.box) } : {}),
      },
    };
  },
  parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
  renderHTML: ({ HTMLAttributes, node }) => {
    const cols = String(node.attrs.layout || '1-1').split('-').map(Number);
    const tpl = (cols.length === node.childCount ? cols : Array(node.childCount).fill(1)).map((c) => `${c}fr`).join(' ');
    const bv = boxVars(node.attrs.box);
    const cls = `cols-export cs-${node.attrs.style}` + (bv ? ` cb-custom cb-${node.attrs.box?.target === 'block' ? 'block' : 'cols'}` : '');
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns', class: cls, style: `display:grid;gap:16px;grid-template-columns:${tpl}` + (bv ? ';' + styleStr(bv) : '') }), 0];
  },
  addNodeView: () => ReactNodeViewRenderer(ColumnsView),
});

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="column"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'col' }), 0],
});

/** Conteúdo para inserir um bloco de colunas. */
export const columnsContent = (layout: string, style: ColStyle = 'plain') => ({
  type: 'columns',
  attrs: { layout, style },
  content: layout.split('-').map(() => ({ type: 'column', content: [{ type: 'paragraph' }] })),
});

/** Insere as colunas e já deixa o cursor na primeira coluna. */
export function insertColumns(editor: any, layout: string, style: ColStyle) {
  editor.chain().focus().insertContent([columnsContent(layout, style), { type: 'paragraph' }]).run();
  const { state } = editor;
  let target = -1;
  state.doc.descendants((n: any, pos: number) => {
    if (n.type.name === 'columns' && pos < state.selection.from) target = pos;
    return n.type.name !== 'columns';
  });
  if (target >= 0) editor.chain().setTextSelection(target + 3).focus().run();
}
