import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight, Clock, Copy, Download, FileText, History, ImagePlus, Link2, Maximize2, Minimize2, MoreHorizontal, PenTool, Printer, Share2,
  Smile, Sparkles, Star, Tag, Trash2, X, FileType, Presentation, Sheet, FileDown, Network, Type, BookmarkPlus,
} from 'lucide-react';
import { SaveTemplateModal } from '../templates/user';
import { NotionSendModal } from './settings/NotionCard';
import { NotionIcon } from './settings/BrandIcons';
import { useT, useLang, LOCALES } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi, toast } from '../store/ui';
import { usePrefs } from '../store/prefs';
import { getTheme, coverCss, COVER_GRADIENTS } from '../lib/themes';
import { Editor } from '../editor/Editor';
import { DatabaseView } from '../database/DatabaseView';
import { ReportView } from '../reports/ReportView';
import { CanvasView } from '../canvas/CanvasView';
import { IconPicker } from './IconPicker';
import { Modal, PageIcon, Popover } from './ui';
import { ShareModal } from './ShareModal';
import { backlinks, formatDate, relativeTime } from '../lib/doc';
import { relatedPages, unlinkedMentions } from '../ai/brain';
import { pickImages } from '../lib/platform';
import { exportPageFile } from '../lib/transfer';
import { exportDocx, exportPdf, exportPptx, exportXlsx, printPage } from '../lib/exporters';
import { runAction, activeProvider } from '../ai/assist';
import type { Page, Snapshot } from '../lib/types';

export function PageView({ id }: { id: string }) {
  const t = useT();
  const page = useVault((s) => s.pages[id]);
  if (!page || page.purged) return <div className="page-shell"><div className="empty"><h3>{t('page.notFound')}</h3></div></div>;
  return <PageInner key={page.id} page={page} />;
}

function PageInner({ page }: { page: Page }) {
  const t = useT();
  const lang = useLang();
  const v = useVault();
  const go = useUi((s) => s.go);
  const theme = usePrefs((s) => s.theme);
  const width = useVault((s) => s.settings.editor.width);
  const [iconOpen, setIconOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [share, setShare] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [notionOpen, setNotionOpen] = useState(false);
  const [history, setHistory] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const expRef = useRef<HTMLButtonElement>(null);
  const coverRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const set = (p: Partial<Page>) => v.updatePage(page.id, p);
  const edgeless = page.type === 'canvas' || (page.type === 'page' && page.mode === 'edgeless');
  const all = livePages(v.pages);
  const links = useMemo(() => backlinks(all, page.id), [all, page.id]);
  const related = useMemo(() => (page.type === 'page' ? relatedPages(all, page, 5) : []), [all, page]);
  const mentions = useMemo(() => unlinkedMentions(all, page).slice(0, 5), [all, page]);
  const kids = all.filter((p) => p.parentId === page.id).sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  }, [page.title]);
  useEffect(() => {
    if (!page.title && page.type !== 'canvas') setTimeout(() => titleRef.current?.focus(), 60);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const suggest = async (what: 'title' | 'tags') => {
    if (!activeProvider()) return toast(t('ai.noProvider'), 'error');
    setAiBusy(true);
    try {
      const text = (await import('../lib/doc')).pageText(page);
      const out = await runAction(what, text);
      if (what === 'title') set({ title: out.replace(/^["'#\s]+|["'\s]+$/g, '') });
      else set({ tags: [...new Set([...(page.tags || []), ...out.split(',').map((s) => s.trim().replace(/^#/, '').toLowerCase()).filter(Boolean)])].slice(0, 12) });
    } catch (e) {
      toast(t('ai.error') + ' ' + String((e as Error).message), 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const doExport = async (kind: 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'md' | 'html' | 'print') => {
    setExportOpen(false);
    try {
      if (kind === 'print') return printPage();
      toast(t('export.working'), 'info');
      let path: string | null = null;
      if (kind === 'pdf') path = await exportPdf(page, contentRef.current);
      if (kind === 'docx') path = await exportDocx(page);
      if (kind === 'pptx') path = await exportPptx(page, getTheme(theme).dark);
      if (kind === 'xlsx') path = await exportXlsx(page);
      if (kind === 'md' || kind === 'html') path = await exportPageFile(page, kind);
      if (path) toast(t('export.done'), 'success');
    } catch (e) {
      toast(t('export.error') + ' ' + String((e as Error).message), 'error');
    }
  };

  const full = page.fullWidth || page.type === 'database' || page.type === 'report' || width === 'wide';

  return (
    <div className={'page-view' + (edgeless ? ' edgeless' : '')}>
      <div className={'page-toolbar' + (edgeless ? ' floating' : '')}>
        {page.type === 'page' && (
          <div className="mode-seg">
            <button className={!edgeless ? 'on' : ''} onClick={() => set({ mode: 'doc' })} title={t('page.modeDoc')}><FileText size={15} /> <span>{t('page.modeDoc')}</span></button>
            <button className={edgeless ? 'on' : ''} onClick={() => set({ mode: 'edgeless' })} title={t('page.modeEdgeless')}><PenTool size={15} /> <span>{t('page.modeEdgeless')}</span></button>
          </div>
        )}
        {edgeless && (
          <div className="edgeless-title">
            <PageIcon icon={page.icon} size={18} />
            <input value={page.title} placeholder={t('page.untitled')} onChange={(e) => set({ title: e.target.value })} />
          </div>
        )}
        <div className="grow" />
        <span className="muted small hide-mobile"><Clock size={13} /> {relativeTime(page.updatedAt, LOCALES[lang])}</span>
        <button className={'icon-btn sm' + (page.favorite ? ' fav' : '')} onClick={() => set({ favorite: !page.favorite })} title={t('page.favorite')}><Star size={16} fill={page.favorite ? 'currentColor' : 'none'} /></button>
        <button className="btn ghost sm" onClick={() => setShare(true)}><Share2 size={15} /> <span className="hide-mobile">{t('share.short')}</span></button>
        <button ref={expRef} className="btn ghost sm" onClick={() => setExportOpen(!exportOpen)}><Download size={15} /> <span className="hide-mobile">{t('export.short')}</span></button>
        <button ref={menuRef} className="icon-btn sm" onClick={() => setMenu(!menu)}><MoreHorizontal size={17} /></button>
      </div>
      {!edgeless && page.cover && (
        <div className="cover" style={{ background: coverCss(page.cover) }}>
          <div className="cover-actions">
            <button ref={coverRef} className="btn glass sm" onClick={() => setCoverOpen(true)}>{t('page.changeCover')}</button>
            <button className="btn glass sm" onClick={() => set({ cover: null })}>{t('common.remove')}</button>
          </div>
        </div>
      )}
      <Popover anchor={expRef.current} open={exportOpen} onClose={() => setExportOpen(false)} align="right">
        <div className="menu">
          <button className="menu-item" onClick={() => doExport('print')}><Printer size={15} /> {t('export.print')}</button>
          <button className="menu-item" onClick={() => doExport('pdf')}><FileDown size={15} /> PDF</button>
          <button className="menu-item" onClick={() => doExport('docx')}><FileType size={15} /> Word (.docx)</button>
          <button className="menu-item" onClick={() => doExport('pptx')}><Presentation size={15} /> PowerPoint (.pptx)</button>
          <button className="menu-item" onClick={() => doExport('xlsx')}><Sheet size={15} /> Excel (.xlsx)</button>
          {page.type === 'page' && (
            <>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => doExport('md')}><FileText size={15} /> Markdown (.md)</button>
              <button className="menu-item" onClick={() => doExport('html')}><FileText size={15} /> HTML</button>
              <button className="menu-item" onClick={() => (setExportOpen(false), setNotionOpen(true))}><NotionIcon size={15} /> {t('notion.send')}</button>
            </>
          )}
        </div>
      </Popover>
      <Popover anchor={menuRef.current} open={menu} onClose={() => setMenu(false)} align="right">
        <div className="menu">
          {page.type === 'page' && !edgeless && (
            <>
              <div className="menu-label">{t('page.font')}</div>
              <div className="font-pick">
                {(['sans', 'serif', 'mono'] as const).map((f) => (
                  <button key={f} className={(page.font || 'sans') === f ? 'on' : ''} onClick={() => set({ font: f })}><span className={'font-' + f}>Ag</span><small>{f}</small></button>
                ))}
              </div>
              <button className="menu-item" onClick={() => set({ fullWidth: !page.fullWidth })}>{page.fullWidth ? <Minimize2 size={15} /> : <Maximize2 size={15} />} {t('page.fullWidth')}</button>
              <div className="menu-sep" />
            </>
          )}
          <button className="menu-item" onClick={() => (setTplOpen(true), setMenu(false))}><BookmarkPlus size={15} /> {page.type === 'database' ? t('utpl.titleDb') : t('utpl.titlePage')}</button>
          <button className="menu-item" onClick={() => (setHistory(true), setMenu(false))}><History size={15} /> {t('page.history')}</button>
          <button className="menu-item" onClick={() => { const c = v.duplicatePage(page.id); setMenu(false); if (c) go({ name: 'page', id: c.id }); }}><Copy size={15} /> {t('common.duplicate')}</button>
          <button className="menu-item" onClick={() => (navigator.clipboard?.writeText(`[[${page.title}]]`), toast(t('common.copied'), 'success'), setMenu(false))}><Link2 size={15} /> {t('page.copyLink')}</button>
          <button className="menu-item" onClick={() => (go({ name: 'graph' }), setMenu(false))}><Network size={15} /> {t('nav.graph')}</button>
          <div className="menu-sep" />
          <button className="menu-item danger" onClick={() => { v.trashPage(page.id); setMenu(false); go(page.parentId ? { name: 'page', id: page.parentId } : { name: 'home' }); }}><Trash2 size={15} /> {t('page.trash')}</button>
        </div>
      </Popover>

      {edgeless ? (
        <div className="page-content canvas-host" ref={contentRef}>
          <CanvasView page={page} embedSelf={page.type === 'page'} />
        </div>
      ) : (
        <div className={'page-content' + (full ? ' full' : '')} ref={contentRef}>
          <div className={'page-head' + (page.cover ? ' has-cover' : '')}>
            <button ref={iconRef} className="page-big-icon" onClick={() => setIconOpen(true)}>
              <PageIcon icon={page.icon} size={56} />
            </button>
            <div className="page-head-actions">
              {!page.cover && <button className="btn ghost xs" onClick={() => set({ cover: 'g:' + Math.floor(Math.random() * COVER_GRADIENTS.length) })}><ImagePlus size={14} /> {t('page.addCover')}</button>}
              <button className="btn ghost xs" onClick={() => setIconOpen(true)}><Smile size={14} /> {t('page.icon')}</button>
              {page.type === 'page' && <button className="btn ghost xs" onClick={() => suggest('title')} disabled={aiBusy}><Sparkles size={14} /> {t('page.suggestTitle')}</button>}
            </div>
            <textarea
              ref={titleRef}
              className="page-title"
              rows={1}
              value={page.title}
              placeholder={t(page.type === 'database' ? 'page.newDatabase' : page.type === 'report' ? 'page.newReport' : 'page.untitled')}
              onChange={(e) => set({ title: e.target.value.replace(/\n/g, '') })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (document.querySelector('.ProseMirror') as HTMLElement | null)?.focus();
                }
              }}
            />
            <div className="tags-row">
              <Tag size={14} className="muted" />
              {(page.tags || []).map((tg) => (
                <span key={tg} className="tag">#{tg}<button onClick={() => set({ tags: page.tags.filter((x) => x !== tg) })}><X size={11} /></button></span>
              ))}
              <input
                className="tag-input"
                placeholder={t('page.addTag')}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault();
                    set({ tags: [...new Set([...(page.tags || []), tagInput.trim().replace(/^#/, '').toLowerCase()])] });
                    setTagInput('');
                  }
                }}
              />
              {page.type === 'page' && <button className="link-btn small" onClick={() => suggest('tags')} disabled={aiBusy}><Sparkles size={12} /> {t('page.suggestTags')}</button>}
            </div>
          </div>

          {page.type === 'page' && <Editor page={page} />}
          {page.type === 'database' && page.db && <DatabaseView page={page} />}
          {page.type === 'report' && page.report && <ReportView page={page} />}

          {kids.length > 0 && page.type === 'page' && (
            <div className="subpages">
              <div className="section-label">{t('page.subpages')}</div>
              <div className="subpage-grid">
                {kids.map((k) => (
                  <button key={k.id} className="subpage" onClick={() => go({ name: 'page', id: k.id })}>
                    <PageIcon icon={k.icon} size={18} /> <span className="ellipsis">{k.title || t('page.untitled')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(links.length > 0 || related.length > 0 || mentions.length > 0) && (
            <div className="connections">
              {links.length > 0 && (
                <div>
                  <div className="section-label"><ArrowUpRight size={14} /> {t('page.backlinks', { n: links.length })}</div>
                  {links.map((p) => <ConnRow key={p.id} p={p} />)}
                </div>
              )}
              {related.length > 0 && (
                <div>
                  <div className="section-label"><Sparkles size={14} /> {t('page.related')}</div>
                  {related.map(({ page: p, score }) => <ConnRow key={p.id} p={p} score={score} />)}
                </div>
              )}
              {mentions.length > 0 && (
                <div>
                  <div className="section-label"><Type size={14} /> {t('page.mentions')}</div>
                  {mentions.map((p) => <ConnRow key={p.id} p={p} />)}
                </div>
              )}
            </div>
          )}
          <div className="page-meta muted small">
            {t('page.created')} {formatDate(page.createdAt, LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>
      )}

      <Modal open={iconOpen} onClose={() => setIconOpen(false)} title={t('page.icon')} width={420}>
        <IconPicker allowStickers onSelect={(icon) => (set({ icon }), setIconOpen(false))} onRemove={() => (set({ icon: '' }), setIconOpen(false))} />
      </Modal>
      <Modal open={coverOpen} onClose={() => setCoverOpen(false)} title={t('page.changeCover')} width={620}>
        <div className="cover-grid">
          {COVER_GRADIENTS.map((g, i) => (
            <button key={i} style={{ background: g }} onClick={() => (set({ cover: 'g:' + i }), setCoverOpen(false))} />
          ))}
        </div>
        <button className="btn ghost" onClick={async () => { const [src] = await pickImages(false, 2000); if (src) { set({ cover: src }); setCoverOpen(false); } }}>
          <ImagePlus size={15} /> {t('page.uploadCover')}
        </button>
      </Modal>
      <ShareModal page={page} open={share} onClose={() => setShare(false)} />
      {tplOpen && <SaveTemplateModal page={page} open onClose={() => setTplOpen(false)} />}
      {notionOpen && <NotionSendModal page={page} onClose={() => setNotionOpen(false)} />}
      {history && <HistoryModal page={page} onClose={() => setHistory(false)} />}
    </div>
  );
}

function ConnRow({ p, score }: { p: Page; score?: number }) {
  const t = useT();
  const go = useUi((s) => s.go);
  return (
    <button className="conn-row" onClick={() => go({ name: 'page', id: p.id })}>
      <PageIcon icon={p.icon} size={16} />
      <span className="grow ellipsis">{p.title || t('page.untitled')}</span>
      {score !== undefined && <span className="score"><i style={{ width: `${Math.min(100, score * 160)}%` }} /></span>}
    </button>
  );
}

function HistoryModal({ page, onClose }: { page: Page; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const [list, setList] = useState<Snapshot[] | null>(null);
  const [sel, setSel] = useState<Snapshot | null>(null);
  useEffect(() => {
    void useVault.getState().snapshots(page.id).then((l) => (setList(l), setSel(l[0] || null)));
  }, [page.id]);
  const restore = () => {
    if (!sel) return;
    useVault.getState().updatePage(page.id, { content: sel.content, db: sel.db ?? page.db, title: sel.title });
    toast(t('history.restored'), 'success');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={<><History size={18} /> {t('page.history')}</>} width={860}
      footer={<><div className="grow" /><button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button><button className="btn primary" onClick={restore} disabled={!sel}>{t('history.restore')}</button></>}>
      {list && !list.length && <p className="muted">{t('history.empty')}</p>}
      {list && list.length > 0 && (
        <div className="history">
          <div className="history-list">
            {list.map((s) => (
              <button key={s.id} className={sel?.id === s.id ? 'on' : ''} onClick={() => setSel(s)}>
                <b>{formatDate(s.at, LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' })}</b>
                <small className="muted">{relativeTime(s.at, LOCALES[lang])}</small>
              </button>
            ))}
          </div>
          <div className="history-preview prose">
            {sel && <SnapshotPreview snap={sel} />}
          </div>
        </div>
      )}
    </Modal>
  );
}

function SnapshotPreview({ snap }: { snap: Snapshot }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    void import('../lib/transfer').then((m) => setHtml(m.pageToHtml({ content: snap.content } as Page)));
  }, [snap]);
  return (
    <>
      <h2>{snap.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
