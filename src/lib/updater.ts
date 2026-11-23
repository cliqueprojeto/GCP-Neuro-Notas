import { invoke } from '@tauri-apps/api/core';
import { APP_VERSION, isDesktop, netFetch, platformInfo } from './platform';
import { usePrefs } from '../store/prefs';
import type { UpdateFrequency } from './types';

export const REPO = 'cliqueprojeto/GCP-Neuro-Notas';
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export interface ReleaseInfo {
  version: string;
  name: string;
  notes: string;
  url: string;
  published: string;
  asset?: { name: string; url: string; sha256Url: string; size: number };
}

export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Escolhe o instalador certo para este sistema entre os arquivos da release. */
export function pickAsset(assets: any[], os: string, arch: string, pkg: string) {
  let re: RegExp | null = null;
  if (os === 'android') re = /Android\.apk$/i;
  else if (os === 'windows') re = /Windows-x64-Setup\.exe$/i;
  else if (os === 'macos') re = arch === 'aarch64' ? /macOS-arm64\.dmg$/i : /macOS-x86_64\.dmg$/i;
  else if (os === 'linux') re = pkg === 'rpm' ? /\.x86_64\.rpm$/ : pkg === 'arch' ? /\.pkg\.tar\.zst$/ : /_amd64\.deb$/;
  if (!re) return undefined;
  const a = assets.find((x) => re!.test(x.name));
  if (!a) return undefined;
  const sha = assets.find((x) => x.name === a.name + '.sha256');
  if (!sha) return undefined;
  return { name: a.name, url: a.browser_download_url, sha256Url: sha.browser_download_url, size: a.size };
}

export async function fetchLatest(): Promise<ReleaseInfo> {
  const res = await netFetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GCP-Notas' },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const r = await res.json();
  const info = await platformInfo();
  return {
    version: String(r.tag_name || '').replace(/^v/, ''),
    name: r.name || r.tag_name,
    notes: r.body || '',
    url: r.html_url,
    published: r.published_at,
    asset: pickAsset(r.assets || [], info.os, info.arch, info.package),
  };
}

export type CheckResult = { status: 'available'; release: ReleaseInfo } | { status: 'latest' } | { status: 'error'; error: string };

export async function checkForUpdate(): Promise<CheckResult> {
  try {
    const rel = await fetchLatest();
    usePrefs.getState().set({ lastUpdateCheck: Date.now() });
    if (rel.version && compareVersions(rel.version, APP_VERSION) > 0) return { status: 'available', release: rel };
    return { status: 'latest' };
  } catch (e) {
    return { status: 'error', error: String(e) };
  }
}

const INTERVALS: Record<UpdateFrequency, number> = {
  startup: 0,
  daily: 86400_000,
  weekly: 7 * 86400_000,
  biweekly: 14 * 86400_000,
  monthly: 30 * 86400_000,
  never: Infinity,
};

/** `minGap`: ao voltar para o app, "a cada abertura" vira "no máximo uma vez por hora". */
export function isCheckDue(minGap = 0): boolean {
  const { updateFrequency, lastUpdateCheck } = usePrefs.getState();
  if (updateFrequency === 'never') return false;
  return Date.now() - lastUpdateCheck >= Math.max(INTERVALS[updateFrequency], minGap);
}

export async function downloadAndInstall(rel: ReleaseInfo, onProgress: (received: number, total: number) => void) {
  if (!isDesktop || !rel.asset) throw new Error('unsupported');
  const { listen } = await import('@tauri-apps/api/event');
  const un = await listen<{ received: number; total: number }>('update-progress', (e) => onProgress(e.payload.received, e.payload.total));
  try {
    const info = await platformInfo();
    const path = await invoke<string>('update_download', {
      url: rel.asset.url,
      sha256Url: rel.asset.sha256Url,
      fileName: rel.asset.name,
    });
    await invoke('update_install', { path, kind: info.package });
    return path;
  } finally {
    un();
  }
}
