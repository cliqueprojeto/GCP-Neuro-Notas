import { PromptHost } from './components/PromptHost';
import { CalendarHub } from './components/CalendarHub';
import { Boards } from './components/Boards';
import { Presentations } from './components/Presentations';
import { useEffect, useState } from 'react';
import { useVault } from './store/vault';
import { usePrefs } from './store/prefs';
import { useUi } from './store/ui';
import { applyTheme } from './lib/themes';
import { useAlertScheduler } from './components/Notifications';
import { useLang } from './i18n';
import { LoginScreen, Wizard } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Home } from './components/Home';
import { PageView } from './components/PageView';
import { Graph } from './components/Graph';
import { Settings } from './components/settings/Settings';
import { About, Support, Tasks, Templates, Trash, Archive } from './components/Views';
import { AIPanel, CommandPalette, Toasts, UpdateDialog } from './components/Overlays';
import { Spinner } from './components/ui';
import { MobileNav } from './components/MobileNav';
import { checkForUpdate, isCheckDue, type ReleaseInfo } from './lib/updater';
import { autoBackupIfDue } from './cloud/cloud';

export default function App() {
  const status = useVault((s) => s.status);
  const pageCount = useVault((s) => Object.keys(s.pages).length);
  const theme = usePrefs((s) => s.theme);
  useAlertScheduler();
  const lang = useLang();
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('gcp-notas:onboarded') === '1');

  useEffect(() => void useVault.getState().init(), []);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const f = () => applyTheme('system');
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  }, [lang]);
  useEffect(() => {
    const f = () => setOnboarded(true);
    window.addEventListener('gcp-onboarded', f);
    return () => window.removeEventListener('gcp-onboarded', f);
  }, []);

  if (status === 'loading')
    return (
      <div className="boot">
        <img src="/logo.svg" alt="" />
        <Spinner size={22} />
      </div>
    );
  const needWizard = status === 'new' || (status === 'unlocked' && !onboarded && pageCount === 0);
  if (needWizard) return (<><Wizard /><Toasts /><PromptHost /></>);
  if (status === 'locked') return (<><LoginScreen /><Toasts /><PromptHost /></>);
  return <Workspace />;
}

function Workspace() {
  const route = useUi((s) => s.route);
  const ui = useUi();
  const collapsed = usePrefs((s) => s.sidebarCollapsed);
  const autoLock = useVault((s) => s.settings.security.autoLockMinutes);
  const [update, setUpdate] = useState<ReleaseInfo | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  // Atalhos globais.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') e.preventDefault(), ui.set({ palette: !useUi.getState().palette });
      if (mod && e.key.toLowerCase() === 'p') e.preventDefault(), ui.set({ palette: true });
      if (mod && e.key.toLowerCase() === 'j') e.preventDefault(), ui.set({ aiPanel: !useUi.getState().aiPanel });
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') e.preventDefault(), useVault.getState().lock();
      if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        const p = useVault.getState().createPage({});
        ui.go({ name: 'page', id: p.id });
      }
      if (e.altKey && e.key === 'ArrowLeft') ui.back();
      if (e.altKey && e.key === 'ArrowRight') ui.forward();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bloqueio automático por inatividade.
  useEffect(() => {
    if (!autoLock) return;
    let last = Date.now();
    const bump = () => (last = Date.now());
    const evs = ['mousemove', 'keydown', 'pointerdown', 'wheel', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const i = setInterval(() => Date.now() - last > autoLock * 60_000 && useVault.getState().lock(), 15_000);
    return () => (evs.forEach((e) => window.removeEventListener(e, bump)), clearInterval(i));
  }, [autoLock]);

  // Atualizações e backup automático.
  useEffect(() => {
    if (isCheckDue())
      void checkForUpdate().then((r) => {
        if (r.status === 'available' && r.release.version !== usePrefs.getState().skippedVersion) setUpdate(r.release);
      });
    const t = setTimeout(() => void autoBackupIfDue(), 8000);
    const onAvail = (e: Event) => setUpdate((e as CustomEvent).detail);
    const onOpen = (e: Event) => (setUpdate((e as CustomEvent).detail), setShowUpdate(true));
    window.addEventListener('gcp-update', onAvail);
    window.addEventListener('gcp-update-open', onOpen);
    return () => (clearTimeout(t), window.removeEventListener('gcp-update', onAvail), window.removeEventListener('gcp-update-open', onOpen));
  }, []);

  return (
    <div className={'app' + (collapsed ? ' collapsed' : '') + (ui.mobileNav ? ' mobile-open' : '') + (ui.aiPanel ? ' with-ai' : '')}>
      <div className="mobile-scrim" onClick={() => ui.set({ mobileNav: false })} />
      <Sidebar />
      <main className="main">
        <Topbar update={update} onUpdate={() => setShowUpdate(true)} />
        <div className="content" key={JSON.stringify(route)}>
          {route.name === 'home' && <Home />}
          {route.name === 'page' && <PageView id={route.id} />}
          {route.name === 'graph' && <Graph />}
          {route.name === 'calendar' && <CalendarHub date={route.date} mode={route.mode} />}
          {route.name === 'boards' && <Boards />}
          {route.name === 'presentations' && <Presentations />}
          {route.name === 'templates' && <Templates />}
          {route.name === 'trash' && <Trash />}
          {route.name === 'archive' && <Archive />}
          {route.name === 'tasks' && <Tasks />}
          {route.name === 'settings' && <Settings tab={route.tab} />}
          {route.name === 'support' && <Support />}
          {route.name === 'about' && <About />}
        </div>
      </main>
      <MobileNav />
      <AIPanel />
      <CommandPalette />
      <PromptHost />
      <Toasts />
      {showUpdate && update && <UpdateDialog release={update} onClose={() => setShowUpdate(false)} />}
    </div>
  );
}
