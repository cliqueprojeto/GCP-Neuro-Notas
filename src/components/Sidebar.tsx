import { useMemo, useRef, useState } from 'react';
import { NeuroIcon } from './NeuroIcon';
import {
  CalendarHeart, ChevronRight, Copy, Database, ExternalLink, FileText, Heart, Home, Info, LayoutTemplate, ListTodo, MoreHorizontal, Network,
  PanelLeftClose, PieChart, Plus, Search, Settings, Sparkles, Star, StarOff, Trash2, Palette, Lock, Upload, PenTool, Presentation, Archive as ArchiveIcon,
} from 'lucide-react';
import { useT } from '../i18n';
import { useVault, childrenOf, livePages } from '../store/vault';
import { usePagesMeta } from '../store/selectors';
import { toast, useUi, type Route } from '../store/ui';
import { usePrefs } from '../store/prefs';
import { PageIcon, Popover } from './ui';
import { APP_VERSION, openUrl } from '../lib/platform';
import type { Page, PageType } from '../lib/types';
import { openDaily } from './Journal';
import { MiniCalendar } from './CalendarHub';

export const AUTHOR_URL = 'https://www.gestaoculturalpro.com.br';

export function Sidebar() {
  const t = useT();
  const pages = usePagesMeta();
  const createPage = useVault((s) => s.createPage);
  const lock = useVault((s) => s.lock);
  const saving = useVault((s) => s.saving);
  const route = useUi((s) => s.route);
  const go = useUi((s) => s.go);
  const setUi = useUi((s) => s.set);
  const setPrefs = usePrefs((s) => s.set);
  const roots = childrenOf(pages, null);
  const favorites = livePages(pages).filter((p) => p.favorite).sort((a, b) => a.title.localeCompare(b.title));
  const trashCount = Object.values(pages).filter((p) => p.deletedAt && !p.purged).length;
  const archiveCount = Object.values(pages).filter((p) => p.archivedAt && !p.deletedAt && !p.purged).length;
  const [newOpen, setNewOpen] = useState(false);
  const newRef = useRef<HTMLButtonElement>(null);

  const newPage = (type: PageType) => {
    const p = createPage({ type, title: '' });
    go({ name: 'page', id: p.id });
    setNewOpen(false);
  };
  const is = (r: Route['name']) => route.name === r;
  const Nav = ({ r, icon, label, badge }: { r: Route; icon: React.ReactNode; label: string; badge?: number }) => (
    <button className={'nav' + (is(r.name) && (r.name !== 'page') ? ' active' : '')} onClick={() => go(r)}>
      {icon}
      <span className="grow">{label}</span>
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo.svg" alt="" className="brand-logo" />
        <div className="brand-text">
          <b>GCP-Neuro Notas</b>
          <small>{t('app.tagline')}</small>
        </div>
        <button className="icon-btn sm hide-mobile" onClick={() => setPrefs({ sidebarCollapsed: true })} title={t('nav.collapse')}>
          <PanelLeftClose size={17} />
        </button>
      </div>

      <button className="search-btn" onClick={() => setUi({ palette: true })}>
        <Search size={15} /> <span className="grow">{t('nav.search')}</span> <kbd>Ctrl K</kbd>
      </button>

      <nav className="nav-group">
        <Nav r={{ name: 'home' }} icon={<Home size={17} />} label={t('nav.home')} />
        <MiniCalendar />
        <button className="nav" onClick={() => openDaily()}><CalendarHeart size={17} /><span className="grow">{t('nav.today')}</span></button>
        <Nav r={{ name: 'tasks' }} icon={<ListTodo size={17} />} label={t('nav.tasks')} />
        <Nav r={{ name: 'boards' }} icon={<PenTool size={17} />} label={t('nav.boards')} />
        <Nav r={{ name: 'presentations' }} icon={<Presentation size={17} />} label={t('nav.presentations')} />
        <Nav r={{ name: 'graph' }} icon={<NeuroIcon size={17} />} label={t('nav.graph')} />
        <button className="nav" onClick={() => setUi({ aiPanel: true })}><Sparkles size={17} /><span className="grow">{t('nav.brain')}</span></button>
        <Nav r={{ name: 'templates' }} icon={<LayoutTemplate size={17} />} label={t('nav.templates')} />
      </nav>

      <div className="side-scroll">
        {favorites.length > 0 && (
          <div className="tree-section">
            <div className="section-label">{t('nav.favorites')}</div>
            {favorites.map((p) => (
              <TreeItem key={'f' + p.id} page={p} depth={0} flat />
            ))}
          </div>
        )}
        <div className="tree-section">
          <div className="section-label">
            <span className="grow">{t('nav.pages')}</span>
            <button ref={newRef} className="icon-btn xs" onClick={() => setNewOpen(!newOpen)} title={t('nav.new')}><Plus size={15} /></button>
            <Popover anchor={newRef.current} open={newOpen} onClose={() => setNewOpen(false)}>
              <NewMenu onPick={newPage} onTemplates={() => (go({ name: 'templates' }), setNewOpen(false))} />
            </Popover>
          </div>
          {roots.map((p) => (
            <TreeItem key={p.id} page={p} depth={0} />
          ))}
          {!roots.length && <div className="muted small pad">{t('nav.empty')}</div>}
          <button className="nav subtle" onClick={() => newPage('page')}><Plus size={16} /><span className="grow">{t('nav.newPage')}</span></button>
        </div>
      </div>

      <nav className="nav-group bottom">
        {archiveCount > 0 && <Nav r={{ name: 'archive' }} icon={<ArchiveIcon size={17} />} label={t('nav.archive')} badge={archiveCount} />}
        <Nav r={{ name: 'trash' }} icon={<Trash2 size={17} />} label={t('nav.trash')} badge={trashCount} />
        <Nav r={{ name: 'settings' }} icon={<Settings size={17} />} label={t('nav.settings')} />
        <Nav r={{ name: 'support' }} icon={<Heart size={17} />} label={t('nav.support')} />
        <Nav r={{ name: 'about' }} icon={<Info size={17} />} label={t('nav.about')} />
      </nav>

      <div className="side-foot">
        <div className="row">
          <span className={'status-pill' + (saving ? ' saving' : '')}><i /> {saving ? t('status.saving') : t('status.encrypted')}</span>
          <div className="grow" />
          <button className="icon-btn sm" onClick={lock} title={t('nav.lock')}><Lock size={15} /></button>
        </div>
        <small className="muted">{t('about.version')} {APP_VERSION}</small>
        <button className="author" onClick={() => openUrl(AUTHOR_URL)}>
          <span>{t('about.developedBy')} <b>Bruno Albertini</b></span>
          <span className="author-link">Gestão Cultural Pro <ExternalLink size={12} /></span>
        </button>
      </div>
    </aside>
  );
}

export function NewMenu({ onPick, onTemplates }: { onPick: (t: PageType) => void; onTemplates: () => void }) {
  const t = useT();
  return (
    <div className="menu">
      <button className="menu-item" onClick={() => onPick('page')}><FileText size={16} /> {t('new.page')}<small className="menu-hint">{t('new.page.hint')}</small></button>
      <button className="menu-item" onClick={() => onPick('database')}><Database size={16} /> {t('new.database')}<small className="menu-hint">{t('new.database.hint')}</small></button>
      <button className="menu-item" onClick={() => onPick('report')}><PieChart size={16} /> {t('new.report')}<small className="menu-hint">{t('new.report.hint')}</small></button>
      <button className="menu-item" onClick={() => onPick('canvas')}><Palette size={16} /> {t('new.canvas')}<small className="menu-hint">{t('new.canvas.hint')}</small></button>
      <div className="menu-sep" />
      <button className="menu-item" onClick={onTemplates}><LayoutTemplate size={16} /> {t('new.fromTemplate')}</button>
    </div>
  );
}

function TreeItem({ page, depth, flat }: { page: Page; depth: number; flat?: boolean }) {
  const t = useT();
  const pages = usePagesMeta();
  const v = useVault.getState();
  const route = useUi((s) => s.route);
  const go = useUi((s) => s.go);
  const kids = useMemo(() => (flat ? [] : childrenOf(pages, page.id)), [pages, page.id, flat]);
  const [open, setOpen] = useState(() => localStorage.getItem('tree:' + page.id) === '1');
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState<'' | 'in' | 'before'>('');
  const menuRef = useRef<HTMLButtonElement>(null);
  const active = route.name === 'page' && route.id === page.id;
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem('tree:' + page.id, open ? '0' : '1');
    } catch {
      /* ignora */
    }
  };
  return (
    <div className="tree-node">
      <div
        className={'tree-item' + (active ? ' active' : '') + (drop ? ' drop-' + drop : '')}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable={!flat}
        onDragStart={(e) => e.dataTransfer.setData('text/gcp-page', page.id)}
        onDragOver={(e) => {
          if (flat) return;
          e.preventDefault();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDrop(e.clientY - r.top < r.height * 0.3 ? 'before' : 'in');
        }}
        onDragLeave={() => setDrop('')}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('text/gcp-page');
          if (id && id !== page.id) {
            if (drop === 'in') {
              v.movePage(id, page.id);
              setOpen(true);
            } else v.movePage(id, page.parentId, page.id);
          }
          setDrop('');
        }}
        onClick={() => go({ name: 'page', id: page.id })}
      >
        {!flat && (
          <button className={'tree-caret' + (open ? ' open' : '') + (kids.length ? '' : ' leaf')} onClick={(e) => (e.stopPropagation(), toggle())}>
            <ChevronRight size={14} />
          </button>
        )}
        <PageIcon icon={page.icon} size={16} />
        <span className="tree-title">{page.title || t(page.type === 'database' ? 'page.newDatabase' : page.type === 'report' ? 'page.newReport' : 'page.untitled')}</span>
        <div className="tree-actions" onClick={(e) => e.stopPropagation()}>
          <button ref={menuRef} className="icon-btn xs" onClick={() => setMenu(!menu)}><MoreHorizontal size={14} /></button>
          {!flat && (
            <button className="icon-btn xs" onClick={() => { const np = v.createPage({ parentId: page.id }); setOpen(true); localStorage.setItem('tree:' + page.id, '1'); go({ name: 'page', id: np.id }); }}>
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>
      <Popover anchor={menuRef.current} open={menu} onClose={() => setMenu(false)}>
        <div className="menu">
          <button className="menu-item" onClick={() => (v.updatePage(page.id, { favorite: !page.favorite }), setMenu(false))}>
            {page.favorite ? <StarOff size={15} /> : <Star size={15} />} {page.favorite ? t('page.unfavorite') : t('page.favorite')}
          </button>
          <button className="menu-item" onClick={() => { const c = v.duplicatePage(page.id); setMenu(false); if (c) go({ name: 'page', id: c.id }); }}><Copy size={15} /> {t('common.duplicate')}</button>
          <button className="menu-item" onClick={() => (v.movePage(page.id, null), setMenu(false))}><Upload size={15} /> {t('page.moveToRoot')}</button>
          <div className="menu-sep" />
          <button className="menu-item" onClick={() => (v.updatePage(page.id, { archivedAt: Date.now() }), setMenu(false), toast(t('archive.done'), 'success'))}><ArchiveIcon size={15} /> {t('archive.action')}</button>
          <button className="menu-item danger" onClick={() => (v.trashPage(page.id), setMenu(false))}><Trash2 size={15} /> {t('page.trash')}</button>
        </div>
      </Popover>
      {open && kids.map((k) => <TreeItem key={k.id} page={k} depth={depth + 1} />)}
    </div>
  );
}
