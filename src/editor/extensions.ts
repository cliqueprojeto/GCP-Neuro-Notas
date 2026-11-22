import { Extension, Node, mergeAttributes, type AnyExtension } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Mention from '@tiptap/extension-mention';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Youtube from '@tiptap/extension-youtube';
import CharacterCount from '@tiptap/extension-character-count';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { common, createLowlight } from 'lowlight';
import { CalloutView, FormView, GalleryView, PollView, RaffleView, ToggleView } from './blocks';
import type { SuggestItem } from './suggest';
import { moveCurrentBlock } from './BlockHandle';

export const lowlight = createLowlight(common);

const jsonAttr = (name: string, def: any) => ({
  default: def,
  parseHTML: (el: HTMLElement) => {
    try {
      return JSON.parse(el.getAttribute('data-' + name) || 'null') ?? def;
    } catch {
      return def;
    }
  },
  renderHTML: (attrs: any) => ({ ['data-' + name]: JSON.stringify(attrs[name]) }),
});

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      emoji: { default: '💡', parseHTML: (el) => el.getAttribute('data-emoji') || '💡', renderHTML: (a) => ({ 'data-emoji': a.emoji }) },
      tone: { default: 'info', parseHTML: (el) => el.getAttribute('data-tone') || 'info', renderHTML: (a) => ({ 'data-tone': a.tone }) },
    };
  },
  parseHTML: () => [{ tag: 'div[data-type="callout"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout', class: 'callout' }), 0],
  addNodeView: () => ReactNodeViewRenderer(CalloutView),
});

export const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      summary: { default: '', parseHTML: (el) => el.getAttribute('data-summary') || '', renderHTML: (a) => ({ 'data-summary': a.summary }) },
      open: { default: true, parseHTML: (el) => el.getAttribute('data-open') !== 'false', renderHTML: (a) => ({ 'data-open': String(a.open) }) },
    };
  },
  parseHTML: () => [{ tag: 'div[data-type="toggle"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle' }), 0],
  addNodeView: () => ReactNodeViewRenderer(ToggleView),
});

function atomBlock(name: string, attrs: Record<string, any>, view: any) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes() {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(attrs)) out[k] = jsonAttr(k, v);
      return out;
    },
    parseHTML: () => [{ tag: `div[data-type="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': name })],
    addNodeView: () => ReactNodeViewRenderer(view),
  });
}

export const Poll = atomBlock('poll', { question: '', multiple: false, options: [], total: 0 }, PollView);
export const Raffle = atomBlock(
  'raffle',
  { title: '', mode: 'list', entries: [], min: 1, max: 100, count: 1, unique: true, results: [] },
  RaffleView,
);
export const Form = atomBlock('form', { title: '', description: '', fields: [], responses: [] }, FormView);
export const Gallery = atomBlock('gallery', { images: [], columns: 3 }, GalleryView);

/** Links entre páginas no estilo [[Obsidian]]. */
export function pageLinkExtension(suggestion?: Partial<SuggestionOptions<any>>) {
  return Mention.extend({
    name: 'pageLink',
    addAttributes() {
      return {
        id: { default: null, parseHTML: (el) => el.getAttribute('data-id'), renderHTML: (a) => (a.id ? { 'data-id': a.id } : {}) },
        label: { default: '', parseHTML: (el) => el.getAttribute('data-label'), renderHTML: (a) => ({ 'data-label': a.label }) },
      };
    },
    parseHTML() {
      return [{ tag: 'span[data-type="pageLink"]' }];
    },
  }).configure({
    HTMLAttributes: { class: 'page-link', 'data-type': 'pageLink' },
    renderText: ({ node }) => `[[${node.attrs.label}]]`,
    renderHTML: ({ options, node }) => ['span', mergeAttributes(options.HTMLAttributes, { 'data-type': 'pageLink' }), `${node.attrs.label}`],
    deleteTriggerWithBackspace: true,
    suggestion: suggestion
      ? { char: '[[', allowSpaces: true, pluginKey: new PluginKey('pageLinkSuggest'), ...suggestion }
      : { char: '\u0000never', pluginKey: new PluginKey('pageLinkExport') },
  });
}

export function slashExtension(suggestion: Partial<SuggestionOptions<SuggestItem>>) {
  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestItem>({
          editor: this.editor,
          char: '/',
          startOfLine: false,
          allowSpaces: true,
          pluginKey: new PluginKey('slash'),
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).run();
            props.run({ editor, range } as any);
          },
          ...suggestion,
        }),
      ];
    },
  });
}

/** Alt+Shift+↑/↓ move o bloco atual. */
export const BlockMove = Extension.create({
  name: 'blockMove',
  addKeyboardShortcuts() {
    return {
      'Alt-Shift-ArrowUp': () => (moveCurrentBlock(this.editor as any, -1), true),
      'Alt-Shift-ArrowDown': () => (moveCurrentBlock(this.editor as any, 1), true),
    };
  },
});

function base(placeholder?: string): AnyExtension[] {
  return [
    StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3] } }),
    Underline,
    Subscript,
    Superscript,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    Image.configure({ allowBase64: true, HTMLAttributes: { class: 'doc-image' } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),
    Youtube.configure({ nocookie: true, width: 640, height: 360 }),
    Typography,
    Callout,
    Toggle,
    Poll,
    Raffle,
    Form,
    Gallery,
    ...(placeholder !== undefined ? [Placeholder.configure({ placeholder, includeChildren: false }), CharacterCount] : []),
  ];
}

export function editorExtensions(opts: {
  placeholder: string;
  slash: Partial<SuggestionOptions<SuggestItem>>;
  pageLink: Partial<SuggestionOptions<any>>;
}): AnyExtension[] {
  return [...base(opts.placeholder), BlockMove, slashExtension(opts.slash), pageLinkExtension(opts.pageLink)];
}

let cachedExport: AnyExtension[] | null = null;
export function exportExtensions(): AnyExtension[] {
  if (!cachedExport) cachedExport = [...base(), pageLinkExtension()];
  return cachedExport;
}
