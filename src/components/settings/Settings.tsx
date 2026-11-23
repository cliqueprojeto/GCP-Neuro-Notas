import { useEffect, useState } from 'react';
import {
  BellRing,
  Bot, Check, CloudUpload, Cloud, Download, ExternalLink, FileUp, HardDrive, KeyRound, Lock, Palette, RefreshCw, Shield, Sparkles,
  Trash2, Upload, Globe, Type, Share2, BrainCircuit, Plus, Loader2, FolderInput,
} from 'lucide-react';
import { useT, useLang, LOCALES, type TKey } from '../../i18n';
import { usePrefs, type Lang } from '../../store/prefs';
import { useVault } from '../../store/vault';
import { toast, useUi } from '../../store/ui';
import { Field, Modal, Select, Spinner, Switch } from '../ui';
import { ThemeGrid } from '../Topbar';
import { PasswordInput, StrengthMeter } from '../Auth';
import { APP_VERSION, copyText, isTauri, openUrl, platformInfo, type PlatformInfo } from '../../lib/platform';
import { RELEASES_URL, checkForUpdate, type CheckResult } from '../../lib/updater';
import { exportBackup, exportAiContext, importBackup, importFiles, pickBackupFile } from '../../lib/transfer';
import { CLOUD_NAMES, backupNow, clientConfig, connect, disconnect, syncNow, VaultMismatchError, type CloudProvider } from '../../cloud/cloud';
import { CloudRestoreModal, cloudErrorText } from './CloudRestore';
import { CloudGuide } from './CloudGuide';
import { GoogleDriveIcon, OneDriveIcon } from './BrandIcons';
import { NotionCard } from './NotionCard';
import { WipeCard } from './WipeCard';
import { AlertsSettings } from './AlertsSettings';
import { PROVIDERS, detectBestModel, guessProvider, providerMeta, chat } from '../../ai/providers';
import type { AiProvider, AiProviderId, UpdateFrequency } from '../../lib/types';
import { uid } from '../../lib/crypto';
import { formatDate, relativeTime } from '../../lib/doc';
import { ImportShareModal } from '../ShareModal';
import { askConfirm, askText } from '../PromptHost';

const TABS = [
  { id: 'general', icon: Palette },
  { id: 'security', icon: Shield },
  { id: 'backup', icon: CloudUpload },
  { id: 'ai', icon: Bot },
  { id: 'alerts', icon: BellRing },
  { id: 'updates', icon: RefreshCw },
] as const;

export function Settings({ tab: initial }: { tab?: string }) {
  const t = useT();
  const [tab, setTab] = useState<string>(initial || 'general');
  useEffect(() => setTab(initial || 'general'), [initial]);
  return (
    <div className="page-shell">
      <div className="page-hero compact">
        <div className="eyebrow"><Sparkles size={13} /> GCP-NEURO NOTAS</div>
        <h1>{t('settings.title')}</h1>
        <p className="muted">{t('settings.subtitle')}</p>
      </div>
      <div className="settings">
        <div className="settings-tabs">
          {TABS.map(({ id, icon: Icon }) => (
            <button key={id} className={'stab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
              <Icon size={17} /> {t(`settings.tab.${id}` as TKey)}
            </button>
          ))}
        </div>
        <div className="settings-body">
          {tab === 'general' && <General />}
          {tab === 'security' && <Security />}
          {tab === 'backup' && <Backup />}
          {tab === 'ai' && <AiSettings />}
          {tab === 'alerts' && <AlertsSettings />}
          {tab === 'updates' && <Updates />}
        </div>
      </div>
    </div>
  );
}

export function Card({ icon, title, subtitle, children, tone }: { icon: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <section className="card-section">
      <div className="card-head">
        <span className={'card-icon ' + (tone || '')}>{icon}</span>
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- geral

function General() {
  const t = useT();
  const prefs = usePrefs();
  const editor = useVault((s) => s.settings.editor);
  const snaps = useVault((s) => s.settings.snapshots);
  const update = useVault((s) => s.updateSettings);
  return (
    <>
      <Card icon={<Globe size={18} />} title={t('settings.language')} subtitle={t('settings.languageHint')}>
        <Select
          value={prefs.lang}
          options={[
            { value: 'auto', label: t('settings.langAuto') },
            { value: 'pt', label: 'Português (Brasil)' },
            { value: 'en', label: 'English' },
            { value: 'es', label: 'Español' },
          ]}
          onChange={(lang) => prefs.set({ lang: lang as Lang | 'auto' })}
        />
      </Card>
      <Card icon={<Palette size={18} />} title={t('settings.theme')} subtitle={t('settings.themeHint')}>
        <ThemeGrid large />
      </Card>
      <Card icon={<Type size={18} />} title={t('settings.editor')} subtitle={t('settings.editorHint')}>
        <div className="two">
          <Field label={t('settings.font')}>
            <Select value={editor.font} options={[{ value: 'sans', label: 'Sans (Inter)' }, { value: 'serif', label: 'Serif (Lora)' }, { value: 'mono', label: 'Mono' }]} onChange={(font) => update((s) => ((s.editor.font = font), s))} />
          </Field>
          <Field label={t('settings.fontSize')}>
            <Select value={String(editor.fontSize)} options={[14, 15, 16, 17, 18, 20].map((n) => ({ value: String(n), label: `${n}px` }))} onChange={(v) => update((s) => ((s.editor.fontSize = +v), s))} />
          </Field>
          <Field label={t('settings.width')}>
            <Select value={editor.width} options={[{ value: 'normal', label: t('settings.width.normal') }, { value: 'wide', label: t('settings.width.wide') }]} onChange={(width) => update((s) => ((s.editor.width = width), s))} />
          </Field>
        </div>
        <Switch checked={editor.spellcheck} onChange={(v) => update((s) => ((s.editor.spellcheck = v), s))} label={t('settings.spellcheck')} />
        <Switch checked={snaps.enabled} onChange={(v) => update((s) => ((s.snapshots.enabled = v), s))} label={t('settings.snapshots')} />
      </Card>
    </>
  );
}

// ------------------------------------------------------------- segurança

function Security() {
  const t = useT();
  const v = useVault();
  const [cur, setCur] = useState('');
  const [np, setNp] = useState('');
  const [np2, setNp2] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const change = async () => {
    if (np.length < 8) return toast(t('wizard.pwTooShort'), 'error');
    if (np !== np2) return toast(t('wizard.pwMismatch'), 'error');
    setBusy(true);
    const ok = await v.changePassword(cur, np);
    setBusy(false);
    if (!ok) return toast(t('login.wrong'), 'error');
    setCur(''); setNp(''); setNp2('');
    toast(t('security.changed'), 'success');
  };
  return (
    <>
      <Card icon={<Lock size={18} />} title={t('security.autoLock')} subtitle={t('security.autoLockHint')}>
        <Select
          value={String(v.settings.security.autoLockMinutes)}
          options={[1, 5, 15, 30, 60, 0].map((m) => ({ value: String(m), label: m ? t('security.minutes', { n: m }) : t('security.never') }))}
          onChange={(m) => v.updateSettings((s) => ((s.security.autoLockMinutes = +m), s))}
        />
        <button className="btn ghost" onClick={v.lock}><Lock size={15} /> {t('nav.lock')}</button>
      </Card>
      <Card icon={<KeyRound size={18} />} title={t('security.changePassword')} subtitle={t('security.changeHint')}>
        <PasswordInput value={cur} onChange={setCur} placeholder={t('security.current')} />
        <PasswordInput value={np} onChange={setNp} placeholder={t('wizard.newPassword')} />
        <StrengthMeter password={np} />
        <PasswordInput value={np2} onChange={setNp2} placeholder={t('wizard.confirmPassword')} onEnter={change} />
        <button className="btn primary" onClick={change} disabled={busy || !cur || !np}>{busy ? <Spinner /> : <Check size={15} />} {t('security.save')}</button>
      </Card>
      <Card icon={<Shield size={18} />} title={t('wizard.recTitle')} subtitle={t('security.recoveryHint')}>
        {code ? (
          <>
            <div className="recovery-code">{code}</div>
            <button className="btn ghost" onClick={() => copyText(code).then(() => toast(t('common.copied'), 'success'))}>{t('common.copy')}</button>
          </>
        ) : (
          <button className="btn ghost" onClick={async () => { if (await askConfirm({ title: t('security.regen'), message: t('security.regenConfirm') })) setCode(await v.regenerateRecovery()); }}>
            <RefreshCw size={15} /> {t('security.regen')}
          </button>
        )}
      </Card>
      <Card icon={<Shield size={18} />} title={t('security.howTitle')} tone="green">
        <ul className="bullets">
          <li>{t('security.how1')}</li>
          <li>{t('security.how2')}</li>
          <li>{t('security.how3')}</li>
          <li>{t('security.how4')}</li>
        </ul>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- backup

function Backup() {
  const t = useT();
  const lang = useLang();
  const v = useVault();
  const cloud = v.settings.cloud;
  const [busy, setBusy] = useState<string>('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [guide, setGuide] = useState<'' | CloudProvider>('');
  const [shareOpen, setShareOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [expPw, setExpPw] = useState('');
  const [info, setInfo] = useState<PlatformInfo | null>(null);
  useEffect(() => void platformInfo().then(setInfo), []);

  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok, 'success');
    } catch (e) {
      if (e instanceof VaultMismatchError) toast(t('cloud.mismatch'), 'error');
      else toast(cloudErrorText(t, e), 'error');
    } finally {
      setBusy('');
    }
  };

  const doImport = async () => {
    const f = await pickBackupFile().catch((e) => (toast(String(e), 'error'), null));
    if (!f) return;
    const pass = await askText({ title: t('backup.importFile'), label: t('backup.filePassword'), password: true });
    if (pass == null) return;
    const mode = (await askConfirm({ title: t('backup.importFile'), message: t('backup.mergeQuestion'), okLabel: t('backup.merge'), cancelLabel: t('backup.replace') })) ? 'merge' : 'replace';
    await run('import', async () => {
      const n = await importBackup(f, pass, mode);
      toast(t('backup.imported', { n }), 'success');
    });
  };

  return (
    <>
      <Card icon={<HardDrive size={18} />} title={t('backup.local')} subtitle={t('backup.localHint')}>
        <div className="row wrap">
          <button className="btn primary" onClick={() => setExpOpen(true)}><Download size={15} /> {t('backup.export')}</button>
          <button className="btn ghost" onClick={doImport} disabled={busy === 'import'}><Upload size={15} /> {t('backup.importFile')}</button>
          <button className="btn ghost" onClick={() => setShareOpen(true)}><Share2 size={15} /> {t('share.import')}</button>
        </div>
        {info && <small className="muted">{t('backup.location')}: <code>{info.data_dir}</code></small>}
      </Card>

      <Card icon={<Cloud size={18} />} title={t('cloud.title')} subtitle={t('cloud.subtitle')}>
        {!isTauri && <div className="callout-box warn">{t('cloud.desktopOnly')}</div>}
        {(['gdrive', 'onedrive'] as CloudProvider[]).map((p) => {
          const acc = cloud.accounts.find((a) => a.provider === p);
          const cfg = clientConfig(p);
          return (
            <div key={p} className="cloud-row">
              <div className={'cloud-logo brand ' + p}>{p === 'gdrive' ? <GoogleDriveIcon size={26} /> : <OneDriveIcon size={30} />}</div>
              <div className="grow">
                <b>{CLOUD_NAMES[p]}</b>
                <small className="muted block">{acc ? `${t('cloud.connectedAs')} ${acc.email || '—'}` : cfg.clientId ? t('cloud.notConnected') : t('cloud.missingClient')}</small>
              </div>
              {acc ? (
                <>
                  <button className="btn ghost sm" onClick={() => run('sync' + p, async () => { const r = await syncNow(p); toast(t('cloud.synced', { n: r.pulled }), 'success'); })} disabled={!!busy}>
                    {busy === 'sync' + p ? <Spinner /> : <RefreshCw size={14} />} {t('cloud.syncNow')}
                  </button>
                  <button className="btn ghost sm" onClick={() => run('bk' + p, () => backupNow(p), t('cloud.backupDone'))} disabled={!!busy}>
                    {busy === 'bk' + p ? <Spinner /> : <CloudUpload size={14} />} {t('cloud.backupNow')}
                  </button>
                  <button className="btn ghost sm danger" onClick={() => disconnect(p)}>{t('cloud.disconnect')}</button>
                </>
              ) : (
                <>
                {!cfg.clientId && <button className="btn ghost sm" onClick={() => setGuide(p)}><KeyRound size={14} /> {t('guide.setup')}</button>}
                <button className="btn primary sm" onClick={() => (cfg.clientId ? run('c' + p, () => connect(p), t('cloud.connected', { p: CLOUD_NAMES[p] })) : setGuide(p))} disabled={!!busy || !isTauri}>
                  {busy === 'c' + p ? <Spinner /> : <Cloud size={14} />} {t('cloud.connectShort')}
                </button>
                </>
              )}
            </div>
          );
        })}
        <div className="two">
          <Field label={t('cloud.auto')}>
            <Select
              value={cloud.autoBackup}
              options={(['off', 'daily', 'weekly'] as const).map((x) => ({ value: x, label: t(`cloud.auto.${x}` as TKey) }))}
              onChange={(x) => v.updateSettings((s) => ((s.cloud.autoBackup = x), s))}
            />
          </Field>
          <Field label={t('cloud.keep')}>
            <Select value={String(cloud.keep)} options={[5, 10, 20, 50].map((n) => ({ value: String(n), label: String(n) }))} onChange={(n) => v.updateSettings((s) => ((s.cloud.keep = +n), s))} />
          </Field>
        </div>
        <div className="row wrap muted small">
          {cloud.lastBackup ? <span>{t('cloud.lastBackup')}: {relativeTime(cloud.lastBackup, LOCALES[lang])}</span> : null}
          {cloud.lastSync ? <span>· {t('cloud.lastSync')}: {relativeTime(cloud.lastSync, LOCALES[lang])}</span> : null}
        </div>
        <button className="btn ghost" onClick={() => setRestoreOpen(true)}><FolderInput size={15} /> {t('backup.restoreCloud')}</button>
        <details className="advanced">
          <summary>{t('cloud.advanced')}</summary>
          <p className="muted small">{t('cloud.advancedHint')}</p>
          <div className="row wrap">
            <button className="btn primary sm" onClick={() => setGuide('gdrive')}><GoogleDriveIcon size={15} /> {t('guide.setupGoogle')}</button>
            <button className="btn ghost sm" onClick={() => setGuide('onedrive')}><OneDriveIcon size={17} /> {t('guide.setupMs')}</button>
          </div>
          <Field label="Google Client ID"><input className="input mono" value={cloud.googleClientId || ''} placeholder={clientConfig('gdrive').clientId || '…apps.googleusercontent.com'} onChange={(e) => v.updateSettings((s) => ((s.cloud.googleClientId = e.target.value.trim()), s))} /></Field>
          <Field label="Google Client Secret"><input className="input mono" value={cloud.googleClientSecret || ''} onChange={(e) => v.updateSettings((s) => ((s.cloud.googleClientSecret = e.target.value.trim()), s))} /></Field>
          <Field label="Microsoft Application (client) ID"><input className="input mono" value={cloud.microsoftClientId || ''} placeholder={clientConfig('onedrive').clientId || '00000000-0000-0000-0000-000000000000'} onChange={(e) => v.updateSettings((s) => ((s.cloud.microsoftClientId = e.target.value.trim()), s))} /></Field>
          <button className="link-btn" onClick={() => openUrl('https://github.com/cliqueprojeto/GCP-Neuro-Notas/blob/main/docs/CLOUD-SETUP.md')}><ExternalLink size={13} /> {t('cloud.guide')}</button>
        </details>
      </Card>

      <Card icon={<BrainCircuit size={18} />} title={t('backup.aiContext')} subtitle={t('backup.aiContextHint')}>
        <div className="row wrap">
          <button className="btn ghost" onClick={() => exportAiContext()}><Download size={15} /> {t('backup.aiContextBtn')}</button>
          <button className="btn ghost" onClick={async () => { const n = await importFiles(null); if (n) toast(t('import.done', { n }), 'success'); }}><FileUp size={15} /> {t('import.markdown')}</button>
        </div>
      </Card>

      <Modal
        open={expOpen}
        onClose={() => setExpOpen(false)}
        title={t('backup.export')}
        footer={
          <>
            <div className="grow" />
            <button className="btn ghost" onClick={() => setExpOpen(false)}>{t('common.cancel')}</button>
            <button className="btn primary" disabled={expPw.length < 6 || busy === 'exp'} onClick={() => run('exp', async () => { const p = await exportBackup(expPw); if (p) { toast(t('backup.exported'), 'success'); setExpOpen(false); setExpPw(''); } })}>
              {busy === 'exp' ? <Spinner /> : <Download size={15} />} {t('backup.exportBtn')}
            </button>
          </>
        }
      >
        <p className="muted">{t('backup.exportText')}</p>
        <PasswordInput value={expPw} onChange={setExpPw} placeholder={t('backup.filePassword')} autoFocus />
        <StrengthMeter password={expPw} />
      </Modal>
      <CloudRestoreModal open={restoreOpen} onClose={() => setRestoreOpen(false)} />
      {guide && <CloudGuide open initial={guide} onClose={() => setGuide('')} />}
      <NotionCard />
      <WipeCard onBackup={() => setExpOpen(true)} />
      <ImportShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}

// -------------------------------------------------------------------- IA

function AiSettings() {
  const t = useT();
  const v = useVault();
  const ai = v.settings.ai;
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<AiProviderId>('anthropic');
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [busy, setBusy] = useState('');
  const save = (list: AiProvider[], active?: string) => v.updateSettings((s) => ((s.ai.providers = list), active !== undefined && (s.ai.activeProvider = active), s));

  const add = async () => {
    const meta = providerMeta(kind);
    const p: AiProvider = { id: uid('ai'), kind, name: meta.name, apiKey: key.trim(), baseUrl: baseUrl.trim() || undefined, autoModel: true };
    setBusy('add');
    try {
      const best = await detectBestModel(p);
      save([...ai.providers, best], ai.activeProvider || best.id);
      toast(t('ai.detected', { m: best.model || '—' }), 'success');
      setAdding(false); setKey(''); setBaseUrl('');
    } catch (e) {
      toast(t('ai.keyError') + ' ' + String((e as Error).message), 'error');
    } finally {
      setBusy('');
    }
  };

  const redetect = async (p: AiProvider) => {
    setBusy(p.id);
    try {
      const best = await detectBestModel({ ...p, autoModel: true });
      save(ai.providers.map((x) => (x.id === p.id ? best : x)));
      toast(t('ai.detected', { m: best.model || '—' }), 'success');
    } catch (e) {
      toast(t('ai.keyError') + ' ' + String((e as Error).message), 'error');
    } finally {
      setBusy('');
    }
  };

  const test = async (p: AiProvider) => {
    setBusy('t' + p.id);
    try {
      const r = await chat(p, 'Reply with one short friendly sentence.', [{ role: 'user', content: 'Say hello to the GCP-Neuro Notas user.' }]);
      toast('✓ ' + r.slice(0, 140), 'success');
    } catch (e) {
      toast(t('ai.keyError') + ' ' + String((e as Error).message), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Card icon={<Bot size={18} />} title={t('ai.providers')} subtitle={t('ai.providersHint')}>
        {!ai.providers.length && <div className="muted">{t('ai.none')}</div>}
        {ai.providers.map((p) => (
          <div key={p.id} className={'ai-row' + (ai.activeProvider === p.id ? ' active' : '')}>
            <div className="ai-logo">{p.name.slice(0, 1)}</div>
            <div className="grow">
              <b>{p.name}</b> {ai.activeProvider === p.id && <span className="pill c-green">{t('ai.active')}</span>}
              <small className="muted block">{p.apiKey ? '••••' + p.apiKey.slice(-4) : p.baseUrl} · {p.models?.length || 0} {t('ai.models')}</small>
              <div className="row wrap" style={{ marginTop: 8 }}>
                <Select
                  value={p.model}
                  options={(p.models || [p.model || '']).filter(Boolean).slice(0, 60).map((m, i) => ({ value: m, label: m, hint: i === 0 ? t('ai.recommended') : undefined }))}
                  onChange={(model) => save(ai.providers.map((x) => (x.id === p.id ? { ...x, model, autoModel: false } : x)))}
                  className="sm"
                />
                <Switch checked={p.autoModel !== false} onChange={(on) => save(ai.providers.map((x) => (x.id === p.id ? { ...x, autoModel: on, model: on ? x.models?.[0] || x.model : x.model } : x)))} label={t('ai.autoModel')} />
              </div>
            </div>
            <div className="col-actions">
              {ai.activeProvider !== p.id && <button className="btn ghost sm" onClick={() => save(ai.providers, p.id)}>{t('ai.useThis')}</button>}
              <button className="btn ghost sm" onClick={() => redetect(p)} disabled={!!busy}>{busy === p.id ? <Spinner /> : <RefreshCw size={14} />} {t('ai.detect')}</button>
              <button className="btn ghost sm" onClick={() => test(p)} disabled={!!busy}>{busy === 't' + p.id ? <Spinner /> : <Check size={14} />} {t('ai.test')}</button>
              <button className="icon-btn sm" onClick={() => save(ai.providers.filter((x) => x.id !== p.id), ai.activeProvider === p.id ? ai.providers.find((x) => x.id !== p.id)?.id || '' : ai.activeProvider)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="stack add-box">
            <Field label={t('ai.key')}>
              <PasswordInput value={key} onChange={(k) => { setKey(k); const g = guessProvider(k); if (g) setKind(g); }} placeholder={providerMeta(kind).hint || 'API key'} autoFocus />
            </Field>
            <div className="two">
              <Field label={t('ai.provider')}>
                <Select value={kind} options={PROVIDERS.map((p) => ({ value: p.kind, label: p.name }))} onChange={setKind} />
              </Field>
              {(kind === 'ollama' || kind === 'custom') && (
                <Field label="URL"><input className="input" value={baseUrl} placeholder={providerMeta(kind).baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></Field>
              )}
            </div>
            {providerMeta(kind).keyUrl && <button className="link-btn" onClick={() => openUrl(providerMeta(kind).keyUrl)}><ExternalLink size={13} /> {t('ai.getKey')}</button>}
            <div className="row">
              <button className="btn ghost" onClick={() => setAdding(false)}>{t('common.cancel')}</button>
              <button className="btn primary" onClick={add} disabled={busy === 'add' || (providerMeta(kind).needsKey && !key.trim())}>
                {busy === 'add' ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} {t('ai.addDetect')}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={15} /> {t('ai.add')}</button>
        )}
      </Card>
      <Card icon={<BrainCircuit size={18} />} title={t('ai.brainTitle')} subtitle={t('ai.brainHint')}>
        <Switch checked={ai.brain} onChange={(b) => v.updateSettings((s) => ((s.ai.brain = b), s))} label={t('ai.brainToggle')} />
        <div className="callout-box"><Shield size={16} /> <span>{t('ai.privacy')}</span></div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------- atualizações

function Updates() {
  const t = useT();
  const lang = useLang();
  const prefs = usePrefs();
  const [state, setState] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true);
    const r = await checkForUpdate();
    setState(r);
    setBusy(false);
    if (r.status === 'available') window.dispatchEvent(new CustomEvent('gcp-update', { detail: r.release }));
  };
  useEffect(() => void check(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const freq: UpdateFrequency[] = ['startup', 'daily', 'weekly', 'biweekly', 'monthly', 'never'];
  return (
    <Card icon={<CloudUpload size={18} />} title={t('updates.title')} subtitle={t('updates.subtitle')}>
      <div className="status-box">
        <b>{t('updates.installed')}: {APP_VERSION}</b>
        <small className="muted">
          {busy ? t('updates.checking') : state?.status === 'latest' ? t('updates.latest') : state?.status === 'available' ? t('updates.available', { v: state.release.version }) : state?.status === 'error' ? t('updates.error') : ''}
          {prefs.lastUpdateCheck ? ` · ${t('updates.lastCheck')} ${formatDate(prefs.lastUpdateCheck, LOCALES[lang], { dateStyle: 'short', timeStyle: 'short' })}` : ''}
        </small>
      </div>
      <Field label={t('updates.frequency')}>
        <Select value={prefs.updateFrequency} options={freq.map((f) => ({ value: f, label: t(`updates.freq.${f}` as TKey) }))} onChange={(f) => prefs.set({ updateFrequency: f })} />
      </Field>
      <div className="row">
        <button className="btn ghost" onClick={check} disabled={busy}>{busy ? <Spinner /> : <RefreshCw size={15} />} {t('updates.check')}</button>
        {state?.status === 'available' && <button className="btn update" onClick={() => window.dispatchEvent(new CustomEvent('gcp-update-open', { detail: state.release }))}><Download size={15} /> {t('update.button', { v: state.release.version })}</button>}
        <div className="grow" />
        <button className="link-btn" onClick={() => openUrl(RELEASES_URL)}><ExternalLink size={14} /> {t('updates.github')}</button>
      </div>
    </Card>
  );
}

export function useGoSettings() {
  return (tab: string) => useUi.getState().go({ name: 'settings', tab });
}
