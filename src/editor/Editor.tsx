import { useEditor, EditorContent, BubbleMenu, type Editor as TEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, BarChart3, CheckSquare, ChevronDown, Code, Code2, Columns3, Database, Dices, FileSpreadsheet,
  FileText, Heading1, Heading2, Heading3, Highlighter, ImageIcon, Images, Italic, Link2, List, ListOrdered, ListTree, Minus, MessageSquareQuote,
  PieChart, Plus, Quote, Redo2, Rows3, SmilePlus, Sparkles, Sticker, Strikethrough, Table2, Text, Trash2, Underline as UIcon, Undo2, Play,
  CalendarDays, Lightbulb, Wand2, Link as LinkIcon,
} from 'lucide-react';
import { editorExtensions } from './extensions';
import { suggestRender, type SuggestItem } from './suggest';
import { BlockHandle } from './BlockHandle';
import { TEMPLATES, instantiate } from '../templates/templates';
import { instantiateUser, UserTemplateBadge } from '../templates/user';
import { usePrefs, detectLang } from '../store/prefs';
import { useT, useLang, LOCALES } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi, toast } from '../store/ui';
import { pickImages } from '../lib/platform';
import { normalize, formatDate } from '../lib/doc';
import { Modal, Popover, PageIcon } from '../components/ui';
import { EmojiPicker } from '../components/IconPicker';
import { SHAPE_STICKERS, TEXT_STICKER_KEYS, textSticker } from './stickers';
import { runAction, generate, mdToHtml, activeProvider, type AiAction } from '../ai/assist';
import type { Page } from '../lib/types';
import type { TKey } from '../i18n';

interface Props {
  page: Page;
  editable?: boolean;
}

export function Editor({ page, editable = true }: Props) {
  const t = useT();
  const lang = useLang();
  const update = useVault((s) => s.updatePage);
  const settings = useVault((s) => s.settings.editor);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const tRef = useRef(t);
  tRef.current = t;
  const pageRef = useRef(page);
  pageRef.current = page;

  const slashItems = useMemo(() => buildSlash(), []);

  const editor = useEditor(
    {
      editable,
      extensions: editorExtensions({
        placeholder: t('editor.placeholder'),
        slash: {
          items: ({ query }) => {
            const q = normalize(query);
            const items = slashItems(tRef.current, {
              emoji: () => setEmojiOpen(true),
              sticker: () => setStickerOpen(true),
              ai: () => setAiOpen(true),
              page: pageRef.current,
            });
            return q ? items.filter((i) => normalize(i.title + ' ' + (i.subtitle || '') + ' ' + i.id).includes(q)) : items;
          },
          render: suggestRender(() => tRef.current('editor.noResults')),
        },
        pageLink: {
          items: ({ query }) => {
            const q = normalize(query);
            const pages = livePages(useVault.getState().pages)
              .filter((p) => p.id !== pageRef.current.id && normalize(p.title || '').includes(q))
              .slice(0, 8);
            const items: SuggestItem[] = pages.map((p) => ({
              id: p.id,
              title: p.title || tRef.current('page.untitled'),
              icon: <PageIcon icon={p.icon} size={16} />,
              run: () => undefined,
            }));
            if (query.trim())
              items.push({ id: '__new', title: tRef.current('editor.createPage', { title: query.trim() }), icon: <Plus size={16} />, run: () => undefined });
            return items;
          },
          command: ({ editor, range, props }: any) => {
            let id = props.id;
            let label = props.title;
            if (id === '__new') {
              const text = editor.state.doc.textBetween(range.from, range.to).replace(/^\[\[/, '').trim();
              const np = useVault.getState().createPage({ title: text, parentId: pageRef.current.id });
              id = np.id;
              label = np.title;
            }
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: 'pageLink', attrs: { id, label } },
                { type: 'text', text: ' ' },
              ])
              .run();
          },
          render: suggestRender(() => tRef.current('editor.noPages')),
        },
      }),
      content: page.content || '',
      editorProps: {
        attributes: { class: 'prose', spellcheck: String(settings.spellcheck) },
        handleClick: (_view, _pos, event) => {
          const el = (event.target as HTMLElement).closest('[data-type="pageLink"]') as HTMLElement | null;
          if (el?.dataset.id) {
            const target = useVault.getState().pages[el.dataset.id];
            if (target && !target.deletedAt) useUi.getState().go({ name: 'page', id: target.id });
            else toast(tRef.current('editor.brokenLink'), 'error');
            return true;
          }
          const a = (event.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
          if (a && (event.ctrlKey || event.metaKey || !editable)) {
            import('../lib/platform').then((m) => m.openUrl(a.href));
            return true;
          }
          return false;
        },
        handleDrop: (view, event) => {
          const files = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          event.preventDefault();
          import('../lib/platform').then(async (m) => {
            for (const f of files) {
              const src = await m.fileToDataUrl(f);
              view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })));
            }
          });
          return true;
        },
        handlePaste: (view, event) => {
          const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          import('../lib/platform').then(async (m) => {
            for (const f of files) {
              const src = await m.fileToDataUrl(f);
              view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })));
            }
          });
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => update(pageRef.current.id, { content: editor.getJSON() }), 350);
      },
    },
    [page.id],
  );

  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      if (editor && !editor.isDestroyed) update(pageRef.current.id, { content: editor.getJSON() });
    }
  }, [editor, update]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // Conteúdo trocado por fora (histórico de versões, IA, sincronização).
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const cur = JSON.stringify(editor.getJSON());
    if (page.content && JSON.stringify(page.content) !== cur) editor.commands.setContent(page.content, false);
  }, [page.content, editor]);

  if (!editor) return null;

  const ai = async (action: AiAction, target = '') => {
    if (!activeProvider()) return toast(t('ai.noProvider'), 'error');
    const { from, to, empty } = editor.state.selection;
    const text = empty ? editor.getText() : editor.state.doc.textBetween(from, to, '\n');
    setBusy(true);
    try {
      const out = await runAction(action, text, target);
      const html = mdToHtml(out);
      if (action === 'continue' || action === 'summarize' || action === 'actions' || action === 'explain' || action === 'outline') {
        editor.chain().focus().setTextSelection(empty ? editor.state.doc.content.size : to).insertContent(html).run();
      } else if (empty) {
        editor.chain().focus().selectAll().insertContent(html).run();
      } else {
        editor.chain().focus().insertContentAt({ from, to }, html).run();
      }
    } catch (e) {
      toast(t('ai.error') + ' ' + String((e as Error).message || e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`editor-wrap font-${page.font || settings.font}`} style={{ fontSize: settings.fontSize }}>
      {editable && <Toolbar editor={editor} onEmoji={() => setEmojiOpen(true)} onSticker={() => setStickerOpen(true)} onAi={() => setAiOpen(true)} busy={busy} page={page} />}
      {editable && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 120, maxWidth: 'none' }} shouldShow={({ editor, from, to }) => from !== to && !(editor.state.selection as any).node && !editor.isActive('image') && !editor.isActive('pageLink')}>
          <Bubble editor={editor} onAi={ai} busy={busy} />
        </BubbleMenu>
      )}
      {editable && <BlockHandle editor={editor} />}
      <EditorContent editor={editor} />
      <div className="editor-foot muted small">
        {t('editor.words', { n: editor.storage.characterCount?.words?.() ?? 0 })} · {t('editor.chars', { n: editor.storage.characterCount?.characters?.() ?? 0 })} ·{' '}
        {t('editor.edited', { d: formatDate(page.updatedAt, LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' }) })}
      </div>

      <Modal open={emojiOpen} onClose={() => setEmojiOpen(false)} title={t('editor.emoji')} width={400}>
        <EmojiPicker
          onSelect={(e) => {
            editor.chain().focus().insertContent(e).run();
            setEmojiOpen(false);
          }}
        />
      </Modal>
      <Modal open={stickerOpen} onClose={() => setStickerOpen(false)} title={t('editor.stickers')} width={560}>
        <div className="sticker-grid">
          {TEXT_STICKER_KEYS.map(([k, c1, c2, ic]) => {
            const src = textSticker(t(k as TKey), c1, c2, ic);
            return (
              <button key={k} className="wide" onClick={() => (editor.chain().focus().setImage({ src, alt: t(k as TKey) }).run(), setStickerOpen(false))}>
                <img src={src} alt="" />
              </button>
            );
          })}
          {SHAPE_STICKERS.map((s) => (
            <button key={s.id} onClick={() => (editor.chain().focus().setImage({ src: s.src, alt: s.id }).run(), setStickerOpen(false))}>
              <img src={s.src} alt={s.id} />
            </button>
          ))}
        </div>
      </Modal>
      <AiWriteModal open={aiOpen} onClose={() => setAiOpen(false)} editor={editor} />
    </div>
  );
}

// ----------------------------------------------------------- comando "/"

function buildSlash() {
  return (t: (k: TKey, v?: any) => string, ctx: { emoji: () => void; sticker: () => void; ai: () => void; page: Page }): SuggestItem[] => {
    const g = { basic: t('slash.group.basic'), media: t('slash.group.media'), adv: t('slash.group.advanced'), pages: t('slash.group.pages'), ai: 'IA' };
    const childPage = (type: Page['type'], editor: TEditor) => {
      const np = useVault.getState().createPage({ type, parentId: ctx.page.id, title: '' });
      editor.chain().focus().insertContent([{ type: 'pageLink', attrs: { id: np.id, label: t(type === 'database' ? 'page.newDatabase' : type === 'report' ? 'page.newReport' : 'page.untitled') } }, { type: 'text', text: ' ' }]).run();
      setTimeout(() => useUi.getState().go({ name: 'page', id: np.id }), 50);
    };
    return [
      { id: 'ai', tone: 'pink', group: g.ai, title: t('slash.ai'), subtitle: t('slash.ai.sub'), icon: <Sparkles size={18} />, run: () => ctx.ai() },
      { id: 'text', tone: 'gray', group: g.basic, title: t('slash.text'), icon: <Text size={18} />, run: ({ editor }) => editor.chain().focus().setParagraph().run() },
      { id: 'h1', tone: 'violet', group: g.basic, title: t('slash.h1'), icon: <Heading1 size={18} />, run: ({ editor }) => editor.chain().focus().setHeading({ level: 1 }).run() },
      { id: 'h2', tone: 'violet', group: g.basic, title: t('slash.h2'), icon: <Heading2 size={18} />, run: ({ editor }) => editor.chain().focus().setHeading({ level: 2 }).run() },
      { id: 'h3', tone: 'violet', group: g.basic, title: t('slash.h3'), icon: <Heading3 size={18} />, run: ({ editor }) => editor.chain().focus().setHeading({ level: 3 }).run() },
      { id: 'todo', tone: 'green', group: g.basic, title: t('slash.todo'), icon: <CheckSquare size={18} />, run: ({ editor }) => editor.chain().focus().toggleTaskList().run() },
      { id: 'bullet', tone: 'blue', group: g.basic, title: t('slash.bullet'), icon: <List size={18} />, run: ({ editor }) => editor.chain().focus().toggleBulletList().run() },
      { id: 'numbered', tone: 'blue', group: g.basic, title: t('slash.numbered'), icon: <ListOrdered size={18} />, run: ({ editor }) => editor.chain().focus().toggleOrderedList().run() },
      { id: 'toggle', tone: 'teal', group: g.basic, title: t('slash.toggle'), icon: <ListTree size={18} />, run: ({ editor }) => editor.chain().focus().insertContent({ type: 'toggle', attrs: { summary: '' }, content: [{ type: 'paragraph' }] }).run() },
      { id: 'quote', tone: 'gray', group: g.basic, title: t('slash.quote'), icon: <Quote size={18} />, run: ({ editor }) => editor.chain().focus().toggleBlockquote().run() },
      { id: 'callout', tone: 'amber', group: g.basic, title: t('slash.callout'), icon: <Lightbulb size={18} />, run: ({ editor }) => editor.chain().focus().insertContent({ type: 'callout', attrs: { emoji: '💡', tone: 'info' } }).run() },
      { id: 'divider', tone: 'gray', group: g.basic, title: t('slash.divider'), icon: <Minus size={18} />, run: ({ editor }) => editor.chain().focus().setHorizontalRule().run() },
      { id: 'code', tone: 'gray', group: g.basic, title: t('slash.code'), icon: <Code2 size={18} />, run: ({ editor }) => editor.chain().focus().toggleCodeBlock().run() },
      { id: 'table', tone: 'green', group: g.basic, title: t('slash.table'), icon: <Table2 size={18} />, run: ({ editor }) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: 'date', tone: 'orange', group: g.basic, title: t('slash.date'), icon: <CalendarDays size={18} />, run: ({ editor }) => editor.chain().focus().insertContent(new Date().toLocaleDateString()).run() },
      {
        id: 'image', tone: 'pink', group: g.media, title: t('slash.image'), icon: <ImageIcon size={18} />,
        run: async ({ editor }) => {
          const imgs = await pickImages(false);
          if (imgs[0]) editor.chain().focus().setImage({ src: imgs[0] }).run();
        },
      },
      { id: 'gallery', tone: 'pink', group: g.media, title: t('slash.gallery'), icon: <Images size={18} />, run: ({ editor }) => editor.chain().focus().insertContent({ type: 'gallery' }).run() },
      {
        id: 'youtube', tone: 'red', group: g.media, title: 'YouTube', icon: <Play size={18} />,
        run: ({ editor }) => {
          const url = window.prompt('URL');
          if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
        },
      },
      { id: 'emoji', tone: 'amber', group: g.media, title: t('slash.emoji'), icon: <SmilePlus size={18} />, run: () => ctx.emoji() },
      { id: 'sticker', tone: 'amber', group: g.media, title: t('slash.sticker'), icon: <Sticker size={18} />, run: () => ctx.sticker() },
      { id: 'poll', tone: 'violet', group: g.adv, title: t('slash.poll'), subtitle: t('slash.poll.sub'), icon: <BarChart3 size={18} />, run: ({ editor }) => editor.chain().focus().insertContent({ type: 'poll', attrs: { options: [{ id: 'a', label: '', votes: 0 }, { id: 'b', label: '', votes: 0 }] } }).run() },
      { id: 'raffle', tone: 'orange', group: g.adv, title: t('slash.raffle'), subtitle: t('slash.raffle.sub'), icon: <Dices size={18} />, run: ({ editor }) => editor.chain().focus().insertContent({ type: 'raffle' }).run() },
      { id: 'form', tone: 'teal', group: g.adv, title: t('slash.form'), subtitle: t('slash.form.sub'), icon: <FileSpreadsheet size={18} />, run: ({ editor }) => editor.chain().focus().insertContent({ type: 'form' }).run() },
      { id: 'link', tone: 'blue', group: g.pages, title: t('slash.pageLink'), subtitle: '[[ ]]', icon: <LinkIcon size={18} />, run: ({ editor }) => editor.chain().focus().insertContent('[[').run() },
      { id: 'subpage', tone: 'violet', group: g.pages, title: t('slash.subpage'), icon: <FileText size={18} />, run: ({ editor }) => childPage('page', editor) },
      { id: 'database', tone: 'teal', group: g.pages, title: t('slash.database'), icon: <Database size={18} />, run: ({ editor }) => childPage('database', editor) },
      { id: 'report', tone: 'pink', group: g.pages, title: t('slash.report'), icon: <PieChart size={18} />, run: ({ editor }) => childPage('report', editor) },
      ...templateItems(t, ctx.page),
    ];
  };
}

/** Modelos do usuário e templates prontos dentro do comando "/". */
function templateItems(t: (k: TKey, v?: any) => string, page: Page): SuggestItem[] {
  const lp = usePrefs.getState().lang;
  const lang = lp === 'auto' ? detectLang() : lp;
  const link = (editor: TEditor, id: string, label: string) =>
    editor.chain().focus().insertContent([{ type: 'pageLink', attrs: { id, label } }, { type: 'text', text: ' ' }]).run();
  const mine = useVault.getState().settings.templates || [];
  return [
    ...mine.map((tpl): SuggestItem => ({
      id: 'ut-' + tpl.id,
      group: t('utpl.mine'),
      title: tpl.name,
      subtitle: tpl.description || t(`new.${tpl.kind === 'page' ? 'page' : tpl.kind}` as TKey),
      icon: <UserTemplateBadge tpl={tpl} size={16} />,
      run: ({ editor }) => {
        if (tpl.kind === 'page' && tpl.page.content?.content?.length) {
          editor.chain().focus().insertContent(tpl.page.content.content).run();
          return;
        }
        const np = instantiateUser(tpl, page.id);
        link(editor, np.id, np.title || tpl.name);
        toast(t('tpl.created'), 'success');
      },
    })),
    ...TEMPLATES.map((tpl): SuggestItem => ({
      id: 'tpl-' + tpl.id,
      group: t('nav.templates'),
      title: tpl.title[lang],
      subtitle: tpl.description[lang],
      icon: <span className="slash-emoji">{tpl.icon}</span>,
      run: ({ editor }) => {
        const root = instantiate(tpl, lang, page.id, useVault.getState().createPage);
        link(editor, root.id, root.title);
        toast(t('tpl.created'), 'success');
      },
    })),
  ];
}

// --------------------------------------------------------------- toolbar

function Toolbar({ editor, onEmoji, onSticker, onAi, busy, page }: { editor: TEditor; onEmoji: () => void; onSticker: () => void; onAi: () => void; busy: boolean; page: Page }) {
  const t = useT();
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    editor.on('selectionUpdate', f);
    editor.on('transaction', f);
    return () => {
      editor.off('selectionUpdate', f);
      editor.off('transaction', f);
    };
  }, [editor]);
  const B = ({ on, active, title, children, disabled }: { on: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) => (
    <button className={'tb' + (active ? ' on' : '')} title={title} onMouseDown={(e) => e.preventDefault()} onClick={on} disabled={disabled}>
      {children}
    </button>
  );
  const c = () => editor.chain().focus();
  const inTable = editor.isActive('table');
  return (
    <div className="toolbar">
      <B on={() => c().undo().run()} title={t('tb.undo')} disabled={!editor.can().undo()}><Undo2 size={16} /></B>
      <B on={() => c().redo().run()} title={t('tb.redo')} disabled={!editor.can().redo()}><Redo2 size={16} /></B>
      <span className="tb-sep" />
      <B on={() => c().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1"><Heading1 size={16} /></B>
      <B on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2"><Heading2 size={16} /></B>
      <B on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3"><Heading3 size={16} /></B>
      <span className="tb-sep" />
      <B on={() => c().toggleBold().run()} active={editor.isActive('bold')} title={t('tb.bold')}><Bold size={16} /></B>
      <B on={() => c().toggleItalic().run()} active={editor.isActive('italic')} title={t('tb.italic')}><Italic size={16} /></B>
      <B on={() => c().toggleUnderline().run()} active={editor.isActive('underline')} title={t('tb.underline')}><UIcon size={16} /></B>
      <B on={() => c().toggleHighlight({ color: '#fde68a' }).run()} active={editor.isActive('highlight')} title={t('tb.highlight')}><Highlighter size={16} /></B>
      <span className="tb-sep" />
      <B on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')} title={t('slash.bullet')}><List size={16} /></B>
      <B on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')} title={t('slash.numbered')}><ListOrdered size={16} /></B>
      <B on={() => c().toggleTaskList().run()} active={editor.isActive('taskList')} title={t('slash.todo')}><CheckSquare size={16} /></B>
      <B on={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')} title={t('slash.quote')}><MessageSquareQuote size={16} /></B>
      <B on={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t('slash.table')}><Table2 size={16} /></B>
      <B
        on={async () => {
          const imgs = await pickImages(false);
          if (imgs[0]) c().setImage({ src: imgs[0] }).run();
        }}
        title={t('slash.image')}
      >
        <ImageIcon size={16} />
      </B>
      <B on={onEmoji} title={t('slash.emoji')}><SmilePlus size={16} /></B>
      <B on={onSticker} title={t('slash.sticker')}><Sticker size={16} /></B>
      <InsertMenu editor={editor} page={page} />
      {inTable && (
        <>
          <span className="tb-sep" />
          <B on={() => c().addRowAfter().run()} title={t('tb.addRow')}><Rows3 size={16} /></B>
          <B on={() => c().addColumnAfter().run()} title={t('tb.addCol')}><Columns3 size={16} /></B>
          <B on={() => c().deleteRow().run()} title={t('tb.delRow')}><Minus size={16} /></B>
          <B on={() => c().deleteColumn().run()} title={t('tb.delCol')}><Minus size={16} style={{ transform: 'rotate(90deg)' }} /></B>
          <B on={() => c().deleteTable().run()} title={t('tb.delTable')}><Trash2 size={16} /></B>
        </>
      )}
      <div className="grow" />
      <button className="btn ai sm" onMouseDown={(e) => e.preventDefault()} onClick={onAi} disabled={busy}>
        <Sparkles size={15} /> {busy ? t('ai.thinking') : t('ai.write')}
      </button>
    </div>
  );
}

function InsertMenu({ editor, page }: { editor: TEditor; page: Page }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const items: [string, React.ReactNode, () => void][] = [
    [t('slash.callout'), <Lightbulb size={16} />, () => editor.chain().focus().insertContent({ type: 'callout', attrs: { emoji: '💡', tone: 'info' } }).run()],
    [t('slash.toggle'), <ListTree size={16} />, () => editor.chain().focus().insertContent({ type: 'toggle', content: [{ type: 'paragraph' }] }).run()],
    [t('slash.code'), <Code size={16} />, () => editor.chain().focus().toggleCodeBlock().run()],
    [t('slash.divider'), <Minus size={16} />, () => editor.chain().focus().setHorizontalRule().run()],
    [t('slash.gallery'), <Images size={16} />, () => editor.chain().focus().insertContent({ type: 'gallery' }).run()],
    [t('slash.poll'), <BarChart3 size={16} />, () => editor.chain().focus().insertContent({ type: 'poll', attrs: { options: [{ id: 'a', label: '', votes: 0 }, { id: 'b', label: '', votes: 0 }] } }).run()],
    [t('slash.raffle'), <Dices size={16} />, () => editor.chain().focus().insertContent({ type: 'raffle' }).run()],
    [t('slash.form'), <FileSpreadsheet size={16} />, () => editor.chain().focus().insertContent({ type: 'form' }).run()],
    [t('slash.pageLink'), <Link2 size={16} />, () => editor.chain().focus().insertContent('[[').run()],
    [t('slash.subpage'), <FileText size={16} />, () => {
      const np = useVault.getState().createPage({ parentId: page.id });
      editor.chain().focus().insertContent([{ type: 'pageLink', attrs: { id: np.id, label: t('page.untitled') } }, { type: 'text', text: ' ' }]).run();
    }],
  ];
  return (
    <>
      <button ref={ref} className="tb wide" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)} title={t('tb.insert')}>
        <Plus size={16} /> <ChevronDown size={13} />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)}>
        <div className="menu">
          {items.map(([label, icon, run]) => (
            <button key={label} className="menu-item" onClick={() => (run(), setOpen(false))}>
              {icon} {label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------- menu flutuante

const COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8'];
const HIGHLIGHTS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe', '#fed7aa'];

function Bubble({ editor, onAi, busy }: { editor: TEditor; onAi: (a: AiAction, target?: string) => void; busy: boolean }) {
  const t = useT();
  const [menu, setMenu] = useState<'' | 'color' | 'ai'>('');
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (!url) c().unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: /^(https?:|mailto:)/.test(url) ? url : 'https://' + url }).run();
  };
  return (
    <div className="bubble">
      <button className="tb ai" onClick={() => setMenu(menu === 'ai' ? '' : 'ai')} disabled={busy}><Wand2 size={15} /> IA</button>
      <span className="tb-sep" />
      <button className={'tb' + (editor.isActive('bold') ? ' on' : '')} onClick={() => c().toggleBold().run()}><Bold size={15} /></button>
      <button className={'tb' + (editor.isActive('italic') ? ' on' : '')} onClick={() => c().toggleItalic().run()}><Italic size={15} /></button>
      <button className={'tb' + (editor.isActive('underline') ? ' on' : '')} onClick={() => c().toggleUnderline().run()}><UIcon size={15} /></button>
      <button className={'tb' + (editor.isActive('strike') ? ' on' : '')} onClick={() => c().toggleStrike().run()}><Strikethrough size={15} /></button>
      <button className={'tb' + (editor.isActive('code') ? ' on' : '')} onClick={() => c().toggleCode().run()}><Code size={15} /></button>
      <button className={'tb' + (editor.isActive('link') ? ' on' : '')} onClick={setLink}><Link2 size={15} /></button>
      <button className="tb" onClick={() => setMenu(menu === 'color' ? '' : 'color')}><span className="color-a">A</span></button>
      <span className="tb-sep" />
      <button className={'tb' + (editor.isActive({ textAlign: 'left' }) ? ' on' : '')} onClick={() => c().setTextAlign('left').run()}><AlignLeft size={15} /></button>
      <button className={'tb' + (editor.isActive({ textAlign: 'center' }) ? ' on' : '')} onClick={() => c().setTextAlign('center').run()}><AlignCenter size={15} /></button>
      <button className={'tb' + (editor.isActive({ textAlign: 'right' }) ? ' on' : '')} onClick={() => c().setTextAlign('right').run()}><AlignRight size={15} /></button>
      {menu === 'color' && (
        <div className="bubble-pop">
          <div className="muted small">{t('tb.textColor')}</div>
          <div className="color-row">
            {COLORS.map((col) => (
              <button key={col || 'none'} className="color-dot" style={{ background: col || 'var(--text)' }} onClick={() => (col ? c().setColor(col).run() : c().unsetColor().run(), setMenu(''))} />
            ))}
          </div>
          <div className="muted small">{t('tb.highlight')}</div>
          <div className="color-row">
            {HIGHLIGHTS.map((col) => (
              <button key={col} className="color-dot" style={{ background: col }} onClick={() => (c().toggleHighlight({ color: col }).run(), setMenu(''))} />
            ))}
            <button className="color-dot none" onClick={() => (c().unsetHighlight().run(), setMenu(''))}>×</button>
          </div>
        </div>
      )}
      {menu === 'ai' && (
        <div className="bubble-pop menu">
          {(['improve', 'fix', 'shorter', 'longer', 'summarize', 'explain', 'continue', 'actions'] as AiAction[]).map((a) => (
            <button key={a} className="menu-item" onClick={() => (onAi(a), setMenu(''))}>
              <Sparkles size={14} /> {t(`ai.action.${a}` as TKey)}
            </button>
          ))}
          <div className="menu-sep" />
          {(['pt', 'en', 'es'] as const).map((l) => (
            <button key={l} className="menu-item" onClick={() => (onAi('translate', { pt: 'Brazilian Portuguese', en: 'English', es: 'Spanish' }[l]), setMenu(''))}>
              🌐 {t('ai.translateTo')} {l.toUpperCase()}
            </button>
          ))}
          <div className="menu-sep" />
          {(['professional', 'friendly', 'persuasive'] as const).map((tone) => (
            <button key={tone} className="menu-item" onClick={() => (onAi('tone', tone), setMenu(''))}>
              🎭 {t(`ai.tone.${tone}` as TKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------- escrever com IA

function AiWriteModal({ open, onClose, editor }: { open: boolean; onClose: () => void; editor: TEditor }) {
  const t = useT();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [useCtx, setUseCtx] = useState(true);
  const presets = [t('ai.preset.meeting'), t('ai.preset.plan'), t('ai.preset.email'), t('ai.preset.ideas'), t('ai.preset.lesson'), t('ai.preset.table')];
  const go = async () => {
    if (!activeProvider()) return toast(t('ai.noProvider'), 'error');
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const out = await generate(prompt, useCtx ? editor.getText() : '');
      editor.chain().focus().insertContent(mdToHtml(out)).run();
      setPrompt('');
      onClose();
    } catch (e) {
      toast(t('ai.error') + ' ' + String((e as Error).message || e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<><Sparkles size={18} /> {t('ai.write')}</>}
      width={600}
      footer={
        <>
          <label className="check"><input type="checkbox" checked={useCtx} onChange={(e) => setUseCtx(e.target.checked)} /> {t('ai.useContext')}</label>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" onClick={go} disabled={busy || !prompt.trim()}>{busy ? t('ai.thinking') : t('ai.generate')}</button>
        </>
      }
    >
      <textarea
        className="input"
        rows={5}
        autoFocus
        placeholder={t('ai.prompt.placeholder')}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && go()}
      />
      <div className="chips">
        {presets.map((p) => (
          <button key={p} className="chip" onClick={() => setPrompt(p)}>{p}</button>
        ))}
      </div>
    </Modal>
  );
}
