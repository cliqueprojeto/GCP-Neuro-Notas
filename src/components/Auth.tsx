import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, Download, Eye, EyeOff, KeyRound, Lock, ShieldCheck, Sparkles, Upload, Cloud } from 'lucide-react';
import { useT, useLang } from '../i18n';
import { usePrefs, type Lang } from '../store/prefs';
import { useVault } from '../store/vault';
import { passwordStrength } from '../lib/crypto';
import { copyText, saveTextFile } from '../lib/platform';
import { toast } from '../store/ui';
import { ThemeGrid } from './Topbar';
import { Spinner } from './ui';
import { TEMPLATES, instantiate, CATEGORY_ICONS } from '../templates/templates';
import { pickBackupFile, importBackup } from '../lib/transfer';
import { CloudRestoreModal } from './settings/CloudRestore';

function LangPicker() {
  const lang = useLang();
  const set = usePrefs((s) => s.set);
  return (
    <div className="lang-seg">
      {(['pt', 'en', 'es'] as Lang[]).map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} onClick={() => set({ lang: l })}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

export function PasswordInput({ value, onChange, placeholder, autoFocus, onEnter }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onEnter?: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pass-input">
      <input className="input lg" type={show ? 'text' : 'password'} value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onEnter?.()} autoComplete="current-password" />
      <button type="button" className="icon-btn" onClick={() => setShow(!show)} tabIndex={-1}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </div>
  );
}

export function StrengthMeter({ password }: { password: string }) {
  const t = useT();
  const s = passwordStrength(password);
  const labels = ['', t('pw.weak'), t('pw.fair'), t('pw.good'), t('pw.strong')];
  return (
    <div className={`strength s${s}`}>
      <div className="strength-bars">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= s ? 'on' : ''} />)}</div>
      <small>{labels[s]}</small>
    </div>
  );
}

// ------------------------------------------------------------------ login

export function LoginScreen() {
  const t = useT();
  const v = useVault();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [code, setCode] = useState('');
  const [np, setNp] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const wait = Math.max(0, Math.ceil((v.lockedUntil - now) / 1000));

  const unlock = async () => {
    if (!pw || busy || wait) return;
    setBusy(true);
    setError('');
    const ok = await v.unlock(pw);
    setBusy(false);
    if (!ok) {
      setError(t('login.wrong'));
      setPw('');
    }
  };
  const recover = async () => {
    if (np.length < 8) return setError(t('wizard.pwTooShort'));
    setBusy(true);
    const ok = await v.unlockWithRecovery(code, np);
    setBusy(false);
    if (!ok) setError(t('login.recoveryWrong'));
    else toast(t('login.recovered'), 'success');
  };

  return (
    <div className="auth-screen">
      <div className="auth-bg" />
      <div className="auth-top"><LangPicker /></div>
      <div className="auth-card">
        <img src="/logo.svg" className="auth-logo" alt="" />
        <h1>GCP Notas</h1>
        {mode === 'login' ? (
          <>
            <p className="muted">{t('login.subtitle')}</p>
            <PasswordInput value={pw} onChange={setPw} placeholder={t('login.password')} autoFocus onEnter={unlock} />
            {v.header?.hint && <small className="muted">💡 {t('login.hint')}: {v.header.hint}</small>}
            {error && <div className="error">{error}</div>}
            {wait > 0 && <div className="error">{t('login.wait', { s: wait })}</div>}
            <button className="btn primary lg block" onClick={unlock} disabled={busy || !pw || wait > 0}>
              {busy ? <Spinner /> : <Lock size={17} />} {busy ? t('login.unlocking') : t('login.unlock')}
            </button>
            <button className="link-btn" onClick={() => (setMode('recover'), setError(''))}>{t('login.forgot')}</button>
          </>
        ) : (
          <>
            <p className="muted">{t('login.recoverText')}</p>
            <input className="input lg mono" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            <PasswordInput value={np} onChange={setNp} placeholder={t('wizard.newPassword')} onEnter={recover} />
            <StrengthMeter password={np} />
            {error && <div className="error">{error}</div>}
            <button className="btn primary lg block" onClick={recover} disabled={busy || !code || !np}>
              {busy ? <Spinner /> : <KeyRound size={17} />} {t('login.recover')}
            </button>
            <button className="link-btn" onClick={() => (setMode('login'), setError(''))}><ArrowLeft size={14} /> {t('common.back')}</button>
          </>
        )}
        <div className="auth-foot muted small"><ShieldCheck size={14} /> {t('login.secure')}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- wizard

const STARTERS = ['brain', 'dashboard', 'project', 'passwords', 'journal', 'reading', 'budget', 'meeting'];

export function Wizard() {
  const t = useT();
  const lang = useLang();
  const v = useVault();
  const [step, setStep] = useState(0);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [saved, setSaved] = useState(false);
  const [picked, setPicked] = useState<string[]>(['brain', 'dashboard', 'passwords']);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const steps = [t('wizard.s.welcome'), t('wizard.s.theme'), t('wizard.s.password'), t('wizard.s.recovery'), t('wizard.s.start')];

  const create = async () => {
    if (pw.length < 8) return toast(t('wizard.pwTooShort'), 'error');
    if (pw !== pw2) return toast(t('wizard.pwMismatch'), 'error');
    setBusy(true);
    try {
      const code = await v.createVault(pw, hint);
      // O cofre só "abre" de fato ao final do assistente.
      setRecovery(code);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setFinishing(true);
    const vs = useVault.getState();
    for (const id of picked) {
      const tpl = TEMPLATES.find((x) => x.id === id);
      if (tpl) instantiate(tpl, lang, null, vs.createPage);
    }
    vs.createPage({
      title: t('welcome.title'),
      icon: '👋',
      cover: 'g:0',
      content: (await import('../lib/transfer')).htmlToDoc(t('welcome.html')),
      favorite: true,
      order: 0.5,
    });
    await vs.flush();
    localStorage.setItem('gcp-notas:onboarded', '1');
    window.dispatchEvent(new Event('gcp-onboarded'));
  };

  const importFile = async () => {
    try {
      const f = await pickBackupFile();
      if (!f) return;
      const pass = window.prompt(t('backup.filePassword')) || '';
      const n = await importBackup(f, pass, 'merge');
      toast(t('backup.imported', { n }), 'success');
      localStorage.setItem('gcp-notas:onboarded', '1');
      window.dispatchEvent(new Event('gcp-onboarded'));
    } catch (e) {
      toast(t('backup.importError') + ' ' + String((e as Error).message), 'error');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-bg" />
      <div className="auth-top"><LangPicker /></div>
      <div className="wizard">
        <div className="wizard-steps">
          {steps.map((s, i) => (
            <div key={s} className={'wstep' + (i === step ? ' on' : '') + (i < step ? ' done' : '')}>
              <span>{i < step ? <Check size={13} /> : i + 1}</span> <b>{s}</b>
            </div>
          ))}
        </div>
        <div className="wizard-body">
          {step === 0 && (
            <div className="wz-center">
              <img src="/logo.svg" className="auth-logo xl" alt="" />
              <h1>{t('wizard.welcome')}</h1>
              <p className="lead">{t('wizard.welcomeText')}</p>
              <div className="feature-pills">
                {['wizard.f1', 'wizard.f2', 'wizard.f3', 'wizard.f4', 'wizard.f5', 'wizard.f6'].map((k) => <span key={k} className="chip static">{t(k as any)}</span>)}
              </div>
              <div className="field">
                <span className="field-label">{t('settings.language')}</span>
                <LangPicker />
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <h2>{t('wizard.themeTitle')}</h2>
              <p className="muted">{t('wizard.themeText')}</p>
              <ThemeGrid large />
            </div>
          )}
          {step === 2 && (
            <div className="wz-narrow">
              <h2><Lock size={22} /> {t('wizard.pwTitle')}</h2>
              <p className="muted">{t('wizard.pwText')}</p>
              <PasswordInput value={pw} onChange={setPw} placeholder={t('wizard.newPassword')} autoFocus />
              <StrengthMeter password={pw} />
              <PasswordInput value={pw2} onChange={setPw2} placeholder={t('wizard.confirmPassword')} onEnter={create} />
              <input className="input" placeholder={t('wizard.hint')} value={hint} onChange={(e) => setHint(e.target.value)} />
              <div className="callout-box"><ShieldCheck size={18} /> <span>{t('wizard.pwInfo')}</span></div>
            </div>
          )}
          {step === 3 && (
            <div className="wz-narrow">
              <h2><KeyRound size={22} /> {t('wizard.recTitle')}</h2>
              <p className="muted">{t('wizard.recText')}</p>
              <div className="recovery-code">{recovery}</div>
              <div className="row">
                <button className="btn ghost" onClick={() => copyText(recovery).then(() => toast(t('common.copied'), 'success'))}><Copy size={15} /> {t('common.copy')}</button>
                <button className="btn ghost" onClick={() => saveTextFile('GCP-Notas-chave-de-recuperacao.txt', `GCP Notas\n\n${t('wizard.recTitle')}:\n${recovery}\n`, [{ name: 'TXT', extensions: ['txt'] }])}><Download size={15} /> {t('common.download')}</button>
              </div>
              <label className="check big"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> {t('wizard.recSaved')}</label>
            </div>
          )}
          {step === 4 && (
            <div>
              <h2><Sparkles size={22} /> {t('wizard.startTitle')}</h2>
              <p className="muted">{t('wizard.startText')}</p>
              <div className="starter-grid">
                {STARTERS.map((id) => {
                  const tpl = TEMPLATES.find((x) => x.id === id)!;
                  const on = picked.includes(id);
                  return (
                    <button key={id} className={'starter' + (on ? ' on' : '')} onClick={() => setPicked(on ? picked.filter((x) => x !== id) : [...picked, id])}>
                      <span className="starter-icon">{tpl.icon}</span>
                      <b>{tpl.title[lang]}</b>
                      <small>{tpl.description[lang]}</small>
                      <span className="starter-check">{on && <Check size={14} />}</span>
                      <span className="starter-cat">{CATEGORY_ICONS[tpl.category]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="row wrap">
                <span className="muted small">{t('wizard.orRestore')}</span>
                <button className="btn ghost sm" onClick={importFile}><Upload size={14} /> {t('backup.importFile')}</button>
                <button className="btn ghost sm" onClick={() => setCloudOpen(true)}><Cloud size={14} /> {t('backup.restoreCloud')}</button>
              </div>
            </div>
          )}
        </div>
        <div className="wizard-foot">
          {step > 0 && step < 3 && <button className="btn ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> {t('common.back')}</button>}
          <div className="grow" />
          {step < 2 && <button className="btn primary lg" onClick={() => setStep(step + 1)}>{t('common.next')} <ArrowRight size={16} /></button>}
          {step === 2 && <button className="btn primary lg" onClick={create} disabled={busy || !pw || !pw2}>{busy ? <Spinner /> : <Lock size={16} />} {t('wizard.createVault')}</button>}
          {step === 3 && <button className="btn primary lg" onClick={() => setStep(4)} disabled={!saved}>{t('common.next')} <ArrowRight size={16} /></button>}
          {step === 4 && <button className="btn primary lg" onClick={finish} disabled={finishing}>{finishing ? <Spinner /> : <Check size={16} />} {t('wizard.finish')}</button>}
        </div>
      </div>
      <CloudRestoreModal open={cloudOpen} onClose={() => setCloudOpen(false)} onDone={() => { localStorage.setItem('gcp-notas:onboarded', '1'); window.dispatchEvent(new Event('gcp-onboarded')); }} />
    </div>
  );
}
