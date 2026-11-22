import { useState } from 'react';
import { Database, FileText, Home, LayoutTemplate, Menu, Palette, PieChart, Plus, Search, Sparkles, CalendarHeart, X } from 'lucide-react';
import { useT } from '../i18n';
import { useUi } from '../store/ui';
import { useVault } from '../store/vault';
import { openDaily } from './Journal';
import type { PageType } from '../lib/types';

/** Barra inferior e botão de criação, usados em celulares e tablets em pé. */
export function MobileNav() {
  const t = useT();
  const ui = useUi();
  const [sheet, setSheet] = useState(false);
  const make = (type: PageType) => {
    const p = useVault.getState().createPage({ type });
    setSheet(false);
    ui.go({ name: 'page', id: p.id });
  };
  const Item = ({ on, icon, label, active }: { on: () => void; icon: React.ReactNode; label: string; active?: boolean }) => (
    <button className={'mnav-item' + (active ? ' on' : '')} onClick={on}>
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <>
      <nav className="mnav">
        <Item on={() => ui.go({ name: 'home' })} icon={<Home size={21} />} label={t('nav.home')} active={ui.route.name === 'home'} />
        <Item on={() => ui.set({ palette: true })} icon={<Search size={21} />} label={t('mnav.search')} />
        <button className="mnav-fab" onClick={() => setSheet(true)} aria-label={t('nav.new')}>
          <Plus size={26} />
        </button>
        <Item on={() => ui.set({ aiPanel: true })} icon={<Sparkles size={21} />} label={t('mnav.ai')} active={ui.aiPanel} />
        <Item on={() => ui.set({ mobileNav: true })} icon={<Menu size={21} />} label={t('mnav.menu')} active={ui.mobileNav} />
      </nav>
      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-head">
              <b>{t('nav.new')}</b>
              <button className="icon-btn" onClick={() => setSheet(false)}><X size={18} /></button>
            </div>
            <div className="sheet-grid">
              <button onClick={() => make('page')}><span className="sg-icon v"><FileText size={22} /></span>{t('new.page')}</button>
              <button onClick={() => make('database')}><span className="sg-icon t"><Database size={22} /></span>{t('new.database')}</button>
              <button onClick={() => make('report')}><span className="sg-icon r"><PieChart size={22} /></span>{t('new.report')}</button>
              <button onClick={() => make('canvas')}><span className="sg-icon b"><Palette size={22} /></span>{t('new.canvas')}</button>
              <button onClick={() => (setSheet(false), openDaily())}><span className="sg-icon y"><CalendarHeart size={22} /></span>{t('nav.today')}</button>
              <button onClick={() => (setSheet(false), ui.go({ name: 'templates' }))}><span className="sg-icon g"><LayoutTemplate size={22} /></span>{t('nav.templates')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
