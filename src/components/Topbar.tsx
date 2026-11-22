import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Heart, Menu, Moon, PanelLeftOpen, Sparkles, Sun } from 'lucide-react';
import { useT, useLang } from '../i18n';
import { usePrefs, type Lang } from '../store/prefs';
import { useUi } from '../store/ui';
import { useVault, breadcrumb } from '../store/vault';
import { THEMES, getTheme } from '../lib/themes';
import { PageIcon, Popover } from './ui';
import type { ReleaseInfo } from '../lib/updater';

export function Topbar({ update, onUpdate }: { update: ReleaseInfo | null; onUpdate: () => void }) {
  const t = useT();
  const lang = useLang();
  const prefs = usePrefs();
  const ui = useUi();
  const pages = useVault((s) => s.pages);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLButtonElement>(null);
  const crumbs = ui.route.name === 'page' ? breadcrumb(pages, ui.route.id) : [];
  const dark = getTheme(prefs.theme).dark;

  return (
    <header className="topbar">
      <button className="icon-btn show-mobile" onClick={() => ui.set({ mobileNav: true })}><Menu size={19} /></button>
      {prefs.sidebarCollapsed && (
        <button className="icon-btn hide-mobile" onClick={() => prefs.set({ sidebarCollapsed: false })} title={t('nav.expand')}><PanelLeftOpen size={18} /></button>
      )}
      <button className="icon-btn hide-mobile" onClick={ui.back} disabled={!ui.history.length}><ArrowLeft size={17} /></button>
      <button className="icon-btn hide-mobile" onClick={ui.forward} disabled={!ui.future.length}><ArrowRight size={17} /></button>
      <div className="crumbs">
        {crumbs.map((p, i) => (
          <span key={p.id} className="crumb">
            {i > 0 && <span className="crumb-sep">/</span>}
            <button onClick={() => ui.go({ name: 'page', id: p.id })}>
              <PageIcon icon={p.icon} size={14} /> <span>{p.title || t('page.untitled')}</span>
            </button>
          </span>
        ))}
      </div>
      <div className="grow" />
      {update && (
        <button className="btn update sm" onClick={onUpdate}>
          <Download size={15} /> {t('update.button', { v: update.version })}
        </button>
      )}
      <button className="btn ai sm hide-mobile" onClick={() => ui.set({ aiPanel: !ui.aiPanel })}>
        <Sparkles size={15} /> {t('nav.askAi')}
      </button>
      <div className="lang-seg">
        {(['pt', 'en', 'es'] as Lang[]).map((l) => (
          <button key={l} className={lang === l ? 'on' : ''} onClick={() => prefs.set({ lang: l })}>{l.toUpperCase()}</button>
        ))}
      </div>
      <button ref={themeRef} className="icon-btn boxed" onClick={() => setThemeOpen(!themeOpen)} title={t('settings.theme')}>
        {dark ? <Moon size={17} /> : <Sun size={17} />}
      </button>
      <Popover anchor={themeRef.current} open={themeOpen} onClose={() => setThemeOpen(false)} align="right">
        <ThemeGrid onPick={() => setThemeOpen(false)} />
      </Popover>
      <button className="icon-btn boxed heart" onClick={() => ui.go({ name: 'support' })} title={t('nav.support')}>
        <Heart size={17} />
      </button>
    </header>
  );
}

export function ThemeGrid({ onPick, large }: { onPick?: () => void; large?: boolean }) {
  const t = useT();
  const theme = usePrefs((s) => s.theme);
  const set = usePrefs((s) => s.set);
  const group = (dark: boolean) => THEMES.filter((x) => x.dark === dark);
  return (
    <div className={'theme-grid' + (large ? ' large' : '')}>
      {[true, false].map((dark) => (
        <div key={String(dark)}>
          <div className="section-label">{dark ? t('theme.dark') : t('theme.light')}</div>
          <div className="theme-row">
            {group(dark).map((th) => (
              <button key={th.id} className={'theme-chip' + (theme === th.id ? ' on' : '')} onClick={() => (set({ theme: th.id }), onPick?.())}>
                <span className="theme-swatch" style={{ background: th.vars['--bg'] }}>
                  <i style={{ background: th.vars['--sidebar'] }} />
                  <b style={{ background: `linear-gradient(135deg, ${th.vars['--accent']}, ${th.vars['--accent-2']})` }} />
                </span>
                <span>{th.name}</span>
                {theme === th.id && <Check size={13} />}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button className={'theme-chip system' + (theme === 'system' ? ' on' : '')} onClick={() => (set({ theme: 'system' }), onPick?.())}>
        <span className="theme-swatch split" /> <span>{t('theme.system')}</span>
      </button>
    </div>
  );
}
