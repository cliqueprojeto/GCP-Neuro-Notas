import { useState } from 'react';
import { BellRing, Mail, Send } from 'lucide-react';
import { useT } from '../../i18n';
import { useVault } from '../../store/vault';
import { toast } from '../../store/ui';
import { Field, Select, Switch } from '../ui';
import { PasswordInput } from '../Auth';
import { isTauri } from '../../lib/platform';
import type { MailSettings } from '../../lib/types';
import { sendMail, systemNotify } from '../../lib/alerts';
import { Card } from './Settings';

const PRESETS: Record<string, Partial<MailSettings>> = {
  gmail: { host: 'smtp.gmail.com', port: 465, security: 'ssl' },
  outlook: { host: 'smtp.office365.com', port: 587, security: 'starttls' },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 465, security: 'ssl' },
  zoho: { host: 'smtp.zoho.com', port: 465, security: 'ssl' },
  locaweb: { host: 'email-ssl.com.br', port: 465, security: 'ssl' },
  hostinger: { host: 'smtp.hostinger.com', port: 465, security: 'ssl' },
};
const EMPTY: MailSettings = { enabled: false, host: '', port: 465, security: 'ssl', user: '', password: '', from: '', to: '', onAlerts: true, digest: false };

export function AlertsSettings() {
  const t = useT();
  const settings = useVault((s) => s.settings);
  const up = useVault((s) => s.updateSettings);
  const al = settings.alerts || {};
  const mail: MailSettings = { ...EMPTY, ...(settings.mail || {}) };
  const setA = (p: Partial<NonNullable<typeof settings.alerts>>) => up((s) => ({ ...s, alerts: { ...(s.alerts || {}), ...p } }));
  const setM = (p: Partial<MailSettings>) => up((s) => ({ ...s, mail: { ...EMPTY, ...(s.mail || {}), ...p } }));
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true);
    try {
      const how = await sendMail(mail, t('alerts.testSubject'), t('alerts.testBody'));
      toast(how === 'sent' ? t('alerts.mailSent') : t('alerts.mailClient'), 'success');
    } catch (e) {
      toast(t('alerts.mailError') + ' ' + String((e as Error).message || e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Card icon={<BellRing size={18} />} title={t('alerts.cfgTitle')} subtitle={t('alerts.cfgSub')}>
        <Switch checked={al.enabled !== false} onChange={(v) => setA({ enabled: v })} label={t('alerts.enabled')} />
        <Switch checked={al.desktop !== false} onChange={(v) => setA({ desktop: v })} label={t('alerts.desktop')} />
        <Field label={t('alerts.daysAhead')}>
          <Select value={String(al.daysAhead ?? 2)} options={[0, 1, 2, 3, 5, 7].map((d) => ({ value: String(d), label: d === 0 ? t('alerts.onlyToday') : t('alerts.days', { n: d }) }))} onChange={(v) => setA({ daysAhead: +v })} />
        </Field>
        <div className="row gap-sm">
          <button className="btn ghost sm" onClick={async () => toast((await systemNotify('GCP-Neuro Notas', t('alerts.testBody'))) ? t('alerts.notifyOk') : t('alerts.notifyDenied'), 'info')}><BellRing size={14} /> {t('alerts.testNotify')}</button>
          {(al.resolved?.length || 0) > 0 && <button className="btn ghost sm" onClick={() => setA({ resolved: [] })}>{t('alerts.unhide', { n: al.resolved!.length })}</button>}
        </div>
      </Card>

      <Card icon={<Mail size={18} />} title={t('alerts.mailTitle')} subtitle={t('alerts.mailSub')}>
        <Switch checked={mail.enabled} onChange={(v) => setM({ enabled: v })} label={t('alerts.mailEnabled')} />
        {!isTauri && <p className="muted small">{t('alerts.mailWeb')}</p>}
        {mail.enabled && (
          <>
            <Field label={t('alerts.provider')}>
              <Select value="" options={[{ value: '', label: t('alerts.pickProvider') }, ...Object.keys(PRESETS).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))]} onChange={(k) => k && setM(PRESETS[k])} />
            </Field>
            <div className="grid-2">
              <Field label={t('alerts.host')}><input className="input" value={mail.host} placeholder="smtp.gmail.com" onChange={(e) => setM({ host: e.target.value.trim() })} /></Field>
              <Field label={t('alerts.port')}>
                <div className="row gap-sm">
                  <input className="input" style={{ width: 90 }} inputMode="numeric" value={mail.port} onChange={(e) => setM({ port: Number(e.target.value) || 465 })} />
                  <Select value={mail.security} options={[{ value: 'ssl', label: 'SSL/TLS' }, { value: 'starttls', label: 'STARTTLS' }, { value: 'none', label: t('alerts.noTls') }]} onChange={(v) => setM({ security: v as any })} />
                </div>
              </Field>
              <Field label={t('alerts.user')}><input className="input" value={mail.user} autoComplete="off" onChange={(e) => setM({ user: e.target.value.trim() })} /></Field>
              <Field label={t('alerts.password')} hint={t('alerts.passwordHint')}><PasswordInput value={mail.password} onChange={(v: string) => setM({ password: v })} /></Field>
              <Field label={t('alerts.from')}><input className="input" value={mail.from} placeholder={mail.user} onChange={(e) => setM({ from: e.target.value })} /></Field>
              <Field label={t('alerts.to')}><input className="input" value={mail.to} placeholder={mail.user} onChange={(e) => setM({ to: e.target.value })} /></Field>
            </div>
            <Switch checked={mail.onAlerts} onChange={(v) => setM({ onAlerts: v })} label={t('alerts.mailOnAlerts')} />
            <div className="row gap-sm">
              <button className="btn primary sm" disabled={busy} onClick={test}><Send size={14} /> {t('alerts.sendTest')}</button>
            </div>
            <p className="muted small">{t('alerts.privacy')}</p>
          </>
        )}
      </Card>
    </>
  );
}
