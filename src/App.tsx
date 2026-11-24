import { PromptHost } from './components/PromptHost';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CalendarHub } from './components/CalendarHub';
import { Boards } from './components/Boards';
import { Presentations } from './components/Presentations';
import { useEffect, useState } from 'react';
import { useVault } from './store/vault';
import { usePrefs } from './store/prefs';
import { useUi, toast } from './store/ui';
import { isTauri, isMobile } from './lib/platform';
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
import { startAutoSync, guardClose, hasPendingSync } from './cloud/autosync';
import { askConfirm } from './components/PromptHost';
import { systemNotify } from './lib/alerts';
import { t as tr0 } from './i18n';

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

  // Sincronização automática entre aparelhos (enquanto o cofre está aberto).
  useEffect(() => startAutoSync(), []);
  useEffect(() => installCloseGuard(), []);

  // Atualizações e backup automático.
  useEffect(() => {
    // Procura versão nova ao abrir, ao voltar para o app (no Android ele fica aberto em segundo
    // plano por horas) e a cada 3 h — sempre trocando pela versão mais recente publicada.
    const check = (resume = false) => {
      if (!isCheckDue(resume ? 3600_000 : 0)) return;
      void checkForUpdate().then((r) => {
        if (r.status === 'available' && r.release.version !== usePrefs.getState().skippedVersion) setUpdate(r.release);
      });
    };
    check();
    const onVis = () => document.visibilityState === 'visible' && check(true);
    document.addEventListener('visibilitychange', onVis);
    const every = setInterval(() => check(true), 3 * 3600_000);
    const t = setTimeout(() => void autoBackupIfDue(), 8000);
    const onAvail = (e: Event) => setUpdate((e as CustomEvent).detail);
    const onOpen = (e: Event) => (setUpdate((e as CustomEvent).detail), setShowUpdate(true));
    window.addEventListener('gcp-update', onAvail);
    window.addEventListener('gcp-update-open', onOpen);
    return () => (clearTimeout(t), clearInterval(every), document.removeEventListener('visibilitychange', onVis), window.removeEventListener('gcp-update', onAvail), window.removeEventListener('gcp-update-open', onOpen));
  }, []);

  return (
    <div className={'app' + (collapsed ? ' collapsed' : '') + (ui.mobileNav ? ' mobile-open' : '') + (ui.aiPanel ? ' with-ai' : '')}>
      <div className="mobile-scrim" onClick={() => ui.set({ mobileNav: false })} />
      <Sidebar />
      <main className="main">
        <Topbar update={update} onUpdate={() => setShowUpdate(true)} />
        <div className="content" key={JSON.stringify(route)}>
          <ErrorBoundary>
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
          </ErrorBoundary>
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

/**
 * Ao fechar: com alterações ainda não enviadas à nuvem, sincroniza antes e avisa.
 * No computador intercepta o fechamento da janela; no navegador usa o aviso padrão.
 */
function installCloseGuard(): () => void {
  const tr = (k: string) => tr0(k as any);
  const notify = () => {
    toast(tr('sync.closing'), 'info');
    void systemNotify('GCP-Neuro Notas', tr('sync.closing'));
  };
  const ask = () => askConfirm({ title: tr('sync.closeTitle'), message: tr('sync.closeText'), okLabel: tr('sync.closeAnyway'), cancelLabel: tr('sync.keepOpen'), danger: true });
  if (isTauri && !isMobile) {
    let off: (() => void) | null = null;
    let alive = true;
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      const un = await w.onCloseRequested(async (e) => {
        if (!hasPendingSync()) return;
        e.preventDefault();
        if (await guardClose(ask, notify)) await w.destroy();
      });
      if (alive) off = un;
      else un();
    });
    return () => ((alive = false), off?.());
  }
  const h = (e: BeforeUnloadEvent) => {
    if (!hasPendingSync()) return;
    void guardClose(async () => true, () => {});
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', h);
  return () => window.removeEventListener('beforeunload', h);
}
