import { useState } from 'react';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';
import { useT } from '../../i18n';
import { wipeEverything } from '../../store/vault';
import { Modal, Spinner } from '../ui';

/** Zona de perigo: apaga tudo neste aparelho e recomeça como numa instalação nova. */
export function WipeCard({ onBackup }: { onBackup: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const word = t('wipe.word');
  const ok = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
  const close = () => (setOpen(false), setTyped(''));
  return (
    <section className="card-section danger-zone">
      <div className="card-head">
        <span className="card-icon danger"><AlertTriangle size={18} /></span>
        <div>
          <h3>{t('wipe.title')}</h3>
          <p className="muted">{t('wipe.subtitle')}</p>
        </div>
      </div>
      <div className="card-body">
        <button className="btn danger-solid" onClick={() => setOpen(true)}><Trash2 size={15} /> {t('wipe.button')}</button>
      </div>
      <Modal
        open={open}
        onClose={() => !busy && close()}
        width={520}
        className="wipe-modal"
        title={<><AlertTriangle size={18} /> {t('wipe.confirmTitle')}</>}
        footer={
          <>
            <button className="btn ghost" onClick={onBackup} disabled={busy}><Download size={15} /> {t('wipe.backupFirst')}</button>
            <div className="grow" />
            <button className="btn ghost" onClick={close} disabled={busy}>{t('common.cancel')}</button>
            <button
              className="btn danger-solid"
              disabled={!ok || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await wipeEverything();
                } catch {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Spinner /> : <Trash2 size={15} />} {t('wipe.confirm')}
            </button>
          </>
        }
      >
        <div className="wipe-alert">
          <p><b>{t('wipe.irreversible')}</b></p>
          <ul>
            <li>{t('wipe.item1')}</li>
            <li>{t('wipe.item2')}</li>
            <li>{t('wipe.item3')}</li>
          </ul>
          <p className="muted small">{t('wipe.keeps')}</p>
        </div>
        <label className="field-label">{t('wipe.typeToConfirm', { w: word })}</label>
        <input
          className={'input wipe-input' + (typed && !ok ? ' invalid' : '')}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={word}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ok && !busy && (setBusy(true), void wipeEverything())}
        />
      </Modal>
    </section>
  );
}
