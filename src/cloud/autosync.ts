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
  /** Há alterações locais ainda não enviadas. */
  pending: boolean;
  /** Quando o próximo envio automático deve acontecer. */
  nextAt?: number;
}

export const useSync = create<SyncState>(() => ({ status: 'off', lastPulled: 0, pending: false }));

export const SYNC_DELAYS = [5, 30, 60, 300, 900, 0] as const;
/** Espera depois de editar antes de enviar (ms). 0 = só manual, ao sair do app ou ao fechar. */
function pushDelay(): number {
  const d = useVault.getState().settings.cloud.syncDelay;
  return (d ?? 30) * 1000;
}
/** Conferir novidades da nuvem: a cada 30 s, ou no ritmo do envio se for mais espaçado. */
function pollMs(): number {
  const d = pushDelay();
  return d === 0 ? 120_000 : Math.max(30_000, d);
}
let lastPoll = 0;
export function hasPendingSync(): boolean {
  return enabledAccounts().length > 0 && localChanges.rev !== syncedRev;
}

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
    lastPoll = Date.now();
    useSync.setState({ status: 'ok', lastAt: Date.now(), lastPulled: pulled, pending: localChanges.rev !== syncedRev, nextAt: undefined });
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
  const d = pushDelay();
  // Junta várias edições num envio só (o envio leva o cofre inteiro, então espaçar alivia o app).
  if (d === 0) {
    if (!useSync.getState().pending) useSync.setState({ pending: true, nextAt: undefined });
    return;
  }
  if (pushTimer) return; // já há um envio agendado: as novas edições vão junto
  const at = Date.now() + d;
  useSync.setState({ pending: true, nextAt: at });
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncSoon();
  }, d);
}

function onVisibility() {
  if (document.visibilityState === 'visible') void syncSoon();
  else if (localChanges.rev !== syncedRev) {
    if (pushTimer) (clearTimeout(pushTimer), (pushTimer = null));
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
    if (document.visibilityState !== 'visible' || Date.now() - lastPoll < pollMs()) return;
    lastPoll = Date.now();
    void syncSoon();
  }, 10_000);
  const first = setTimeout(() => void syncSoon(), 2500);
  return () => (clearTimeout(first), stopAutoSync());
}

let lastFocus = 0;
function onFocus() {
  // Voltar para a janela no computador: confere se outro aparelho mudou algo.
  if (Date.now() - lastFocus < Math.min(60_000, pollMs())) return;
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
  useSync.setState({ status: 'off', pending: false, nextAt: undefined });
}

/**
 * Antes de fechar o app no computador: se houver alterações não enviadas, sincroniza primeiro
 * e avisa. Se não conseguir, pergunta se pode fechar mesmo assim.
 */
export async function guardClose(ask: () => Promise<boolean>, notify: () => void): Promise<boolean> {
  await useVault.getState().flush().catch(() => {});
  if (!hasPendingSync()) return true;
  notify();
  if (pushTimer) (clearTimeout(pushTimer), (pushTimer = null));
  await Promise.race([syncSoon(true), new Promise((r) => setTimeout(r, 25_000))]);
  if (!hasPendingSync()) return true;
  return ask();
}
