import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { ArrowDown, ArrowUp, CopyPlus, GripVertical, Heading1, Heading2, List, ListChecks, Plus, Text, Trash2 } from 'lucide-react';
import { useT } from '../i18n';
import { ContextMenu, type MenuEntry } from '../components/ui';

/** Posição (início) do bloco de primeiro nível que contém `pos`. */
function topLevelAt(editor: Editor, pos: number): number | null {
  const doc = editor.state.doc;
  if (!doc.content.size) return null;
  const $p = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  if ($p.depth === 0) {
    const node = doc.nodeAt(pos);
    return node ? pos : null;
  }
  return $p.before(1);
}

function blockFromDom(editor: Editor, el: Element | null): number | null {
  const root = editor.view.dom;
  while (el && el.parentElement !== root) el = el.parentElement;
  if (!el) return null;
  let found: number | null = null;
  editor.state.doc.forEach((_n, off) => {
    if (found === null && editor.view.nodeDOM(off) === el) found = off;
  });
  return found;
}

export function moveBlock(editor: Editor, pos: number, dir: -1 | 1): number | null {
  const { state } = editor;
  const doc = state.doc;
  const node = doc.nodeAt(pos);
  if (!node) return null;
  const idx = doc.resolve(pos).index(0);
  const sibling = dir === -1 ? (idx > 0 ? doc.child(idx - 1) : null) : idx < doc.childCount - 1 ? doc.child(idx + 1) : null;
  if (!sibling) return null;
  const tr = state.tr.delete(pos, pos + node.nodeSize);
  const target = dir === -1 ? pos - sibling.nodeSize : pos + sibling.nodeSize;
  tr.insert(target, node);
  try {
    tr.setSelection(node.isTextblock ? TextSelection.near(tr.doc.resolve(target + 1)) : NodeSelection.create(tr.doc, target));
  } catch { /* seleção opcional */ }
  editor.view.dispatch(tr.scrollIntoView());
  return target;
}

export function moveCurrentBlock(editor: Editor, dir: -1 | 1) {
  const pos = topLevelAt(editor, editor.state.selection.from);
  if (pos !== null) moveBlock(editor, pos, dir);
}

/** Alça à esquerda de cada bloco: ＋ para inserir e ⋮⋮ para mover, duplicar ou excluir. */
export function BlockHandle({ editor }: { editor: Editor }) {
  const t = useT();
  const [pos, setPos] = useState<number | null>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);

  const place = (p: number | null) => {
    if (p === null || !host.current) return setBox(null);
    const dom = editor.view.nodeDOM(p) as HTMLElement | null;
    const wrap = host.current.parentElement;
    if (!dom || !wrap || !(dom instanceof HTMLElement)) return setBox(null);
    const r = dom.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    setPos(p);
    setBox({ top: r.top - w.top, height: Math.min(r.height, 40) });
  };

  useEffect(() => {
    const view = editor.view;
    const onMove = (e: MouseEvent) => {
      if (hovering.current || menu) return;
      const el = document.elementFromPoint(Math.max(view.dom.getBoundingClientRect().left + 30, e.clientX), e.clientY);
      if (!el || !view.dom.contains(el)) return;
      const p = blockFromDom(editor, el);
      if (p !== null) place(p);
    };
    const onSel = () => {
      if (hovering.current || menu) return;
      const p = topLevelAt(editor, editor.state.selection.from);
      if (p !== null && (window.matchMedia('(hover: none)').matches || editor.isFocused)) place(p);
    };
    const wrap = host.current?.parentElement;
    wrap?.addEventListener('mousemove', onMove);
    editor.on('selectionUpdate', onSel);
    editor.on('update', onSel);
    return () => {
      wrap?.removeEventListener('mousemove', onMove);
      editor.off('selectionUpdate', onSel);
      editor.off('update', onSel);
    };
  }, [editor, menu]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor.isEditable) return null;
  const node = pos !== null ? editor.state.doc.nodeAt(pos) : null;
  const idx = pos !== null && node ? editor.state.doc.resolve(pos).index(0) : -1;
  const count = editor.state.doc.childCount;

  const select = () => {
    if (pos === null) return;
    editor.chain().setNodeSelection(pos).run();
  };
  const items: MenuEntry[] = pos === null || !node ? [] : [
    { icon: <ArrowUp size={15} />, label: t('block.moveUp'), hint: 'Alt+⇧+↑', disabled: idx <= 0, onClick: () => place(moveBlock(editor, pos, -1)) },
    { icon: <ArrowDown size={15} />, label: t('block.moveDown'), hint: 'Alt+⇧+↓', disabled: idx >= count - 1, onClick: () => place(moveBlock(editor, pos, 1)) },
    { icon: <CopyPlus size={15} />, label: t('common.duplicate'), onClick: () => editor.chain().insertContentAt(pos + node.nodeSize, node.toJSON()).run() },
    { sep: true },
    ...(node.isTextblock
      ? ([
          { icon: <Text size={15} />, label: t('slash.text'), onClick: () => editor.chain().setTextSelection(pos + 1).setParagraph().run() },
          { icon: <Heading1 size={15} />, label: t('slash.h1'), onClick: () => editor.chain().setTextSelection(pos + 1).setHeading({ level: 1 }).run() },
          { icon: <Heading2 size={15} />, label: t('slash.h2'), onClick: () => editor.chain().setTextSelection(pos + 1).setHeading({ level: 2 }).run() },
          { icon: <List size={15} />, label: t('slash.bullet'), onClick: () => editor.chain().setTextSelection(pos + 1).toggleBulletList().run() },
          { icon: <ListChecks size={15} />, label: t('slash.todo'), onClick: () => editor.chain().setTextSelection(pos + 1).toggleTaskList().run() },
          { sep: true },
        ] as MenuEntry[])
      : []),
    {
      icon: <Trash2 size={15} />, label: t('block.delete'), danger: true, hint: 'Del',
      onClick: () => {
        editor.chain().command(({ tr }) => (tr.delete(pos, pos + node.nodeSize), true)).focus().run();
        setBox(null);
        setPos(null);
      },
    },
  ];

  return (
    <div ref={host} className="block-handle-host" aria-hidden={!box}>
      {box && (
        <div
          className="block-handle"
          style={{ top: box.top, height: box.height }}
          onMouseEnter={() => (hovering.current = true)}
          onMouseLeave={() => (hovering.current = false)}
        >
          <button
            className="bh-btn"
            title={t('block.addBelow')}
            onClick={() => {
              if (pos === null || !node) return;
              const at = pos + node.nodeSize;
              editor.chain().insertContentAt(at, { type: 'paragraph' }).setTextSelection(at + 1).insertContent('/').focus().run();
            }}
          >
            <Plus size={16} />
          </button>
          <button
            className="bh-btn grip"
            title={t('block.menu')}
            draggable
            onDragStart={(e) => {
              if (pos === null || !node) return;
              select();
              const slice = editor.state.selection.content();
              const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
              (editor.view as any).dragging = { slice, move: true };
              e.dataTransfer.effectAllowed = 'copyMove';
              e.dataTransfer.setData('text/html', dom?.outerHTML || '');
              e.dataTransfer.setData('text/plain', node.textContent);
              if (dom) e.dataTransfer.setDragImage(dom, 10, 10);
            }}
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              select();
              setMenu({ x: r.left, y: r.bottom + 4 });
            }}
          >
            <GripVertical size={16} />
          </button>
        </div>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => ((hovering.current = false), setMenu(null))} />}
    </div>
  );
}
