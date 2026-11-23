import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  ArrowUpRight, Clock, Copy, CopyPlus, Database, FileText, FolderInput, Link2, Lock, LockOpen, Maximize2, MoreHorizontal, Pencil, Search, Smile,
  Sparkles, Star, Trash2, Upload, X,
} from 'lucide-react';
import type { Page, ViewType } from '../lib/types';
import { useT, type TKey } from '../i18n';
import { useVault } from '../store/vault';
import { toast, useUi } from '../store/ui';
import { Modal, PageIcon } from '../components/ui';
import { IconPicker } from '../components/IconPicker';
import { askConfirm } from '../components/PromptHost';
import { copyText } from '../lib/platform';
import { uid } from '../lib/crypto';
import { makeProperty } from './logic';
import { fmtDateTime } from '../lib/dates';
import { DatabaseView } from './DatabaseView';
import { EMBED_TYPES, ViewPreview } from './viewPreview';

function newDbPage(type: ViewType, parentId: string, t: (k: TKey) => string): Page {
  const v = useVault.getState();
  const titleId = uid('c');
  const status = makeProperty('status', t('db.type.status'), [t('db.status.todo'), t('db.status.doing'), t('db.status.done')]);
  const date = makeProperty('date', t('db.type.date'));
  const end = makeProperty('date', t('db.prop.end'));
  const props: any[] = [{ id: titleId, name: t('db.prop.name'), type: 'title' }];
  if (type === 'board' || type === 'list' || type === 'gallery' || type === 'table') props.push(status);
  if (['calendar', 'timeline', 'gantt'].includes(type)) props.push(date, status);
  if (type === 'gantt') props.push(end);
  if (type === 'map') props.push(makeProperty('location', t('db.type.location')));
  if (type === 'files') props.push(makeProperty('files', t('db.type.files')));
  const viewId = uid('v');
  const view: any = { id: viewId, name: t(`db.view.${type}` as TKey), type, filters: [] };
  if (type === 'board') view.groupBy = status.id;
  if (['calendar', 'timeline', 'gantt'].includes(type)) view.dateProp = date.id;
  if (type === 'gantt') view.endProp = end.id;
  if (type === 'map') view.locProp = props[props.length - 1].id;
  if (type === 'files') view.filesProp = props[props.length - 1].id;
  const tableId = uid('v');
  const views = type === 'table' ? [view] : [view, { id: tableId, name: t('db.view.table'), type: 'table', filters: [] }];
  return v.createPage({ type: 'database', parentId, title: t('page.newDatabase'), db: { properties: props, rows: [], views, activeView: viewId } });
}

/** Seletor exibido ao inserir uma base na página: escolha a visão (com prévia) ou ligue uma base existente. */
function EmbedPicker({ hostId, onPick }: { hostId: string | null; onPick: (pageId: string) => void }) {
  const t = useT();
  const pages = useVault((s) => s.pages);
  const [q, setQ] = useState('');
  const dbs = useMemo(() => Object.values(pages).filter((p) => p.type === 'database' && !p.deletedAt && (!q || (p.title || '').toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8), [pages, q]);
  return (
    <div className="embed-picker" contentEditable={false}>
      <div className="embed-picker-head"><Database size={16} /> <b>{t('embed.title')}</b><span className="muted small">{t('embed.sub')}</span></div>
      <div className="vp-grid">
        {EMBED_TYPES.map((ty) => (
          <button key={ty} className="vp-card" onClick={() => onPick(newDbPage(ty, hostId || '', t).id)}>
            <ViewPreview type={ty} />
            <span>{t(`db.view.${ty}` as TKey)}</span>
          </button>
        ))}
      </div>
      <div className="embed-link">
        <div className="section-label"><Link2 size={12} /> {t('embed.linkExisting')}</div>
        <label className="embed-search"><Search size={14} /><input value={q} placeholder={t('embed.search')} onChange={(e) => setQ(e.target.value)} /></label>
        {dbs.map((p) => (
          <button key={p.id} className="menu-item" onClick={() => onPick(p.id)}><PageIcon icon={p.icon} size={15} /> <span className="grow">{p.title || t('page.untitled')}</span> <span className="muted small">{p.db?.rows.length ?? 0}</span></button>
        ))}
        {!dbs.length && <p className="muted small">{t('embed.none')}</p>}
      </div>
    </div>
  );
}

/** Bloco de base de dados incorporada na página, com visões e menu de opções (estilo Notion). */
export function DbEmbedView({ node, updateAttributes, deleteNode, editor, getPos }: NodeViewProps) {
  const t = useT();
  const pageId: string = node.attrs.pageId || '';
  const page = useVault((s) => (pageId ? s.pages[pageId] : undefined));
  const v = useVault.getState;
  const go = useUi((s) => s.go);
  const [menu, setMenu] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [q, setQ] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menuPos = (): React.CSSProperties => {
    const r = menuBtn.current?.getBoundingClientRect();
    if (!r || innerWidth < 760) return {};
    const top = Math.min(r.bottom + 6, innerHeight - 520);
    return { position: 'fixed', top: Math.max(8, top), left: Math.max(8, r.right - 290) };
  };
  const hostId: string | null = (editor.storage as any).dbView?.hostPageId ?? null;

  if (!pageId || !page || page.deletedAt) {
    return (
      <NodeViewWrapper className="db-embed empty" data-type="dbView">
        {pageId && <p className="muted small" contentEditable={false}>{t('embed.missing')}</p>}
        <EmbedPicker hostId={hostId} onPick={(id) => updateAttributes({ pageId: id })} />
      </NodeViewWrapper>
    );
  }

  const toPageLink = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) return;
    editor.chain().focus().command(({ tr }) => {
      tr.replaceWith(pos, pos + node.nodeSize, editor.schema.nodes.paragraph.create(null, editor.schema.nodes.pageLink.create({ id: page.id, label: page.title || t('page.untitled') })));
      return true;
    }).run();
  };
  const duplicate = () => {
    const np = v().duplicatePage(page.id);
    if (!np) return;
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos != null) editor.chain().insertContentAt(pos + node.nodeSize, { type: 'dbView', attrs: { pageId: np.id } }).run();
    toast(t('embed.duplicated'), 'success');
  };
  const trash = async () => {
    if (!(await askConfirm({ title: t('embed.trashQ'), message: t('embed.trashMsg'), danger: true, okLabel: t('page.trash') }))) return;
    v().trashPage(page.id);
    deleteNode();
  };
  const allPages = Object.values(v().pages).filter((p) => !p.deletedAt && p.id !== page.id && p.type !== 'database' && (!q || (p.title || '').toLowerCase().includes(q.toLowerCase()))).slice(0, 30);
  const item = (icon: React.ReactNode, label: string, onClick: () => void, extra?: React.ReactNode, cls = '') => (
    <button className={'menu-item ' + cls} onClick={() => { setMenu(false); onClick(); }}>{icon} <span className="grow">{label}</span>{extra}</button>
  );

  return (
    <NodeViewWrapper className={'db-embed' + (page.locked ? ' locked' : '')} data-type="dbView">
      <div className="db-embed-head" contentEditable={false}>
        <button className="db-embed-icon" title={t('embed.editIcon')} onClick={() => setIconOpen(true)}><PageIcon icon={page.icon} size={20} /></button>
        <input
          ref={titleRef}
          className="db-embed-title"
          value={page.title}
          placeholder={t('page.newDatabase')}
          readOnly={!!page.locked}
          onChange={(e) => v().updatePage(page.id, { title: e.target.value })}
        />
        {page.locked && <span className="pill c-gray"><Lock size={11} /> {t('embed.locked')}</span>}
        <div className="grow" />
        <button className="icon-btn sm" title={t('embed.openPage')} onClick={() => go({ name: 'page', id: page.id })}><Maximize2 size={15} /></button>
        <div className="db-embed-menu-wrap">
          <button ref={menuBtn} className={'icon-btn sm' + (menu ? ' on' : '')} title={t('embed.options')} onClick={() => setMenu(!menu)}><MoreHorizontal size={16} /></button>
          {menu && createPortal(
            <>
              <div className="ctx-back clear" onMouseDown={() => setMenu(false)} />
              <div className="menu db-embed-menu" style={menuPos()}>
                <div className="section-label">{t('nav.database')} · {page.db?.views.find((x) => x.id === page.db?.activeView)?.name}</div>
                {item(<FileText size={15} />, t('embed.toPage'), toPageLink)}
                {item(<Smile size={15} />, t('embed.editIcon'), () => setIconOpen(true))}
                {item(<Star size={15} fill={page.favorite ? 'currentColor' : 'none'} />, page.favorite ? t('page.unfavorite') : t('page.favorite'), () => v().updatePage(page.id, { favorite: !page.favorite }))}
                <button className="menu-item" onClick={() => v().updatePage(page.id, { locked: !page.locked })}>
                  {page.locked ? <Lock size={15} /> : <LockOpen size={15} />} <span className="grow">{t('embed.lock')}</span>
                  <span className={'switch' + (page.locked ? ' on' : '')}><i /></span>
                </button>
                {item(<Pencil size={15} />, t('embed.rename'), () => setTimeout(() => titleRef.current?.select(), 30), <kbd>F2</kbd>)}
                {item(<Upload size={15} />, t('embed.mergeCsv'), () => window.dispatchEvent(new CustomEvent('gcp-db-import', { detail: page.id })))}
                <div className="menu-sep" />
                {item(<ArrowUpRight size={15} />, t('embed.openPage'), () => go({ name: 'page', id: page.id }))}
                {item(<Link2 size={15} />, t('embed.copyLink'), () => { void copyText(`[[${page.title || t('page.untitled')}]]`); toast(t('common.copied'), 'success'); })}
                {item(<CopyPlus size={15} />, t('common.duplicate'), duplicate)}
                {item(<FolderInput size={15} />, t('embed.moveTo'), () => setMoveOpen(true))}
                {item(<Trash2 size={15} />, t('page.trash'), trash, undefined, 'danger')}
                <div className="menu-sep" />
                {item(<Sparkles size={15} />, t('embed.askAi'), () => { useUi.getState().set({ aiPanel: true }); window.dispatchEvent(new CustomEvent('gcp-ai-context', { detail: page.id })); })}
                <div className="menu-foot muted small"><Clock size={12} /> {t('embed.lastEdit')} {fmtDateTime(page.updatedAt)}</div>
              </div>
            </>,
            document.body,
          )}
        </div>
        <button className="icon-btn sm danger-h" title={t('embed.remove')} onClick={() => deleteNode()}><X size={15} /></button>
      </div>
      <div className="db-embed-body" contentEditable={false}>
        <DatabaseView page={page} embedded />
      </div>
      <Modal open={iconOpen} onClose={() => setIconOpen(false)} title={t('embed.editIcon')} width={460}>
        <IconPicker onSelect={(icon) => { v().updatePage(page.id, { icon }); setIconOpen(false); }} />
      </Modal>
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={t('embed.moveTo')} width={460}>
        <label className="embed-search"><Search size={14} /><input autoFocus value={q} placeholder={t('embed.searchPage')} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="move-list">
          {allPages.map((p) => (
            <button key={p.id} className="menu-item" onClick={() => { v().movePage(page.id, p.id); setMoveOpen(false); toast(t('embed.moved', { p: p.title || t('page.untitled') }), 'success'); }}>
              <PageIcon icon={p.icon} size={15} /> <span className="grow">{p.title || t('page.untitled')}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost sm" onClick={() => { v().movePage(page.id, null); setMoveOpen(false); }}><Copy size={14} /> {t('page.moveToRoot')}</button>
      </Modal>
    </NodeViewWrapper>
  );
}
