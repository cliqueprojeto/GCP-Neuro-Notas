import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import {
  ArrowDown, ArrowUp, ClipboardPaste, Code, Columns2, Copy, CopyPlus, Heading1, Heading2, Heading3, Lightbulb, List, ListChecks, ListOrdered, Minus,
  Quote, Scissors, Sparkles, Table2, TableCellsMerge, TableCellsSplit, Text, Trash2, ArrowDownToLine, ArrowRightToLine, Rows3, Columns3, Bold, Italic, Link2,
} from 'lucide-react';
import { useT } from '../i18n';
import { toast } from '../store/ui';
import { askText } from '../components/PromptHost';
import { moveBlock, topLevelAt } from './BlockHandle';
import { insertColumns } from './columns';

type Item = { icon: React.ReactNode; label: string; hint?: string; run: () => void; danger?: boolean; disabled?: boolean } | 'sep';

/**
 * Menu de contexto do editor (botão direito; toque longo no celular e tablet):
 * atalhos rápidos para formatar, transformar, inserir, mover e excluir blocos.
 */
export function EditorContextMenu({ editor, x, y, onClose, onAi }: { editor: Editor; x: number; y: number; onClose: () => void; onAi: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.max(8, Math.min(x, innerWidth - r.width - 8)), y: Math.max(8, Math.min(y, innerHeight - r.height - 8)) });
  }, [x, y]);

  const { from, to } = editor.state.selection;
  const hasSel = from !== to;
  const inTable = editor.isActive('table');
  const block = topLevelAt(editor, from);
  const node = block !== null ? editor.state.doc.nodeAt(block) : null;
  const idx = block !== null ? editor.state.doc.resolve(block).index(0) : -1;
  const c = () => editor.chain().focus();
  const text = () => editor.state.doc.textBetween(from, to, '\n');

  const turn: { icon: React.ReactNode; label: string; run: () => void; on?: boolean }[] = [
    { icon: <Text size={16} />, label: t('slash.text'), run: () => c().setParagraph().run(), on: editor.isActive('paragraph') },
    { icon: <Heading1 size={16} />, label: t('slash.h1'), run: () => c().toggleHeading({ level: 1 }).run(), on: editor.isActive('heading', { level: 1 }) },
    { icon: <Heading2 size={16} />, label: t('slash.h2'), run: () => c().toggleHeading({ level: 2 }).run(), on: editor.isActive('heading', { level: 2 }) },
    { icon: <Heading3 size={16} />, label: t('slash.h3'), run: () => c().toggleHeading({ level: 3 }).run(), on: editor.isActive('heading', { level: 3 }) },
    { icon: <List size={16} />, label: t('slash.bullet'), run: () => c().toggleBulletList().run(), on: editor.isActive('bulletList') },
    { icon: <ListOrdered size={16} />, label: t('slash.numbered'), run: () => c().toggleOrderedList().run(), on: editor.isActive('orderedList') },
    { icon: <ListChecks size={16} />, label: t('slash.todo'), run: () => c().toggleTaskList().run(), on: editor.isActive('taskList') },
    { icon: <Quote size={16} />, label: t('slash.quote'), run: () => c().toggleBlockquote().run(), on: editor.isActive('blockquote') },
    { icon: <Code size={16} />, label: t('slash.code'), run: () => c().toggleCodeBlock().run(), on: editor.isActive('codeBlock') },
  ];

  const items: Item[] = [];
  if (hasSel) {
    items.push(
      { icon: <Scissors size={15} />, label: t('ctx.cut'), hint: 'Ctrl+X', run: async () => { await navigator.clipboard?.writeText(text()).catch(() => {}); c().deleteSelection().run(); } },
      { icon: <Copy size={15} />, label: t('ctx.copy'), hint: 'Ctrl+C', run: async () => { await navigator.clipboard?.writeText(text()).catch(() => {}); toast(t('common.copied'), 'success'); } },
    );
  }
  items.push({
    icon: <ClipboardPaste size={15} />, label: t('ctx.paste'), hint: 'Ctrl+V',
    run: async () => {
      try { const s = await navigator.clipboard.readText(); if (s) c().insertContent(s).run(); }
      catch { toast(t('ctx.pasteHint'), 'info'); }
    },
  });
  if (hasSel) {
    items.push(
      'sep',
      { icon: <Bold size={15} />, label: t('tb.bold'), hint: 'Ctrl+B', run: () => c().toggleBold().run() },
      { icon: <Italic size={15} />, label: t('tb.italic'), hint: 'Ctrl+I', run: () => c().toggleItalic().run() },
      { icon: <Link2 size={15} />, label: t('ctx.link'), hint: 'Ctrl+K', run: async () => { const u = await askText({ title: t('ctx.link'), placeholder: 'https://' }); if (u) c().setLink({ href: u }).run(); } },
      { icon: <Sparkles size={15} />, label: t('ctx.ai'), run: onAi },
    );
  }
  if (inTable) {
    items.push(
      'sep',
      { icon: <ArrowDownToLine size={15} />, label: t('tb.rowBelow'), run: () => c().addRowAfter().run() },
      { icon: <ArrowRightToLine size={15} />, label: t('tb.colRight'), run: () => c().addColumnAfter().run() },
      { icon: <TableCellsMerge size={15} />, label: t('tb.merge'), run: () => c().mergeCells().run(), disabled: !editor.can().mergeCells() },
      { icon: <TableCellsSplit size={15} />, label: t('tb.split'), run: () => c().splitCell().run(), disabled: !editor.can().splitCell() },
      { icon: <Rows3 size={15} />, label: t('tb.delRow'), run: () => c().deleteRow().run(), danger: true },
      { icon: <Columns3 size={15} />, label: t('tb.delCol'), run: () => c().deleteColumn().run(), danger: true },
    );
  }
  items.push(
    'sep',
    { icon: <Table2 size={15} />, label: t('ctx.insTable'), run: () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { icon: <Columns2 size={15} />, label: t('ctx.insCols'), run: () => insertColumns(editor, '1-1', 'cards') },
    { icon: <Lightbulb size={15} />, label: t('slash.callout'), run: () => c().insertContent({ type: 'callout', attrs: { emoji: '💡', tone: 'info' } }).run() },
    { icon: <Minus size={15} />, label: t('slash.divider'), run: () => c().setHorizontalRule().run() },
  );
  if (block !== null && node) {
    items.push(
      'sep',
      { icon: <ArrowUp size={15} />, label: t('block.moveUp'), hint: 'Alt+⇧+↑', disabled: idx <= 0, run: () => moveBlock(editor, block, -1) },
      { icon: <ArrowDown size={15} />, label: t('block.moveDown'), hint: 'Alt+⇧+↓', disabled: idx >= editor.state.doc.childCount - 1, run: () => moveBlock(editor, block, 1) },
      { icon: <CopyPlus size={15} />, label: t('common.duplicate'), run: () => editor.chain().insertContentAt(block + node.nodeSize, node.toJSON()).run() },
      { icon: <Trash2 size={15} />, label: t('block.delete'), danger: true, run: () => editor.chain().command(({ tr }) => (tr.delete(block, block + node.nodeSize), true)).focus().run() },
    );
  }

  return createPortal(
    <div className="ctx-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onContextMenu={(e) => (e.preventDefault(), onClose())}>
      <div ref={ref} className="ctx-menu menu editor-ctx" style={{ left: pos.x, top: pos.y }} role="menu">
        {node?.isTextblock !== false && (
          <>
            <div className="section-label">{t('ctx.turnInto')}</div>
            <div className="ctx-turn">
              {turn.map((b) => (
                <button key={b.label} className={b.on ? 'on' : ''} title={b.label} onClick={() => (onClose(), b.run())}>{b.icon}</button>
              ))}
            </div>
            <div className="menu-sep" />
          </>
        )}
        {items.map((it, i) =>
          it === 'sep' ? (
            <div key={i} className="menu-sep" />
          ) : (
            <button key={i} className={'menu-item' + (it.danger ? ' danger' : '')} disabled={it.disabled} onClick={() => (onClose(), it.run())}>
              {it.icon} <span className="grow">{it.label}</span> {it.hint && <kbd>{it.hint}</kbd>}
            </button>
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}
