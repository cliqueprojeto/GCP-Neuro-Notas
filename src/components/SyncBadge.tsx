import { useEffect, useState } from 'react';
import { CloudCheck, CloudOff, CloudAlert, CloudUpload, RefreshCw } from 'lucide-react';
import { useT, useLang, LOCALES } from '../i18n';
import { useVault } from '../store/vault';
import { useUi } from '../store/ui';
import { useSync, syncSoon } from '../cloud/autosync';
import { relativeTime } from '../lib/doc';

/** Indicador discreto da sincronização automática (só aparece com uma nuvem conectada). */
export function SyncBadge() {
  const t = useT();
  const lang = useLang();
  const s = useSync();
  const connected = useVault((v) => v.settings.cloud.accounts.length > 0);
  const auto = useVault((v) => v.settings.cloud.autoSync !== false);
  const [, tick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => tick((x) => x + 1), 5_000);
    return () => clearInterval(h);
  }, []);
  if (!connected || !auto) return null;

  const when = s.lastAt ? relativeTime(s.lastAt, LOCALES[lang]) : '';
  const secs = s.nextAt ? Math.max(1, Math.round((s.nextAt - Date.now()) / 1000)) : 0;
  const pending = s.pending && s.status !== 'syncing' && s.status !== 'error' && s.status !== 'mismatch';
  const title =
    pending ? (secs ? t('sync.pendingIn', { s: secs > 90 ? Math.round(secs / 60) + ' min' : secs + ' s' }) : t('sync.pendingManual'))
    : s.status === 'syncing' ? t('sync.syncing')
    : s.status === 'ok' ? t('sync.ok', { d: when })
    : s.status === 'offline' ? t('sync.offline')
    : s.status === 'mismatch' ? t('sync.mismatch')
    : s.status === 'error' ? t('sync.error') + (s.error ? ' — ' + s.error : '')
    : t('sync.idle');
  const bad = s.status === 'error' || s.status === 'mismatch';
  const click = () => (bad ? useUi.getState().go({ name: 'settings', tab: 'backup' }) : void syncSoon(true));

  return (
    <button className={'icon-btn boxed sync-badge s-' + (pending ? 'pending' : s.status)} onClick={click} title={title} aria-label={title}>
      {s.status === 'syncing' ? <RefreshCw size={16} className="spin" />
        : pending ? <CloudUpload size={17} />
        : s.status === 'offline' ? <CloudOff size={17} />
        : bad ? <CloudAlert size={17} />
        : <CloudCheck size={17} />}
    </button>
  );
}
