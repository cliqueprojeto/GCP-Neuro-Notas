import { useMemo, useRef, useState } from 'react';
import {
  Check, Copy, FileUp, Folder, FolderInput, FolderMinus, FolderPlus, LayoutGrid, List, MoreHorizontal, Palette, Pencil, Play, Plus, Presentation, Search, Trash2,
} from 'lucide-react';
import { useT, useLang, LOCALES } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi } from '../store/ui';
import { relativeTime } from '../lib/doc';
import { uid } from '../lib/crypto';
import { ContextMenu, Empty, Modal, PageIcon, Popover, type MenuEntry } from './ui';
import { IconPicker } from './IconPicker';
import { askConfirm, askText } from './PromptHost';
import { pickBinaryFile } from '../lib/platform';
import { BoardThumb } from './Boards';
import { BgPanel } from '../canvas/BoardStyle';
import { BG_THEMES, themeOf } from '../canvas/backgrounds';
import type { CanvasData, CanvasNode, Page, PresFolder } from '../lib/types';

const NO_FOLDERS: PresFolder[] = [];
const FOLDER_COLORS = ['#8b5cf6', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#64748b'];
type Filter = 'all' | 'none' | string;

const slidesOf = (p: Page) => p.canvas?.nodes.filter((n) => n.kind === 'frame').length || 0;
export const isPresentation = (p: Page) => !!p.presentation || slidesOf(p) > 0;

/** Cria um quadro de apresentação com slides 16:9 já enquadrados e o tema escolhido. */
function deckCanvas(title: string, slides: number, theme: string, t: (k: any) => string): CanvasData {
  const nodes: CanvasNode[] = [];
  const W = 1280, H = 720, GAP = 160;
  const dark = themeOf({ theme }).dark;
  for (let i = 0; i < slides; i++) {
    const x = i * (W + GAP);
    nodes.push({ id: uid('n'), kind: 'frame', x, y: 0, w: W, h: H, color: '#ffffff', text: i === 0 ? title || t('pres.slideTitle') : `${t('present.slide')} ${i + 1}` });
    if (i === 0) {
      nodes.push({ id: uid('n'), kind: 'text', x: x + 140, y: 250, w: W - 280, h: 110, text: title || t('pres.slideTitle'), fontSize: 64, color: dark ? '#ffffff' : '#111827', anim: 'slide-up' });
      nodes.push({ id: uid('n'), kind: 'text', x: x + 140, y: 380, w: W - 280, h: 60, text: t('pres.deckSubtitle'), fontSize: 26, color: dark ? '#c7cbe8' : '#4b5563', anim: 'fade', animDelay: 0.5 });
    } else {
      nodes.push({ id: uid('n'), kind: 'text', x: x + 100, y: 80, w: W - 200, h: 80, text: `${t('present.slide')} ${i + 1}`, fontSize: 44, color: dark ? '#ffffff' : '#111827', anim: 'slide-left' });
    }
  }
  return { nodes, edges: [], view: { x: 40, y: 80, zoom: 0.5 }, bg: { theme, pattern: 'none' }, present: { transition: 'fly', duration: 1.1 } };
}

function NewDeck({ open, onClose, folder }: { open: boolean; onClose: () => void; folder?: string }) {
  const t = useT();
  const create = useVault((s) => s.createPage);
  const go = useUi((s) => s.go);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('midnight');
  const [slides, setSlides] = useState(3);
  const make = () => {
    const p = create({ type: 'canvas', title: name.trim(), icon: 'lucide:Presentation:#8b5cf6', presentation: true, presFolders: folder ? [folder] : [], canvas: deckCanvas(name.trim(), slides, theme, t) } as Partial<Page>);
    onClose();
    go({ name: 'page', id: p.id });
  };
  return (
    <Modal open={open} onClose={onClose} width={620} title={<><Presentation size={18} /> {t('pres.new')}</>}
      footer={<><button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn primary" onClick={make}><Plus size={15} /> {t('pres.create')}</button></>}>
      <div className="col gap">
        <input className="input" autoFocus placeholder={t('pres.namePh')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && make()} />
        <div className="section-label">{t('canvas.bg.theme')}</div>
        <div className="deck-themes">
          {BG_THEMES.filter((x) => x.id !== 'default').map((th) => (
            <button key={th.id} className={'deck-theme' + (theme === th.id ? ' on' : '')} onClick={() => setTheme(th.id)}>
              <span className={th.dark ? 'dark' : ''} style={{ background: th.layer || th.base }}><b>Aa</b><i /></span>
              <small>{t(`canvas.bg.${th.id}` as any)}</small>
            </button>
          ))}
        </div>
        <div className="ps-row">
          <span>{t('pres.initialSlides')}</span>
          <input type="range" min={1} max={10} value={slides} onChange={(e) => setSlides(+e.target.value)} />
          <b>{slides}</b>
        </div>
        <p className="muted small">{t('pres.newHint')}</p>
      </div>
    </Modal>
  );
}

/** Banco de apresentações: pastas com ícones (um item pode estar em várias), cartões ou lista, temas de fundo. */
export function Presentations() {
  const t = useT();
  const lang = useLang();
  const pages = useVault((s) => s.pages);
  const folders = useVault((s) => s.settings.presFolders) || NO_FOLDERS;
  const updateSettings = useVault((s) => s.updateSettings);
  const updatePage = useVault((s) => s.updatePage);
  const duplicate = useVault((s) => s.duplicatePage);
  const trash = useVault((s) => s.trashPage);
  const go = useUi((s) => s.go);
  const create = useVault((s) => s.createPage);
  const setUi = useUi((s) => s.set);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'cards' | 'list'>(() => { try { return (localStorage.getItem('gcp.pres.view') as any) || 'cards'; } catch { return 'cards'; } });
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuEntry[] } | null>(null);
  const [iconFor, setIconFor] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [themeFor, setThemeFor] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  const all = useMemo(() => livePages(pages).filter((p) => p.type === 'canvas' || p.mode === 'edgeless').filter(isPresentation).sort((a, b) => b.updatedAt - a.updatedAt), [pages]);
  const list = all.filter((p) => (filter === 'all' ? true : filter === 'none' ? !(p.presFolders || []).some((f) => folders.some((x) => x.id === f)) : (p.presFolders || []).includes(filter)))
    .filter((p) => !q.trim() || (p.title || '').toLowerCase().includes(q.trim().toLowerCase()));
  const countIn = (id: string) => all.filter((p) => (p.presFolders || []).includes(id)).length;
  const setView2 = (v: 'cards' | 'list') => { setView(v); try { localStorage.setItem('gcp.pres.view', v); } catch { /* ignora */ } };

  const saveFolders = (fn: (f: PresFolder[]) => PresFolder[]) => updateSettings((s) => ({ ...s, presFolders: fn(s.presFolders || []) }));
  const newFolder = async () => {
    const name = await askText({ title: t('pres.folderNew'), placeholder: t('pres.folderNamePh'), okLabel: t('pres.create') });
    if (!name?.trim()) return;
    const f: PresFolder = { id: uid('pf'), name: name.trim(), icon: 'lucide:Folder:' + FOLDER_COLORS[folders.length % FOLDER_COLORS.length], color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length] };
    saveFolders((x) => [...x, f]);
    setFilter(f.id);
  };
  const renameFolder = async (f: PresFolder) => {
    const name = await askText({ title: t('pres.folderRename'), value: f.name, okLabel: t('common.save') });
    if (name?.trim()) saveFolders((x) => x.map((y) => (y.id === f.id ? { ...y, name: name.trim() } : y)));
  };
  const deleteFolder = async (f: PresFolder) => {
    const ok = await askConfirm({ title: t('pres.folderDelete'), message: t('pres.folderDeleteMsg', { name: f.name }), okLabel: t('common.delete'), danger: true });
    if (!ok) return;
    saveFolders((x) => x.filter((y) => y.id !== f.id));
    for (const p of all) if (p.presFolders?.includes(f.id)) updatePage(p.id, { presFolders: p.presFolders.filter((x) => x !== f.id) });
    if (filter === f.id) setFilter('all');
  };
  const toggleIn = (p: Page, fid: string) => {
    const cur = p.presFolders || [];
    updatePage(p.id, { presFolders: cur.includes(fid) ? cur.filter((x) => x !== fid) : [...cur, fid] });
  };
  const moveTo = (p: Page, fid: string | null) => updatePage(p.id, { presFolders: fid ? [fid] : [] });
  const [importing, setImporting] = useState(false);
  const toast = useUi((s) => s.toast);
  const importDeck = async () => {
    const f = await pickBinaryFile('.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation');
    if (!f) return;
    setImporting(true);
    try {
      const { importPptx } = await import('../lib/pptxDeck');
      const { title, canvas } = await importPptx(f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer, { slide: t('present.slide') });
      const p = create({ type: 'canvas', title: title || f.name.replace(/\.pptx$/i, ''), icon: 'lucide:Presentation:#f97316', presentation: true, presFolders: curFolder ? [curFolder.id] : [], canvas } as Partial<Page>);
      toast(t('pres.imported', { n: canvas.nodes.filter((n) => n.kind === 'frame').length }), 'success');
      go({ name: 'page', id: p.id });
    } catch (e) {
      toast(t('pres.importError') + ' ' + String((e as Error).message || e), 'error');
    } finally {
      setImporting(false);
    }
  };
  const present = (p: Page) => { setUi({ presentNow: p.id }); go({ name: 'page', id: p.id }); };

  const openMenu = (p: Page, x: number, y: number, anchor?: HTMLElement) => {
    const items: MenuEntry[] = [
      { label: t('pres.present'), icon: <Play size={15} />, onClick: () => present(p) },
      { label: t('pres.edit'), icon: <Pencil size={15} />, onClick: () => go({ name: 'page', id: p.id }) },
      { label: t('pres.theme'), icon: <Palette size={15} />, onClick: () => anchor && setThemeFor({ id: p.id, el: anchor }) },
      { sep: true },
      ...folders.map((f) => ({ label: f.name, icon: (p.presFolders || []).includes(f.id) ? <Check size={15} /> : <PageIcon icon={f.icon} size={15} />, hint: t('pres.addTo'), onClick: () => toggleIn(p, f.id) })),
      ...(folders.length ? [{ sep: true } as MenuEntry] : []),
      ...folders.filter((f) => !(p.presFolders || []).includes(f.id)).slice(0, 6).map((f) => ({ label: `${t('pres.moveTo')} ${f.name}`, icon: <FolderInput size={15} />, onClick: () => moveTo(p, f.id) })),
      ...(filter !== 'all' && filter !== 'none' ? [{ label: t('pres.removeFromFolder'), icon: <FolderMinus size={15} />, onClick: () => toggleIn(p, filter) }] : []),
      { label: t('pres.newFolderWith'), icon: <FolderPlus size={15} />, onClick: async () => {
        const name = await askText({ title: t('pres.folderNew'), placeholder: t('pres.folderNamePh'), okLabel: t('pres.create') });
        if (!name?.trim()) return;
        const c = FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
        const f: PresFolder = { id: uid('pf'), name: name.trim(), icon: 'lucide:Folder:' + c, color: c };
        saveFolders((x) => [...x, f]);
        updatePage(p.id, { presFolders: [...(p.presFolders || []), f.id] });
      } },
      { sep: true },
      { label: t('pres.duplicate'), icon: <Copy size={15} />, onClick: () => duplicate(p.id) },
      ...(p.presentation ? [{ label: t('pres.unlist'), icon: <FolderMinus size={15} />, onClick: () => updatePage(p.id, { presentation: false }) }] : []),
      { label: t('common.delete'), icon: <Trash2 size={15} />, danger: true, onClick: () => trash(p.id) },
    ];
    setMenu({ x, y, items });
  };

  const FolderChips = ({ p }: { p: Page }) => (
    <span className="pres-chips">
      {(p.presFolders || []).map((id) => folders.find((f) => f.id === id)).filter(Boolean).map((f) => (
        <span key={f!.id} className="pres-chip" style={{ ['--fc' as any]: f!.color }}><PageIcon icon={f!.icon} size={11} /> {f!.name}</span>
      ))}
    </span>
  );
  const dragProps = (p: Page) => ({ draggable: true, onDragStart: (e: React.DragEvent) => { dragId.current = p.id; e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', p.id); } });
  const dropProps = (fid: string | null) => ({
    onDragOver: (e: React.DragEvent) => { if (dragId.current) (e.preventDefault(), setDragOver(fid ?? 'none')); },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const p = dragId.current ? pages[dragId.current] : undefined;
      dragId.current = null;
      if (!p) return;
      if (!fid) moveTo(p, null);
      else if (e.altKey || e.shiftKey) moveTo(p, fid);
      else if (!(p.presFolders || []).includes(fid)) toggleIn(p, fid);
    },
  });
  const curFolder = folders.find((f) => f.id === filter);

  return (
    <div className="page-shell wide pres-hub">
      <div className="page-hero compact">
        <div className="eyebrow"><Presentation size={13} /> {t('nav.presentations')}</div>
        <h1>{curFolder ? <><PageIcon icon={curFolder.icon} size={30} /> {curFolder.name}</> : t('pres.title')}</h1>
        <p className="muted">{t('pres.subtitle')}</p>
      </div>
      <div className="pres-layout">
        <aside className="pres-folders">
          <button className={'pres-folder' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}><LayoutGrid size={16} /> <span className="grow">{t('pres.all')}</span> <small>{all.length}</small></button>
          <button className={'pres-folder' + (filter === 'none' ? ' on' : '') + (dragOver === 'none' ? ' drop' : '')} onClick={() => setFilter('none')} {...dropProps(null)}><Folder size={16} /> <span className="grow">{t('pres.noFolder')}</span></button>
          <div className="section-label row">{t('pres.folders')} <span className="grow" /><button className="icon-btn xs" onClick={newFolder} title={t('pres.folderNew')}><Plus size={14} /></button></div>
          {folders.map((f) => (
            <div key={f.id} className={'pres-folder' + (filter === f.id ? ' on' : '') + (dragOver === f.id ? ' drop' : '')} onClick={() => setFilter(f.id)} {...dropProps(f.id)}
              onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: [
                { label: t('pres.folderRename'), icon: <Pencil size={15} />, onClick: () => renameFolder(f) },
                { label: t('pres.folderIcon'), icon: <Palette size={15} />, onClick: () => setIconFor({ id: f.id, el: e.currentTarget as HTMLElement }) },
                { sep: true },
                { label: t('pres.folderDelete'), icon: <Trash2 size={15} />, danger: true, onClick: () => deleteFolder(f) },
              ] }); }}>
              <button className="pf-icon" style={{ ['--fc' as any]: f.color }} onClick={(e) => { e.stopPropagation(); setIconFor({ id: f.id, el: e.currentTarget }); }} title={t('pres.folderIcon')}><PageIcon icon={f.icon} size={16} /></button>
              <span className="grow ellipsis">{f.name}</span>
              <small>{countIn(f.id)}</small>
              <button className="icon-btn xs pf-more" onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom, items: [
                { label: t('pres.folderRename'), icon: <Pencil size={15} />, onClick: () => renameFolder(f) },
                { label: t('pres.folderDelete'), icon: <Trash2 size={15} />, danger: true, onClick: () => deleteFolder(f) },
              ] }); }}><MoreHorizontal size={14} /></button>
            </div>
          ))}
          {!folders.length && <button className="btn ghost sm" onClick={newFolder}><FolderPlus size={14} /> {t('pres.folderNew')}</button>}
          <p className="muted small pres-tip">{t('pres.dragTip')}</p>
        </aside>
        <section className="pres-main">
          <div className="pres-toolbar">
            <button className="btn primary" onClick={() => setNewOpen(true)}><Plus size={16} /> {t('pres.new')}</button>
            <button className="btn ghost" onClick={importDeck} disabled={importing}><FileUp size={15} /> {importing ? t('pres.importing') : t('pres.importPptx')}</button>
            <label className="pres-search"><Search size={14} /><input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <span className="grow" />
            <div className="seg sm">
              <button className={view === 'cards' ? 'on' : ''} onClick={() => setView2('cards')} title={t('pres.cards')}><LayoutGrid size={14} /> <span className="hide-xs">{t('pres.cards')}</span></button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => setView2('list')} title={t('pres.list')}><List size={14} /> <span className="hide-xs">{t('pres.list')}</span></button>
            </div>
          </div>
          {!list.length ? (
            <Empty icon={<Presentation size={30} />} title={t('pres.empty')} text={t('pres.emptyText')} action={<button className="btn primary" onClick={() => setNewOpen(true)}><Plus size={16} /> {t('pres.new')}</button>} />
          ) : view === 'cards' ? (
            <div className="pres-grid">
              {list.map((p) => {
                const th = themeOf(p.canvas?.bg);
                return (
                  <div key={p.id} className="pres-card" {...dragProps(p)} onContextMenu={(e) => (e.preventDefault(), openMenu(p, e.clientX, e.clientY, e.currentTarget as HTMLElement))}>
                    <button className={'pres-thumb' + (th.dark ? ' dark' : '')} style={{ background: p.canvas?.bg?.image ? `center / cover url("${p.canvas.bg.image}")` : th.layer || th.base || 'var(--panel-2)' }} onClick={() => go({ name: 'page', id: p.id })}>
                      <BoardThumb page={p} />
                      <span className="pres-play" onClick={(e) => (e.stopPropagation(), present(p))} title={t('pres.present')}><Play size={18} fill="currentColor" /></span>
                      <span className="pres-count">{slidesOf(p)} {t('present.slides').toLowerCase()}</span>
                    </button>
                    <div className="pres-card-body">
                      <div className="row">
                        <b className="grow ellipsis"><PageIcon icon={p.icon} size={15} /> {p.title || t('page.untitled')}</b>
                        <button className="icon-btn xs" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(p, r.left, r.bottom, e.currentTarget.closest('.pres-card') as HTMLElement); }}><MoreHorizontal size={15} /></button>
                      </div>
                      <FolderChips p={p} />
                      <small className="muted">{relativeTime(p.updatedAt, LOCALES[lang])}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pres-table-wrap">
              <table className="pres-table">
                <thead><tr><th>{t('pres.col.name')}</th><th>{t('pres.folders')}</th><th>{t('present.slides')}</th><th>{t('canvas.bg.theme')}</th><th>{t('pres.col.updated')}</th><th /></tr></thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} {...dragProps(p)} onDoubleClick={() => go({ name: 'page', id: p.id })} onContextMenu={(e) => (e.preventDefault(), openMenu(p, e.clientX, e.clientY, e.currentTarget as HTMLElement))}>
                      <td><button className="link-btn" onClick={() => go({ name: 'page', id: p.id })}><PageIcon icon={p.icon} size={15} /> {p.title || t('page.untitled')}</button></td>
                      <td><FolderChips p={p} /></td>
                      <td>{slidesOf(p)}</td>
                      <td><span className="pres-theme-dot" style={{ background: themeOf(p.canvas?.bg).layer || themeOf(p.canvas?.bg).base || 'var(--bg)' }} /> {t(`canvas.bg.${themeOf(p.canvas?.bg).id}` as any)}</td>
                      <td className="muted">{relativeTime(p.updatedAt, LOCALES[lang])}</td>
                      <td className="row">
                        <button className="icon-btn xs" onClick={() => present(p)} title={t('pres.present')}><Play size={14} /></button>
                        <button className="icon-btn xs" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu(p, r.left, r.bottom, e.currentTarget.closest('tr') as HTMLElement); }}><MoreHorizontal size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <NewDeck open={newOpen} onClose={() => setNewOpen(false)} folder={curFolder?.id} />
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      <Popover anchor={iconFor?.el || null} open={!!iconFor} onClose={() => setIconFor(null)}>
        <div style={{ width: 330 }}>
          <IconPicker onSelect={(icon) => { const m = icon.match(/^lucide:[^:]+:(#[0-9a-f]{3,8})/i); saveFolders((x) => x.map((f) => (f.id === iconFor!.id ? { ...f, icon, color: m ? m[1] : f.color } : f))); setIconFor(null); }} />
        </div>
      </Popover>
      <Popover anchor={themeFor?.el || null} open={!!themeFor} onClose={() => setThemeFor(null)}>
        {themeFor && pages[themeFor.id] && (
          <BgPanel bg={pages[themeFor.id].canvas?.bg} onChange={(bg) => { const c = pages[themeFor.id].canvas; if (c) updatePage(themeFor.id, { canvas: { ...c, bg } }); }} />
        )}
      </Popover>
    </div>
  );
}
