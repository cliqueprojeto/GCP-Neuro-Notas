import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Heart, Menu, Moon, PanelLeftOpen, Sparkles, Sun } from 'lucide-react';
import { useT, useLang, type TKey } from '../i18n';
import { usePrefs, type Lang } from '../store/prefs';
import { useUi } from '../store/ui';
import { useVault, breadcrumb } from '../store/vault';
import { THEMES, getTheme, applyTheme, DEFAULT_CUSTOM, STRUCTURES, type CustomTheme, type Theme } from '../lib/themes';
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
      {!crumbs.length && (
        <div className="topbar-brand show-mobile-flex">
          <img src="/logo.svg" alt="" /> <b>GCP-Neuro Notas</b>
        </div>
      )}
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
  const custom = usePrefs((s) => s.customTheme);
  const set = usePrefs((s) => s.set);
  const [edit, setEdit] = useState(false);
  const c: CustomTheme = { ...DEFAULT_CUSTOM, ...(custom || {}) };
  const setC = (patch: Partial<CustomTheme>) => { set({ customTheme: { ...c, ...patch }, theme: 'custom' }); applyTheme('custom'); };
  const chip = (th: Theme) => (
    <button key={th.id} className={'theme-chip' + (theme === th.id ? ' on' : '')} onClick={() => (set({ theme: th.id }), onPick?.())} title={th.structure ? t(`theme.struct.${th.structure}` as TKey) : undefined}>
      <span className={'theme-swatch' + (th.premium ? ' premium' : '')} style={{ background: th.vars['--app-bg'] || th.vars['--bg'] }}>
        <i style={{ background: th.vars['--sidebar'] }} />
        <b style={{ background: `linear-gradient(135deg, ${th.vars['--accent']}, ${th.vars['--accent-2']})` }} />
      </span>
      <span className="ellipsis">{th.name}</span>
      {theme === th.id && <Check size={13} />}
    </button>
  );
  const groups: [string, Theme[]][] = [
    [t('theme.premiumDark'), THEMES.filter((x) => x.premium && x.dark)],
    [t('theme.premiumLight'), THEMES.filter((x) => x.premium && !x.dark)],
    [t('theme.dark'), THEMES.filter((x) => !x.premium && x.dark)],
    [t('theme.light'), THEMES.filter((x) => !x.premium && !x.dark)],
  ];
  return (
    <div className={'theme-grid' + (large ? ' large' : '')}>
      {groups.map(([label, list]) => (
        <div key={label}>
          <div className="section-label">{label}</div>
          <div className="theme-row">{list.map(chip)}</div>
        </div>
      ))}
      <div className="row gap-sm">
        <button className={'theme-chip system' + (theme === 'system' ? ' on' : '')} onClick={() => (set({ theme: 'system' }), onPick?.())}>
          <span className="theme-swatch split" /> <span>{t('theme.system')}</span>
        </button>
        <button className={'theme-chip system' + (theme === 'custom' ? ' on' : '')} onClick={() => { setEdit(!edit); if (theme !== 'custom') setC({}); }}>
          <span className="theme-swatch premium" style={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent2})` }} /> <span>{t('theme.custom')}</span>
        </button>
      </div>
      {(edit || (large && theme === 'custom')) && (
        <div className="custom-theme">
          <label>{t('theme.base')}
            <div className="seg sm">
              <button className={c.dark ? 'on' : ''} onClick={() => setC({ dark: true, bg: '#0f1226', panel: '#171b38', text: '#eef0ff' })}>{t('theme.dark')}</button>
              <button className={!c.dark ? 'on' : ''} onClick={() => setC({ dark: false, bg: '#f6f7fb', panel: '#ffffff', text: '#161a2e' })}>{t('theme.light')}</button>
            </div>
          </label>
          {([['bg', 'theme.c.bg'], ['panel', 'theme.c.panel'], ['text', 'theme.c.text'], ['accent', 'theme.c.accent'], ['accent2', 'theme.c.accent2']] as const).map(([k, key]) => (
            <label key={k}>{t(key)}
              <span className="color-row"><input type="color" value={c[k]} onChange={(e) => setC({ [k]: e.target.value } as any)} /> <code className="small">{c[k]}</code></span>
            </label>
          ))}
          <label>{t('theme.radius')} · {c.radius}px
            <input type="range" min={2} max={26} value={c.radius} onChange={(e) => setC({ radius: +e.target.value })} />
          </label>
          <div className="struct-row">
            {STRUCTURES.map((st) => <button key={st} className={c.structure === st ? 'on' : ''} onClick={() => setC({ structure: st })}>{t(`theme.struct.${st}` as TKey)}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}
