import { useState } from 'react';
import { FileUp, Share2, Shield } from 'lucide-react';
import { useT } from '../i18n';
import { Modal, PageIcon, Select, Spinner, Switch } from './ui';
import { PasswordInput } from './Auth';
import { collectForShare, exportShare, importShare, openShare, pickShareFile, shareNeedsPassword, sharePreview } from '../lib/share';
import { useVault, livePages } from '../store/vault';
import { toast, useUi } from '../store/ui';
import type { Page } from '../lib/types';

export function ShareModal({ page, open, onClose }: { page: Page; open: boolean; onClose: () => void }) {
  const t = useT();
  const [protect, setProtect] = useState(true);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const items = open ? collectForShare([page.id]) : [];
  const go = async () => {
    setBusy(true);
    try {
      const path = await exportShare([page.id], protect ? pw : null);
      if (path) {
        toast(t('share.saved'), 'success');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={<><Share2 size={18} /> {t('share.title')}</>}
      footer={
        <>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" onClick={go} disabled={busy || (protect && pw.length < 4)}>{busy ? <Spinner /> : <Share2 size={15} />} {t('share.export')}</button>
        </>
      }
    >
      <p className="muted">{t('share.text')}</p>
      <div className="share-list">
        {items.slice(0, 8).map((p) => (
          <div key={p.id} className="row small"><PageIcon icon={p.icon} size={15} /> {p.title || t('page.untitled')}</div>
        ))}
        {items.length > 8 && <div className="muted small">+{items.length - 8}</div>}
      </div>
      <Switch checked={protect} onChange={setProtect} label={t('share.protect')} />
      {protect && <PasswordInput value={pw} onChange={setPw} placeholder={t('share.password')} />}
      <div className="callout-box"><Shield size={16} /> <span>{t('share.info')}</span></div>
    </Modal>
  );
}

export function ImportShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const pages = useVault((s) => s.pages);
  const [file, setFile] = useState<any>(null);
  const [payload, setPayload] = useState<any>(null);
  const [pw, setPw] = useState('');
  const [parent, setParent] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = () => (setFile(null), setPayload(null), setPw(''));
  const pick = async () => {
    try {
      const f = await pickShareFile();
      if (!f) return;
      setFile(f);
      if (!shareNeedsPassword(f)) setPayload(await openShare(f));
    } catch {
      toast(t('backup.importError'), 'error');
    }
  };
  const unlock = async () => {
    setBusy(true);
    try {
      setPayload(await openShare(file, pw));
    } catch {
      toast(t('login.wrong'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const doImport = () => {
    const created = importShare(payload, parent || null);
    toast(t('share.imported', { n: created.length }), 'success');
    const root = created.find((p) => p.parentId === (parent || null));
    if (root) useUi.getState().go({ name: 'page', id: root.id });
    reset();
    onClose();
  };
  const prev = payload ? sharePreview(payload) : null;
  return (
    <Modal
      open={open}
      onClose={() => (reset(), onClose())}
      title={<><FileUp size={18} /> {t('share.import')}</>}
      footer={
        <>
          <div className="grow" />
          <button className="btn ghost" onClick={() => (reset(), onClose())}>{t('common.cancel')}</button>
          {payload && <button className="btn primary" onClick={doImport}>{t('share.importBtn')}</button>}
        </>
      }
    >
      {!file && (
        <button className="drop-zone" onClick={pick}>
          <FileUp size={28} />
          <b>{t('share.pick')}</b>
          <small className="muted">.gcpshare</small>
        </button>
      )}
      {file && !payload && (
        <div className="stack">
          <p className="muted">{t('share.needsPassword')}</p>
          <PasswordInput value={pw} onChange={setPw} placeholder={t('share.password')} autoFocus onEnter={unlock} />
          <button className="btn primary" onClick={unlock} disabled={busy || !pw}>{busy ? <Spinner /> : null} {t('login.unlock')}</button>
        </div>
      )}
      {prev && (
        <div className="stack">
          <b>{t('share.contains', { n: prev.count })}</b>
          <div className="share-list">
            {prev.roots.map((p: Page) => <div key={p.id} className="row"><PageIcon icon={p.icon} size={16} /> {p.title}</div>)}
          </div>
          <Select
            value={parent}
            options={[{ value: '', label: t('share.toRoot') }, ...livePages(pages).filter((p) => p.type === 'page').slice(0, 200).map((p) => ({ value: p.id, label: p.title || t('page.untitled'), icon: <PageIcon icon={p.icon} size={14} /> }))]}
            onChange={setParent}
          />
        </div>
      )}
    </Modal>
  );
}
