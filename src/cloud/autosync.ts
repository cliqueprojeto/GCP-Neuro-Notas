/**
 * Sincronização automática: mantém os aparelhos conectados à mesma conta espelhados.
 *
 * - Ao abrir/desbloquear o app, ao voltar para ele e ao reconectar à internet: busca novidades.
 * - Depois de cada alteração local: envia em poucos segundos.
 * - Enquanto o app está aberto: confere a nuvem a cada 30 s (só metadados; baixa se mudou).
 * - Ao sair do app (Android/iOS em segundo plano): envia o que estiver pendente.
 */
import { create } from 'zustand';
import { useVault, localChanges } from '../store/vault';
import { syncNow, VaultMismatchError, type CloudProvider } from './cloud';

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'ok' | 'error' | 'offline' | 'mismatch';

interface SyncState {
  status: SyncStatus;
  error?: string;
  lastAt?: number;
  lastPulled: number;
}

export const useSync = create<SyncState>(() => ({ status: 'off', lastPulled: 0 }));

const PUSH_DELAY = 4000;
const POLL_MS = 30_000;

const known: Partial<Record<CloudProvider, number>> = {};
let syncedRev = -1;
let running: Promise<void> | null = null;
let again = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let failures = 0;
let nextTryAt = 0;

function enabledAccounts() {
  const v = useVault.getState();
  if (v.status !== 'unlocked') return [];
  if (v.settings.cloud.autoSync === false) return [];
  return v.settings.cloud.accounts;
}

/** Roda uma sincronização agora (junta pedidos que chegam durante uma em andamento). */
export function syncSoon(force = false): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  if (!force && Date.now() < nextTryAt) return Promise.resolve();
  running = (async () => {
    do {
      again = false;
      await runOnce(force);
      force = false;
    } while (again);
  })().finally(() => (running = null));
  return running;
}

async function runOnce(force: boolean) {
  const accounts = enabledAccounts();
  if (!accounts.length) {
    useSync.setState({ status: 'off' });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSync.setState({ status: 'offline' });
    return;
  }
  useSync.setState({ status: 'syncing', error: undefined });
  const rev = localChanges.rev;
  const localChanged = rev !== syncedRev;
  let pulled = 0;
  try {
    await useVault.getState().flush();
    for (const a of accounts) {
      const r = await syncNow(a.provider, { known: force ? undefined : known[a.provider], localChanged: localChanged || force });
      known[a.provider] = r.remoteModified;
      pulled += r.pulled;
    }
    syncedRev = rev;
    failures = 0;
    nextTryAt = 0;
    useSync.setState({ status: 'ok', lastAt: Date.now(), lastPulled: pulled });
  } catch (e) {
    failures++;
    // Espera crescente entre tentativas que falham (até 5 min).
    nextTryAt = Date.now() + Math.min(5 * 60_000, 2 ** Math.min(failures, 8) * 1000);
    if (e instanceof VaultMismatchError) useSync.setState({ status: 'mismatch', error: 'vault-mismatch' });
    else {
      const msg = String((e as Error)?.message || e);
      const offline = /network|fetch|connect|dns|timed? ?out|offline/i.test(msg);
      useSync.setState({ status: offline ? 'offline' : 'error', error: msg });
    }
  }
}

function onLocalChange() {
  if (!enabledAccounts().length) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void syncSoon(), PUSH_DELAY);
}

function onVisibility() {
  if (document.visibilityState === 'visible') void syncSoon();
  else if (localChanges.rev !== syncedRev) {
    if (pushTimer) clearTimeout(pushTimer);
    void syncSoon(); // vai para segundo plano: envia o que falta
  }
}
const onOnline = () => ((nextTryAt = 0), void syncSoon());

/** Liga o motor (chamado quando o cofre é aberto). Devolve a função que desliga. */
export function startAutoSync() {
  stopAutoSync();
  syncedRev = -1;
  for (const k of Object.keys(known)) delete known[k as CloudProvider];
  localChanges.listeners.add(onLocalChange);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onFocus);
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void syncSoon();
  }, POLL_MS);
  const first = setTimeout(() => void syncSoon(), 2500);
  return () => (clearTimeout(first), stopAutoSync());
}

let lastFocus = 0;
function onFocus() {
  // Voltar para a janela no computador: confere se outro aparelho mudou algo.
  if (Date.now() - lastFocus < 10_000) return;
  lastFocus = Date.now();
  void syncSoon();
}

export function stopAutoSync() {
  localChanges.listeners.delete(onLocalChange);
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('focus', onFocus);
  if (pollTimer) clearInterval(pollTimer);
  if (pushTimer) clearTimeout(pushTimer);
  pollTimer = pushTimer = null;
  useSync.setState({ status: 'off' });
}
