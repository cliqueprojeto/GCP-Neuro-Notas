/**
 * Alertas e notificações (tudo local, sem servidor):
 * prazos vencidos, de hoje e próximos; lembretes de páginas e cartões; temporizadores esgotados.
 */
import type { DatabaseData, MailSettings, Page, Row } from './types';
import { isRowDone, timerBudget, timerElapsed, titleProp } from '../database/logic';
import { localIso, fmtDate, fmtDateTime } from './dates';
import { isTauri, openUrl } from './platform';
import { t } from '../i18n';

export type AlertKind = 'overdue' | 'today' | 'soon' | 'reminder' | 'timer';
export interface AlertItem {
  id: string; // estável: base + registro + motivo + data
  kind: AlertKind;
  pageId: string;
  rowId?: string;
  title: string;
  where: string;
  when: string; // ISO (data ou data/hora)
  done?: boolean;
}

const DAY = 86400000;

/** Campo de data principal de uma base (prazo/entrega/vencimento, senão o primeiro campo de data). */
export function dueProp(db: DatabaseData) {
  const dates = db.properties.filter((p) => p.type === 'date');
  return dates.find((p) => /prazo|entrega|venc|due|deadline|fecha|limite/i.test(p.name)) || dates[0];
}

/** Tarefas abertas (com prazo) e alertas de todas as bases e páginas. */
export function collect(pages: Record<string, Page>, daysAhead = 2, now = Date.now()) {
  const today = localIso(now);
  const soonLimit = localIso(now + daysAhead * DAY);
  const pending: AlertItem[] = [];
  const resolved: AlertItem[] = [];
  const alerts: AlertItem[] = [];
  for (const p of Object.values(pages)) {
    if (p.deletedAt || p.purged || p.archivedAt) continue;
    if (p.remindAt && new Date(p.remindAt).getTime() <= now)
      alerts.push({ id: `rp:${p.id}:${p.remindAt}`, kind: 'reminder', pageId: p.id, title: p.title || t('page.untitled'), where: t('alerts.page'), when: p.remindAt });
    const db = p.db;
    if (!db) continue;
    const due = dueProp(db);
    const tp = titleProp(db);
    const timers = db.properties.filter((x) => x.type === 'timer');
    for (const r of db.rows) {
      if (r.archivedAt) continue;
      const title = String(r.cells[tp.id] || t('page.untitled'));
      const done = isRowDone(db, r);
      const d: string | undefined = due ? r.cells[due.id] : undefined;
      const base = { pageId: p.id, rowId: r.id, title, where: p.title || t('page.untitled') };
      if (d) {
        const item: AlertItem = { ...base, id: `d:${r.id}:${d}`, kind: d < today ? 'overdue' : d === today ? 'today' : 'soon', when: d, done };
        if (done) resolved.push(item);
        else {
          pending.push(item);
          if (d <= soonLimit) alerts.push(item);
        }
      }
      if (!done && r.remindAt && new Date(r.remindAt).getTime() <= now)
        alerts.push({ ...base, id: `rr:${r.id}:${r.remindAt}`, kind: 'reminder', when: r.remindAt });
      for (const tm of timers) {
        const st = r.cells[tm.id];
        const budget = timerBudget(tm, r);
        if (!done && st && budget != null && budget > 0 && timerElapsed(st, now) >= budget)
          alerts.push({ ...base, id: `tm:${r.id}:${tm.id}:${budget}`, kind: 'timer', when: localIso(now) });
      }
    }
  }
  const order: Record<AlertKind, number> = { overdue: 0, reminder: 1, timer: 2, today: 3, soon: 4 };
  alerts.sort((a, b) => order[a.kind] - order[b.kind] || a.when.localeCompare(b.when));
  pending.sort((a, b) => a.when.localeCompare(b.when));
  resolved.sort((a, b) => b.when.localeCompare(a.when));
  return { pending, resolved, alerts };
}

export function alertLabel(a: AlertItem) {
  const when = a.when.length > 10 ? fmtDateTime(a.when) : fmtDate(a.when);
  return `${t(`alerts.kind.${a.kind}` as any)} · ${when}`;
}

/* ------------------------------------------------------- notificações */

let permission: boolean | null = null;

/** Notificação do sistema (Windows, macOS, Linux e Android); no navegador usa a Notification API. */
export async function systemNotify(title: string, body: string) {
  try {
    if (isTauri) {
      const n = await import('@tauri-apps/plugin-notification');
      if (permission === null) permission = await n.isPermissionGranted();
      if (!permission) permission = (await n.requestPermission()) === 'granted';
      if (permission) n.sendNotification({ title, body });
      return permission;
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission === 'granted') new Notification(title, { body, icon: '/logo.svg' });
    return Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** E-mail pelo SMTP do próprio usuário; sem SMTP configurado (ou no navegador), abre o app de e-mail. */
export async function sendMail(mail: MailSettings | undefined, subject: string, text: string, html?: string, to?: string): Promise<'sent' | 'client'> {
  const dest = (to || mail?.to || mail?.from || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  if (isTauri && mail?.enabled && mail.host && mail.user && mail.password && dest.length) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('send_email', {
      req: { host: mail.host, port: mail.port, security: mail.security, user: mail.user, password: mail.password, from: mail.from || mail.user, to: dest, subject, text, html: html ?? null },
    });
    return 'sent';
  }
  await openUrl(`mailto:${encodeURIComponent(dest.join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`);
  return 'client';
}

/** Resumo de alertas em texto e HTML (para e-mail). */
export function digest(items: AlertItem[]) {
  const lines = items.map((a) => `• ${a.title} — ${a.where} (${alertLabel(a)})`);
  const text = `${t('alerts.mailIntro')}\n\n${lines.join('\n')}\n\n— GCP-Neuro Notas`;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#1c1840"><h2 style="margin:0 0 8px">GCP-Neuro Notas</h2><p>${esc(t('alerts.mailIntro'))}</p><ul>${items
    .map((a) => `<li><b>${esc(a.title)}</b> — ${esc(a.where)} <span style="color:${a.kind === 'overdue' ? '#c81e1e' : '#6b6596'}">(${esc(alertLabel(a))})</span></li>`)
    .join('')}</ul></div>`;
  return { text, html };
}

export type { Row };
