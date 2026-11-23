import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { useVault } from '../store/vault';
import { DbEmbedView } from './DbEmbed';
import { cellText, titleProp, visibleRows } from './logic';

/** Base de dados incorporada na página (o bloco guarda só o id da base). */
export const DbViewNode = Node.create({
  name: 'dbView',
  group: 'block',
  atom: true,
  draggable: false,
  selectable: true,
  addStorage: () => ({ hostPageId: null as string | null }),
  addAttributes: () => ({
    pageId: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-page') || '', renderHTML: (a: any) => ({ 'data-page': a.pageId }) },
  }),
  parseHTML: () => [{ tag: 'div[data-type="dbView"]' }],
  // Para exportações (PDF, Word, HTML): a visão ativa vira uma tabela com o título da base.
  renderHTML: ({ node, HTMLAttributes }) => {
    const p = useVault.getState().pages[node.attrs.pageId];
    const db = p?.db;
    if (!p || !db) return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'dbView' })];
    const view = db.views.find((v) => v.id === db.activeView) || db.views[0];
    const props = db.properties.filter((x) => !(view.hidden || []).includes(x.id)).slice(0, 8);
    const rows = visibleRows(db, view, '').slice(0, 200);
    const tp = titleProp(db);
    return [
      'div', mergeAttributes(HTMLAttributes, { 'data-type': 'dbView', class: 'db-export' }),
      ['h3', {}, p.title || ''],
      ['table', {},
        ['tr', {}, ...props.map((x) => ['th', {}, x.name])],
        ...rows.map((r) => ['tr', {}, ...props.map((x) => ['td', {}, x.id === tp.id ? String(r.cells[x.id] ?? '') : cellText(x, r.cells[x.id])])]),
      ],
    ];
  },
  addNodeView: () => ReactNodeViewRenderer(DbEmbedView, { stopEvent: () => true, ignoreMutation: () => true }),
});
