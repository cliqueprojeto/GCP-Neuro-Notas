import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, FileJson, KeyRound, Share2, Users } from 'lucide-react';
import { useT, type TKey } from '../../i18n';
import { useVault } from '../../store/vault';
import { toast } from '../../store/ui';
import { Modal } from '../ui';
import { copyText, openUrl, pickTextFiles, saveTextFile } from '../../lib/platform';
import { GoogleDriveIcon, OneDriveIcon } from './BrandIcons';

/** Lê o arquivo client_secret_*.json baixado do Google Cloud. */
export function parseGoogleClientJson(text: string): { clientId: string; clientSecret: string } {
  const data = JSON.parse(text);
  const c = data.installed || data.web || data;
  // aceita o JSON baixado do Google e o arquivo de compartilhamento do próprio app
  const clientId = String(c.client_id || c.clientId || '').trim();
  const clientSecret = String(c.client_secret || c.clientSecret || '').trim();
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('client_id');
  return { clientId, clientSecret };
}

const GOOGLE_STEPS: { img?: string; url?: string; key: string }[] = [
  { img: '1-projeto', url: 'https://console.cloud.google.com/projectcreate', key: 'g1' },
  { img: '2-drive-api', url: 'https://console.cloud.google.com/apis/library/drive.googleapis.com', key: 'g2' },
  { img: '3-autenticacao', url: 'https://console.cloud.google.com/auth/overview', key: 'g3' },
  { img: '3c-escopos', url: 'https://console.cloud.google.com/auth/scopes', key: 'g3c' },
  { img: '3b-branding', url: 'https://console.cloud.google.com/auth/branding', key: 'g3b' },
  { img: '4-publicar', url: 'https://console.cloud.google.com/auth/audience', key: 'g4' },
  { img: '5-cliente', url: 'https://console.cloud.google.com/auth/clients', key: 'g5' },
  { key: 'g6' },
  { img: '7-aviso', key: 'g7' },
  { img: '9-permitir', key: 'g8' },
];

const REPO = 'https://github.com/cliqueprojeto/GCP-Neuro-Notas';
const BRANDING_LINKS: [TKey, string][] = [
  ['guide.l.home', REPO],
  ['guide.l.privacy', `${REPO}/blob/claude/epic-bohr-f7xkw7/docs/PRIVACIDADE.md`],
  ['guide.l.terms', `${REPO}/blob/claude/epic-bohr-f7xkw7/docs/TERMOS.md`],
  ['guide.l.domain', 'github.com'],
];
const SCOPES = ['.../auth/drive.appdata', '.../auth/userinfo.email', 'openid'];

const MS_STEPS: { url?: string; key: string }[] = [
  { url: 'https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', key: 'm1' },
  { key: 'm2' },
  { key: 'm3' },
  { key: 'm4' },
  { key: 'm5' },
];

/** Lê o arquivo JSON do Google (client_secret… ou a configuração compartilhada) e guarda no app. */
export async function importGoogleJson(t: (k: any) => string) {
  const [f] = await pickTextFiles([{ name: 'JSON', extensions: ['json'] }]);
  if (!f) return false;
  try {
    const { clientId, clientSecret } = parseGoogleClientJson(f.text);
    useVault.getState().updateSettings((s) => ({ ...s, cloud: { ...s.cloud, googleClientId: clientId, googleClientSecret: clientSecret } }));
    toast(t('guide.jsonOk'), 'success');
    return true;
  } catch {
    toast(t('guide.jsonBad'), 'error');
    return false;
  }
}

/** Passo a passo ilustrado para criar o cadastro OAuth (sem conhecimento técnico). */
export function CloudGuide({ open, onClose, initial = 'gdrive' }: { open: boolean; onClose: () => void; initial?: 'gdrive' | 'onedrive' }) {
  const t = useT();
  const v = useVault();
  const cloud = v.settings.cloud;
  const [tab, setTab] = useState<'gdrive' | 'onedrive'>(initial);
  const [msId, setMsId] = useState(cloud.microsoftClientId || '');

  const importJson = () => importGoogleJson(t);
  const saveMs = () => {
    const id = msId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return toast(t('guide.msBad'), 'error');
    v.updateSettings((s) => ({ ...s, cloud: { ...s.cloud, microsoftClientId: id } }));
    toast(t('guide.msOk'), 'success');
  };

  return (
    <Modal open={open} onClose={onClose} width={760} title={<><KeyRound size={18} /> {t('guide.title')}</>}>
      <div className="seg guide-tabs">
        <button className={tab === 'gdrive' ? 'on' : ''} onClick={() => setTab('gdrive')}><GoogleDriveIcon size={16} /> Google Drive</button>
        <button className={tab === 'onedrive' ? 'on' : ''} onClick={() => setTab('onedrive')}><OneDriveIcon size={18} /> OneDrive</button>
      </div>
      {tab === 'gdrive' ? (
        <>
          <p className="muted">{t('guide.gIntro')}</p>
          <div className={'guide-status' + (cloud.googleClientId ? ' ok' : '')}>
            {cloud.googleClientId ? <CheckCircle2 size={18} /> : <FileJson size={18} />}
            <span className="grow">{cloud.googleClientId ? t('guide.gReady') : t('guide.gMissing')}</span>
            <button className="btn primary sm" onClick={importJson}><FileJson size={15} /> {t('guide.chooseJson')}</button>
          </div>
          <ol className="guide-steps">
            {GOOGLE_STEPS.map((s, i) => (
              <li key={s.key}>
                <div className="guide-step-text">
                  <b>{i + 1}. {t(`guide.${s.key}.t` as TKey)}</b>
                  <p>{t(`guide.${s.key}.d` as TKey)}</p>
                  <div className="row wrap">
                    {s.url && <button className="btn ghost sm" onClick={() => openUrl(s.url!)}><ExternalLink size={14} /> {t('guide.openPage')}</button>}
                    {s.key === 'g6' && <button className="btn primary sm" onClick={importJson}><FileJson size={15} /> {t('guide.chooseJson')}</button>}
                  </div>
                  {s.key === 'g3b' && (
                    <div className="guide-copy">
                      {BRANDING_LINKS.map(([k, val]) => (
                        <button key={k} className="guide-copy-row" onClick={() => copyText(val).then(() => toast(t('common.copied'), 'success'))} title={t('common.copy')}>
                          <small>{t(k)}</small><code>{val}</code><Copy size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                  {s.key === 'g3c' && <div className="guide-copy">{SCOPES.map((x) => <code key={x} className="guide-code">{x}</code>)}</div>}
                </div>
                {s.img && <img className="guide-img" src={`/oauth-guide/${s.img}.svg`} alt="" loading="lazy" />}
              </li>
            ))}
          </ol>
          <p className="muted small">{t('guide.gNote')}</p>
          <div className="guide-share">
            <div className="row"><Users size={16} /> <b>{t('guide.shareTitle')}</b></div>
            <p className="muted small">{t('guide.shareText')}</p>
            <div className="row wrap">
              <button className="btn ghost sm" disabled={!cloud.googleClientId} onClick={async () => {
                const json = JSON.stringify({ format: 'gcp-notas-google-client', clientId: cloud.googleClientId, clientSecret: cloud.googleClientSecret || '' }, null, 2);
                if (await saveTextFile('gcp-neuro-notas-google.json', json, [{ name: 'JSON', extensions: ['json'] }])) toast(t('guide.shareSaved'), 'success');
              }}><Share2 size={14} /> {t('guide.shareExport')}</button>
              <button className="btn ghost sm" onClick={importJson}><FileJson size={14} /> {t('guide.shareImport')}</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="muted">{t('guide.mIntro')}</p>
          <ol className="guide-steps">
            {MS_STEPS.map((s, i) => (
              <li key={s.key}>
                <div className="guide-step-text">
                  <b>{i + 1}. {t(`guide.${s.key}.t` as TKey)}</b>
                  <p>{t(`guide.${s.key}.d` as TKey)}</p>
                  {s.key === 'm2' && <code className="guide-code">http://localhost</code>}
                  {s.key === 'm5' && <code className="guide-code">Files.ReadWrite.AppFolder · User.Read · offline_access</code>}
                  {s.url && <button className="btn ghost sm" onClick={() => openUrl(s.url!)}><ExternalLink size={14} /> {t('guide.openPage')}</button>}
                  {s.key === 'm3' && (
                    <div className="row">
                      <input className="input mono" placeholder="00000000-0000-0000-0000-000000000000" value={msId} onChange={(e) => setMsId(e.target.value)} />
                      <button className="btn primary sm" onClick={saveMs}>{t('common.save')}</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className={'guide-status' + (cloud.microsoftClientId ? ' ok' : '')}>
            {cloud.microsoftClientId ? <CheckCircle2 size={18} /> : <KeyRound size={18} />}
            <span className="grow">{cloud.microsoftClientId ? t('guide.mReady') : t('guide.mMissing')}</span>
          </div>
        </>
      )}
    </Modal>
  );
}
