/**
 * Backup e sincronização criptografados no Google Drive e no OneDrive.
 *
 * Os arquivos enviados contêm somente registros já cifrados pela chave do
 * cofre, mais o cabeçalho que exige a senha para abrir. Os provedores nunca
 * recebem conteúdo legível.
 */
import { invoke } from '@tauri-apps/api/core';
import { open as openSealed } from '../lib/crypto';
import { isTauri, netFetch, openUrl, APP_VERSION, type DbRecord } from '../lib/platform';
import type { CloudAccount } from '../lib/types';
import type { VaultHeader } from '../lib/crypto';
import { useVault } from '../store/vault';

export type CloudProvider = 'gdrive' | 'onedrive';

export const CLOUD_NAMES: Record<CloudProvider, string> = { gdrive: 'Google Drive', onedrive: 'OneDrive' };

// IDs públicos de cliente OAuth podem vir do build (variáveis do GitHub Actions)
// ou ser informados em Configurações → Nuvem.
const ENV = import.meta.env as Record<string, string | undefined>;

export function clientConfig(provider: CloudProvider) {
  const s = useVault.getState().settings.cloud;
  if (provider === 'gdrive') {
    return {
      clientId: s.googleClientId || ENV.VITE_GOOGLE_CLIENT_ID || '',
      clientSecret: s.googleClientSecret || ENV.VITE_GOOGLE_CLIENT_SECRET || '',
    };
  }
  return { clientId: s.microsoftClientId || ENV.VITE_MICROSOFT_CLIENT_ID || '', clientSecret: '' };
}

export interface CloudSnapshot {
  format: 'gcp-notas-cloud';
  version: 1;
  app: string;
  device: string;
  created: number;
  header: VaultHeader;
  records: DbRecord[];
}

export interface CloudFile {
  id: string;
  name: string;
  size: number;
  modified: number;
}

const SYNC_NAME = 'GCP-Notas-sync.gcpcloud';

// ------------------------------------------------------------------ OAuth

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  b.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

const ENDPOINTS = {
  gdrive: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email https://www.googleapis.com/auth/drive.appdata',
    host: '127.0.0.1',
  },
  onedrive: {
    auth: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'offline_access User.Read Files.ReadWrite.AppFolder',
    host: 'localhost',
  },
};

async function tokenRequest(provider: CloudProvider, params: Record<string, string>) {
  const res = await netFetch(ENDPOINTS[provider].token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
  return data as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string };
}

export async function connect(provider: CloudProvider): Promise<CloudAccount> {
  if (!isTauri) throw new Error('desktop-only');
  const { clientId, clientSecret } = clientConfig(provider);
  if (!clientId) throw new Error('missing-client-id');
  const ep = ENDPOINTS[provider];
  const port = await invoke<number>('oauth_start');
  const redirect = `http://${ep.host}:${port}`;
  const { verifier, challenge } = await pkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: ep.scope,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });
  if (provider === 'gdrive') {
    q.set('access_type', 'offline');
    q.set('prompt', 'consent');
  } else {
    q.set('prompt', 'select_account');
  }
  await openUrl(`${ep.auth}?${q}`);

  let url: string | null = null;
  const deadline = Date.now() + 5 * 60_000;
  while (!url && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    url = await invoke<string | null>('oauth_result', { port });
  }
  if (!url) throw new Error('timeout');
  const params = new URL(url).searchParams;
  if (params.get('error')) throw new Error(params.get('error_description') || params.get('error')!);
  if (params.get('state') !== state) throw new Error('state-mismatch');
  const code = params.get('code');
  if (!code) throw new Error('no-code');

  const body: Record<string, string> = {
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: redirect,
    grant_type: 'authorization_code',
  };
  if (clientSecret) body.client_secret = clientSecret;
  if (provider === 'onedrive') body.scope = ep.scope;
  const tok = await tokenRequest(provider, body);
  const account: CloudAccount = {
    provider,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + (tok.expires_in - 60) * 1000,
    connectedAt: Date.now(),
  };
  try {
    if (provider === 'gdrive' && tok.id_token) {
      const payload = JSON.parse(atob(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      account.email = payload.email;
    } else if (provider === 'onedrive') {
      const me = await (await netFetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${account.accessToken}` } })).json();
      account.email = me.mail || me.userPrincipalName;
    }
  } catch {
    /* e-mail é só informativo */
  }
  saveAccount(account);
  return account;
}

function saveAccount(a: CloudAccount) {
  useVault.getState().updateSettings((s) => {
    s.cloud.accounts = [...s.cloud.accounts.filter((x) => x.provider !== a.provider), a];
    return s;
  });
}

export function disconnect(provider: CloudProvider) {
  useVault.getState().updateSettings((s) => {
    s.cloud.accounts = s.cloud.accounts.filter((x) => x.provider !== provider);
    return s;
  });
}

async function token(provider: CloudProvider): Promise<string> {
  const acc = useVault.getState().settings.cloud.accounts.find((a) => a.provider === provider);
  if (!acc) throw new Error('not-connected');
  if (Date.now() < acc.expiresAt) return acc.accessToken;
  if (!acc.refreshToken) throw new Error('expired');
  const { clientId, clientSecret } = clientConfig(provider);
  const body: Record<string, string> = { client_id: clientId, refresh_token: acc.refreshToken, grant_type: 'refresh_token' };
  if (clientSecret) body.client_secret = clientSecret;
  if (provider === 'onedrive') body.scope = ENDPOINTS.onedrive.scope;
  const tok = await tokenRequest(provider, body);
  const next = { ...acc, accessToken: tok.access_token, refreshToken: tok.refresh_token || acc.refreshToken, expiresAt: Date.now() + (tok.expires_in - 60) * 1000 };
  saveAccount(next);
  return next.accessToken;
}

async function api(provider: CloudProvider, url: string, init: RequestInit = {}) {
  const t = await token(provider);
  const res = await netFetch(url, { ...init, headers: { ...(init.headers as any), Authorization: `Bearer ${t}` } });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${CLOUD_NAMES[provider]} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res;
}

// ------------------------------------------------------- operações de arquivo

const GD = 'https://www.googleapis.com/drive/v3';
const GDU = 'https://www.googleapis.com/upload/drive/v3';
const MS = 'https://graph.microsoft.com/v1.0/me/drive';

export async function listFiles(provider: CloudProvider): Promise<CloudFile[]> {
  if (provider === 'gdrive') {
    const q = new URLSearchParams({ spaces: 'appDataFolder', fields: 'files(id,name,size,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '200' });
    const data = await (await api(provider, `${GD}/files?${q}`)).json();
    return (data.files || []).map((f: any) => ({ id: f.id, name: f.name, size: +f.size || 0, modified: Date.parse(f.modifiedTime) }));
  }
  const res = await api(provider, `${MS}/special/approot/children?$select=id,name,size,lastModifiedDateTime&$top=200`);
  if (res.status === 404) return [];
  const data = await res.json();
  return (data.value || [])
    .map((f: any) => ({ id: f.id, name: f.name, size: f.size || 0, modified: Date.parse(f.lastModifiedDateTime) }))
    .sort((a: CloudFile, b: CloudFile) => b.modified - a.modified);
}

async function upload(provider: CloudProvider, name: string, content: string, existingId?: string): Promise<number | undefined> {
  if (provider === 'gdrive') {
    if (existingId) {
      const r = await api(provider, `${GDU}/files/${existingId}?uploadType=media&fields=id,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content });
      return modTime(await r.json().catch(() => null));
    }
    const boundary = 'gcpnotas' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name, parents: ['appDataFolder'] });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const r = await api(provider, `${GDU}/files?uploadType=multipart&fields=id,modifiedTime`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    return modTime(await r.json().catch(() => null));
  }
  const bytes = new TextEncoder().encode(content);
  const path = `${MS}/special/approot:/${encodeURIComponent(name)}:`;
  if (bytes.length < 4 * 1024 * 1024) {
    const r = await api(provider, `${path}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
    return modTime(await r.json().catch(() => null));
  }
  // Arquivos grandes: sessão de upload em partes (múltiplos de 320 KiB).
  const sess = await (
    await api(provider, `${path}/createUploadSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    })
  ).json();
  const chunk = 320 * 1024 * 10;
  let last: number | undefined;
  for (let i = 0; i < bytes.length; i += chunk) {
    const part = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    const res = await netFetch(sess.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes ${i}-${i + part.length - 1}/${bytes.length}` },
      body: part,
    });
    if (!res.ok && res.status !== 202) throw new Error(`OneDrive upload ${res.status}`);
    if (res.status === 200 || res.status === 201) last = modTime(await res.json().catch(() => null));
  }
  return last;
}

function modTime(j: any): number | undefined {
  const v = j?.modifiedTime || j?.lastModifiedDateTime;
  return v ? Date.parse(v) : undefined;
}

export async function download(provider: CloudProvider, id: string): Promise<string> {
  const url = provider === 'gdrive' ? `${GD}/files/${id}?alt=media` : `${MS}/items/${id}/content`;
  return (await api(provider, url)).text();
}

export async function removeFile(provider: CloudProvider, id: string) {
  const url = provider === 'gdrive' ? `${GD}/files/${id}` : `${MS}/items/${id}`;
  await api(provider, url, { method: 'DELETE' });
}

// --------------------------------------------------------- backup e sync

function deviceName() {
  const ua = navigator.userAgent;
  return /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Linux';
}

async function snapshot(): Promise<CloudSnapshot> {
  const v = useVault.getState();
  const records = await v.rawRecords();
  return {
    format: 'gcp-notas-cloud',
    version: 1,
    app: APP_VERSION,
    device: deviceName(),
    created: Date.now(),
    header: v.header!,
    records,
  };
}

function stamp() {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}`;
}

export async function backupNow(provider: CloudProvider) {
  const snap = await snapshot();
  await upload(provider, `GCP-Notas-backup-${stamp()}.gcpcloud`, JSON.stringify(snap));
  const keep = useVault.getState().settings.cloud.keep || 10;
  const files = (await listFiles(provider)).filter((f) => f.name.startsWith('GCP-Notas-backup-'));
  for (const f of files.slice(keep)) await removeFile(provider, f.id).catch(() => undefined);
  useVault.getState().updateSettings((s) => {
    s.cloud.lastBackup = Date.now();
    return s;
  });
}

export function parseSnapshot(text: string): CloudSnapshot {
  const s = JSON.parse(text);
  if (s.format !== 'gcp-notas-cloud') throw new Error('invalid-format');
  return s;
}

/**
 * Restaura um backup da nuvem, substituindo os dados locais.
 * Se o backup é do mesmo cofre que está aberto, não pede senha e mantém a senha de login atual.
 * Num aparelho novo, a senha é a mesma usada para entrar no cofre de origem.
 */
export async function restoreFromCloud(provider: CloudProvider, id: string, password?: string): Promise<boolean> {
  const snap = parseSnapshot(await download(provider, id));
  const v = useVault.getState();
  const cloud = v.settings.cloud;
  if (v.status === 'unlocked' && sameVault(snap)) return v.replaceRecords(snap.records);
  if (!password) return false;
  const ok = await v.adoptVault(snap.header, snap.records, password);
  if (ok) {
    // Mantém as contas de nuvem (e os IDs de cliente já informados) deste aparelho.
    useVault.getState().updateSettings((s) => {
      s.cloud.accounts = cloud.accounts;
      if (cloud.googleClientId) (s.cloud.googleClientId = cloud.googleClientId), (s.cloud.googleClientSecret = cloud.googleClientSecret);
      if (cloud.microsoftClientId) s.cloud.microsoftClientId = cloud.microsoftClientId;
      return s;
    });
  }
  return ok;
}

/** O arquivo da nuvem foi cifrado com a mesma chave do cofre aberto? */
export function sameVault(snap: CloudSnapshot) {
  const key = useVault.getState().key;
  if (!key) return false;
  const sample = snap.records.find((r) => r.kind === 'page' || r.kind === 'settings');
  if (!sample) return snap.header.salt === useVault.getState().header?.salt;
  try {
    openSealed(key, sample.data);
    return true;
  } catch {
    return false;
  }
}

/** Baixa só o necessário para saber se um arquivo da nuvem é deste cofre. */
export async function isSameVaultFile(provider: CloudProvider, id: string) {
  return sameVault(parseSnapshot(await download(provider, id)));
}

export class VaultMismatchError extends Error {
  constructor(public snap: CloudSnapshot) {
    super('vault-mismatch');
  }
}

export interface SyncResult {
  pulled: number;
  pushed: boolean;
  remoteModified?: number;
}

/**
 * Sincroniza: baixa o arquivo de sincronização (se mudou desde `known`), junta página a página
 * (a versão mais recente vence) e envia de volta só se este aparelho tiver algo novo.
 */
export async function syncNow(provider: CloudProvider, opts: { known?: number; localChanged?: boolean } = {}): Promise<SyncResult> {
  const files = await listFiles(provider);
  const existing = files.find((f) => f.name === SYNC_NAME);
  let pulled = 0;
  let ahead = !existing || opts.known === undefined || !!opts.localChanged;
  if (existing && existing.modified !== opts.known) {
    const remote = parseSnapshot(await download(provider, existing.id));
    if (!sameVault(remote)) throw new VaultMismatchError(remote);
    const r = await useVault.getState().mergeRawRecords(remote.records);
    pulled = r.pulled;
    ahead = r.ahead || !!opts.localChanged;
  }
  let remoteModified = existing?.modified;
  if (ahead) {
    const snap = await snapshot();
    remoteModified = (await upload(provider, SYNC_NAME, JSON.stringify(snap), provider === 'gdrive' ? existing?.id : undefined)) ?? Date.now();
  }
  if (ahead || pulled || opts.known === undefined) {
    useVault.getState().updateSettings((s) => {
      s.cloud.lastSync = Date.now();
      return s;
    });
  }
  return { pulled, pushed: ahead, remoteModified };
}

/** Backup automático conforme a frequência escolhida. */
export async function autoBackupIfDue() {
  const s = useVault.getState().settings.cloud;
  if (!s.accounts.length || s.autoBackup === 'off' || s.autoBackup === 'on-close') return;
  const interval = s.autoBackup === 'daily' ? 86400_000 : 7 * 86400_000;
  if (Date.now() - (s.lastBackup || 0) < interval) return;
  for (const a of s.accounts) {
    try {
      await syncNow(a.provider);
      await backupNow(a.provider);
    } catch (e) {
      console.warn('backup automático falhou', a.provider, e);
    }
  }
}
