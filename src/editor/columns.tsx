import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { Minus, Plus, Trash2 } from 'lucide-react';
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

/** Ícone de layout: miniatura vetorial das colunas, no estilo e proporção escolhidos. */
export function LayoutIcon({ cols, style = 'cards', size = 34, active }: { cols: number[]; style?: ColStyle | 'sidebar'; size?: number; active?: boolean }) {
  const W = size * 1.4, H = size, pad = 3, gap = 2.5;
  const total = cols.reduce((a, b) => a + b, 0);
  const inner = W - pad * 2 - gap * (cols.length - 1);
  let x = pad;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={'layout-ic' + (active ? ' on' : '')}>
      <defs>
        <linearGradient id="lic-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="6" className="lic-frame" />
      {cols.map((c, i) => {
        const w = (inner * c) / total;
        const r = <g key={i}>
          <rect x={x} y={pad} width={w} height={H - pad * 2} rx="3.5" fill={i === 0 && cols[0] > 1 ? 'url(#lic-g)' : 'url(#lic-g)'} opacity={0.22 + (c / Math.max(...cols)) * 0.5} />
          <rect x={x + 2.5} y={pad + 4} width={Math.max(2, w - 5)} height="2.2" rx="1.1" className="lic-line" />
          <rect x={x + 2.5} y={pad + 8.5} width={Math.max(2, (w - 5) * 0.7)} height="2.2" rx="1.1" className="lic-line soft" />
        </g>;
        x += w + gap;
        return r;
      })}
    </svg>
  );
}

function ColumnsView({ node, updateAttributes, deleteNode, editor, getPos, selected }: NodeViewProps) {
  const t = useT();
  const layout = (node.attrs.layout as string) || '1-1';
  const style = (node.attrs.style as ColStyle) || 'plain';
  const cols = layout.split('-').map(Number);
  const n = node.childCount;
  const editable = editor.isEditable;
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
    <NodeViewWrapper className={`cols-block cs-${style}` + (selected ? ' sel' : '')} data-layout={layout}>
      {editable && (
        <div className="cols-bar" contentEditable={false}>
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
          <button className="icon-btn xs" title={t('common.delete')} onClick={deleteNode}><Trash2 size={13} /></button>
        </div>
      )}
      <NodeViewContent className="cols-grid" style={{ gridTemplateColumns: template }} />
    </NodeViewWrapper>
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
    };
  },
  parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
  renderHTML: ({ HTMLAttributes, node }) => {
    const cols = String(node.attrs.layout || '1-1').split('-').map(Number);
    const tpl = (cols.length === node.childCount ? cols : Array(node.childCount).fill(1)).map((c) => `${c}fr`).join(' ');
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns', class: `cols-export cs-${node.attrs.style}`, style: `display:grid;gap:16px;grid-template-columns:${tpl}` }), 0];
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
