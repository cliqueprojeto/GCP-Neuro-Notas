import { useEffect, useMemo, useRef, useState } from 'react';
import { AlarmClock, Bell, BellRing, CalendarClock, CheckCircle2, Circle, Clock, Mail, RotateCcw, Settings2, Timer, TriangleAlert } from 'lucide-react';
import { useT, type TKey } from '../i18n';
import { useVault } from '../store/vault';
import { toast, useUi } from '../store/ui';
import { Popover } from './ui';
import { alertLabel, collect, digest, sendMail, systemNotify, type AlertItem } from '../lib/alerts';
import { setRowDone } from '../database/logic';
import { localIso } from '../lib/dates';

const ICONS: Record<AlertItem['kind'], any> = { overdue: TriangleAlert, today: CalendarClock, soon: Clock, reminder: AlarmClock, timer: Timer };

/** Abre o cartão/página de um alerta. */
export function openAlert(a: AlertItem) {
  const ui = useUi.getState();
  if (a.rowId) ui.set({ pendingRow: { pageId: a.pageId, rowId: a.rowId } });
  ui.go({ name: 'page', id: a.pageId });
}

/** Resolve (conclui) ou reabre o registro de um alerta; lembretes de página são apagados. */
export function resolveAlert(a: AlertItem, done: boolean) {
  const v = useVault.getState();
  const p = v.pages[a.pageId];
  if (!p) return;
  if (!a.rowId) return v.updatePage(p.id, { remindAt: undefined });
  if (!p.db) return;
  const db = p.db;
  const rows = db.rows.map((r) => {
    if (r.id !== a.rowId) return r;
    let nr = a.kind === 'reminder' && done ? { ...r, remindAt: undefined } : setRowDone(db, r, done);
    nr = { ...nr, activity: [...(nr.activity || []), { id: 'ac' + Date.now(), at: Date.now(), text: done ? 'Resolvido pela central de notificações' : 'Reaberto pela central de notificações' }] };
    return nr;
  });
  v.updatePage(p.id, { db: { ...db, rows } });
}

/** Adia um alerta: lembrete para amanhã às 9h. */
function snooze(a: AlertItem) {
  const v = useVault.getState();
  const p = v.pages[a.pageId];
  if (!p) return;
  const at = localIso(Date.now() + 86400000) + 'T09:00';
  if (!a.rowId) return v.updatePage(p.id, { remindAt: at });
  if (!p.db) return;
  v.updatePage(p.id, { db: { ...p.db, rows: p.db.rows.map((r) => (r.id === a.rowId ? { ...r, remindAt: at } : r)) } });
  // o alerta de prazo some até amanhã
  v.updateSettings((s) => ({ ...s, alerts: { ...(s.alerts || {}), resolved: [...(s.alerts?.resolved || []), a.id].slice(-500) } }));
}

export function NotificationBell() {
  const t = useT();
  const pages = useVault((s) => s.pages);
  const settings = useVault((s) => s.settings);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'pending' | 'resolved' | 'alerts'>('alerts');
  const ref = useRef<HTMLButtonElement>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const h = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(h); }, []);
  const hidden = settings.alerts?.resolved || [];
  const data = useMemo(() => collect(pages, settings.alerts?.daysAhead ?? 2), [pages, settings.alerts?.daysAhead, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const alerts = data.alerts.filter((a) => !hidden.includes(a.id));
  const list = tab === 'alerts' ? alerts : tab === 'pending' ? data.pending : data.resolved.slice(0, 60);
  const go = (a: AlertItem) => { setOpen(false); openAlert(a); };
  const mailNow = async () => {
    if (!alerts.length) return toast(t('alerts.none'), 'info');
    const d = digest(alerts);
    try {
      const how = await sendMail(settings.mail, t('alerts.mailSubject', { n: alerts.length }), d.text, d.html);
      toast(how === 'sent' ? t('alerts.mailSent') : t('alerts.mailClient'), 'success');
    } catch (e) {
      toast(t('alerts.mailError') + ' ' + String((e as Error).message || e), 'error');
    }
  };

  return (
    <>
      <button ref={ref} className={'icon-btn boxed bell' + (alerts.length ? ' has' : '')} onClick={() => setOpen(!open)} title={t('alerts.title')}>
        {alerts.length ? <BellRing size={17} /> : <Bell size={17} />}
        {alerts.length > 0 && <span className="bell-badge">{alerts.length > 99 ? '99+' : alerts.length}</span>}
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} align="right" className="notif-pop">
        <div className="notif">
          <div className="notif-head">
            <Bell size={18} /> <b className="grow">{t('alerts.title')}</b>
            <button className="icon-btn xs" title={t('alerts.mailNow')} onClick={mailNow}><Mail size={14} /></button>
            <button className="icon-btn xs" title={t('alerts.settings')} onClick={() => { setOpen(false); useUi.getState().go({ name: 'settings', tab: 'alerts' }); }}><Settings2 size={14} /></button>
          </div>
          <div className="notif-tabs">
            <button className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>{t('alerts.pending')} ({data.pending.length})</button>
            <button className={tab === 'resolved' ? 'on' : ''} onClick={() => setTab('resolved')}>{t('alerts.resolved')}</button>
            <button className={tab === 'alerts' ? 'on' : ''} onClick={() => setTab('alerts')}>{t('alerts.alerts')} {alerts.length > 0 && <span className="count">{alerts.length}</span>}</button>
          </div>
          <div className="notif-list">
            {list.map((a) => {
              const I = ICONS[a.kind];
              const isDone = tab === 'resolved';
              return (
                <div key={a.id} className={'notif-item k-' + (isDone ? 'done' : a.kind)}>
                  <span className="notif-ic"><I size={16} /></span>
                  <button className="notif-main" onClick={() => go(a)}>
                    <b>{a.title}</b>
                    <span>{a.where}</span>
                    <small>{alertLabel(a)}</small>
                  </button>
                  <div className="notif-actions">
                    {!isDone && tab === 'alerts' && <button className="icon-btn xs" title={t('alerts.snooze')} onClick={() => snooze(a)}><AlarmClock size={14} /></button>}
                    <button className="icon-btn xs" title={isDone ? t('alerts.reopen') : t('alerts.resolve')} onClick={() => resolveAlert(a, !isDone)}>
                      {isDone ? <RotateCcw size={15} /> : <><Circle size={15} className="ic-off" /><CheckCircle2 size={15} className="ic-on" /></>}
                    </button>
                  </div>
                </div>
              );
            })}
            {!list.length && <p className="muted small empty-note">{t(`alerts.empty.${tab}` as TKey)}</p>}
          </div>
        </div>
      </Popover>
    </>
  );
}

/** Verificação periódica: notifica alertas novos no sistema e, se configurado, por e-mail. */
export function useAlertScheduler() {
  useEffect(() => {
    let busy = false;
    const run = async () => {
      if (busy) return;
      const v = useVault.getState();
      if (v.status !== 'unlocked' || !v.settings) return;
      const cfg = v.settings.alerts || {};
      if (cfg.enabled === false) return;
      busy = true;
      try {
        const { alerts } = collect(v.pages, cfg.daysAhead ?? 2);
        const seen = new Set(cfg.notified || []);
        const hidden = new Set(cfg.resolved || []);
        const fresh = alerts.filter((a) => !seen.has(a.id) && !hidden.has(a.id) && a.kind !== 'soon');
        if (!fresh.length) return;
        if (cfg.desktop !== false) {
          if (fresh.length === 1) await systemNotify(fresh[0].title, `${fresh[0].where} · ${alertLabel(fresh[0])}`);
          else await systemNotify(`GCP-Neuro Notas — ${fresh.length}`, fresh.slice(0, 4).map((a) => `• ${a.title} (${alertLabel(a)})`).join('\n'));
        }
        const mail = v.settings.mail;
        if (mail?.enabled && mail.onAlerts) {
          const d = digest(fresh);
          try { await sendMail(mail, `GCP-Neuro Notas — ${fresh.length}`, d.text, d.html); } catch { /* sem rede: tenta de novo na próxima volta */ return; }
        }
        v.updateSettings((s) => ({ ...s, alerts: { ...(s.alerts || {}), notified: [...(s.alerts?.notified || []), ...fresh.map((a) => a.id)].slice(-800) } }));
      } finally {
        busy = false;
      }
    };
    const first = setTimeout(run, 8000);
    const h = setInterval(run, 60000);
    return () => (clearTimeout(first), clearInterval(h));
  }, []);
}
