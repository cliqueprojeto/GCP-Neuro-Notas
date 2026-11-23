import { useEffect, useState } from 'react';
import { CloudCheck, CloudOff, CloudAlert, RefreshCw } from 'lucide-react';
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
    const h = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(h);
  }, []);
  if (!connected || !auto) return null;

  const when = s.lastAt ? relativeTime(s.lastAt, LOCALES[lang]) : '';
  const title =
    s.status === 'syncing' ? t('sync.syncing')
    : s.status === 'ok' ? t('sync.ok', { d: when })
    : s.status === 'offline' ? t('sync.offline')
    : s.status === 'mismatch' ? t('sync.mismatch')
    : s.status === 'error' ? t('sync.error') + (s.error ? ' — ' + s.error : '')
    : t('sync.idle');
  const bad = s.status === 'error' || s.status === 'mismatch';
  const click = () => (bad ? useUi.getState().go({ name: 'settings', tab: 'backup' }) : void syncSoon(true));

  return (
    <button className={'icon-btn boxed sync-badge s-' + s.status} onClick={click} title={title} aria-label={title}>
      {s.status === 'syncing' ? <RefreshCw size={16} className="spin" />
        : s.status === 'offline' ? <CloudOff size={17} />
        : bad ? <CloudAlert size={17} />
        : <CloudCheck size={17} />}
    </button>
  );
}
