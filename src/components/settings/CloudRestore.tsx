import { useEffect, useState } from 'react';
import { Cloud, RefreshCw } from 'lucide-react';
import { useT, useLang, LOCALES } from '../../i18n';
import { Modal, Spinner } from '../ui';
import { CLOUD_NAMES, connect, listFiles, restoreFromCloud, type CloudFile, type CloudProvider } from '../../cloud/cloud';
import { useVault } from '../../store/vault';
import { toast } from '../../store/ui';
import { formatDate } from '../../lib/doc';
import { PasswordInput } from '../Auth';
import { isTauri } from '../../lib/platform';

export function cloudErrorText(t: (k: any, v?: any) => string, e: unknown) {
  const m = String((e as Error)?.message || e);
  if (m === 'desktop-only') return t('cloud.desktopOnly');
  if (m === 'missing-client-id') return t('cloud.missingClient');
  if (m === 'timeout') return t('cloud.timeout');
  return m;
}

export function CloudRestoreModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const t = useT();
  const lang = useLang();
  const accounts = useVault((s) => s.settings.cloud.accounts);
  const [provider, setProvider] = useState<CloudProvider>('gdrive');
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const [sel, setSel] = useState<string>('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const connected = accounts.some((a) => a.provider === provider);

  const load = async () => {
    setBusy(true);
    try {
      const list = (await listFiles(provider)).filter((f) => f.name.endsWith('.gcpcloud'));
      setFiles(list);
      setSel(list[0]?.id || '');
    } catch (e) {
      toast(cloudErrorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (open && connected) void load();
    else setFiles(null);
  }, [open, provider, connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const doConnect = async () => {
    setBusy(true);
    try {
      await connect(provider);
      toast(t('cloud.connected', { p: CLOUD_NAMES[provider] }), 'success');
    } catch (e) {
      toast(cloudErrorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!sel || !pw) return;
    if (!window.confirm(t('cloud.restoreConfirm'))) return;
    setBusy(true);
    try {
      const ok = await restoreFromCloud(provider, sel, pw);
      if (!ok) return toast(t('login.wrong'), 'error');
      toast(t('cloud.restored'), 'success');
      onDone?.();
      onClose();
    } catch (e) {
      toast(cloudErrorText(t, e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<><Cloud size={18} /> {t('backup.restoreCloud')}</>}
      width={560}
      footer={
        <>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" onClick={restore} disabled={busy || !sel || !pw}>{busy ? <Spinner /> : null} {t('cloud.restore')}</button>
        </>
      }
    >
      {!isTauri && <div className="callout-box warn">{t('cloud.desktopOnly')}</div>}
      <div className="seg">
        {(['gdrive', 'onedrive'] as CloudProvider[]).map((p) => (
          <button key={p} className={provider === p ? 'on' : ''} onClick={() => setProvider(p)}>{CLOUD_NAMES[p]}</button>
        ))}
      </div>
      {!connected ? (
        <button className="btn primary block" onClick={doConnect} disabled={busy}>{busy ? <Spinner /> : <Cloud size={16} />} {t('cloud.connect', { p: CLOUD_NAMES[provider] })}</button>
      ) : (
        <div className="stack">
          <div className="row"><b className="grow">{t('cloud.backups')}</b><button className="icon-btn sm" onClick={load}><RefreshCw size={15} /></button></div>
          {busy && !files && <Spinner />}
          {files && !files.length && <div className="muted">{t('cloud.noBackups')}</div>}
          <div className="file-list">
            {files?.map((f) => (
              <label key={f.id} className={'file-row' + (sel === f.id ? ' on' : '')}>
                <input type="radio" checked={sel === f.id} onChange={() => setSel(f.id)} />
                <span className="grow">
                  <b>{f.name.includes('sync') ? t('cloud.syncFile') : f.name.replace('GCP-Notas-backup-', '').replace('.gcpcloud', '')}</b>
                  <small className="muted"> · {formatDate(f.modified, LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' })} · {(f.size / 1024).toFixed(0)} KB</small>
                </span>
              </label>
            ))}
          </div>
          <PasswordInput value={pw} onChange={setPw} placeholder={t('cloud.backupPassword')} />
          <small className="muted">{t('cloud.restoreInfo')}</small>
        </div>
      )}
    </Modal>
  );
}
