import { useState } from 'react';
import { Bell, Mail, Pencil, Plus, Archive, Trash2, Zap } from 'lucide-react';
import type { Automation, DatabaseData, Row } from '../lib/types';
import { useT } from '../i18n';
import { Modal, Select } from '../components/ui';
import { uid } from '../lib/crypto';
import { useVault } from '../store/vault';
import { sendMail, systemNotify } from '../lib/alerts';
import { cellText, titleProp } from './logic';

/** Executa as automações disparadas por uma mudança (prev = null quando o registro acabou de ser criado). */
export function runAutomations(db: DatabaseData, prev: Row | null, next: Row, where: string): Row {
  const list = (db.automations || []).filter((a) => a.enabled);
  if (!list.length) return next;
  let row = next;
  const title = String(next.cells[titleProp(db).id] || '—');
  for (const a of list) {
    const tg = a.trigger;
    let fired = false;
    if (tg.type === 'created') fired = prev === null;
    else if (tg.type === 'status') fired = !!prev && prev.cells[tg.prop] !== next.cells[tg.prop] && next.cells[tg.prop] === tg.to;
    else if (tg.type === 'checked') fired = !!prev && !prev.cells[tg.prop] && !!next.cells[tg.prop];
    if (!fired) continue;
    const msg = `${a.name || 'Automação'}: ${title} — ${where}`;
    for (const act of a.actions) {
      if (act.type === 'notify') void systemNotify(a.name || 'GCP-Neuro Notas', `${title} — ${where}`);
      else if (act.type === 'email') void sendMail(useVault.getState().settings.mail, msg, msg, undefined, act.to).catch(() => {});
      else if (act.type === 'set') row = { ...row, cells: { ...row.cells, [act.prop]: act.value } };
      else if (act.type === 'archive') row = { ...row, archivedAt: Date.now() };
    }
    row = { ...row, activity: [...(row.activity || []), { id: uid('ac'), at: Date.now(), text: `⚡ ${a.name || 'Automação'}` }] };
  }
  return row;
}

export function AutomationsModal({ db, open, onClose, save }: { db: DatabaseData; open: boolean; onClose: () => void; save: (d: DatabaseData) => void }) {
  const t = useT();
  const list = db.automations || [];
  const status = db.properties.filter((p) => p.type === 'status' || p.type === 'select');
  const checks = db.properties.filter((p) => p.type === 'checkbox');
  const settable = db.properties.filter((p) => ['status', 'select', 'checkbox', 'text', 'number', 'date'].includes(p.type));
  const [editing, setEditing] = useState<string | null>(null);
  const put = (a: Automation) => save({ ...db, automations: list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a] });
  const add = () => {
    const a: Automation = {
      id: uid('au'), name: t('auto.newName'), enabled: true,
      trigger: status[0] ? { type: 'status', prop: status[0].id, to: status[0].options?.[status[0].options.length - 1]?.id || '' } : { type: 'created' },
      actions: [{ type: 'notify' }],
    };
    put(a);
    setEditing(a.id);
  };
  const describe = (a: Automation) => {
    const tg = a.trigger;
    const p = db.properties.find((x) => 'prop' in tg && x.id === tg.prop);
    const when = tg.type === 'created' ? t('auto.t.created') : tg.type === 'checked' ? `${t('auto.t.checked')} ${p?.name || ''}` : tg.type === 'status' ? `${p?.name || ''} → ${p ? cellText(p, tg.to) : ''}` : '';
    const acts = a.actions.map((x) => t(`auto.a.${x.type}` as any)).join(' + ');
    return `${t('auto.when')} ${when} · ${t('auto.then')} ${acts}`;
  };
  return (
    <Modal open={open} onClose={onClose} title={<><Zap size={18} /> {t('auto.title')}</>} width={680}>
      <p className="muted small">{t('auto.hint')}</p>
      <div className="auto-list">
        {list.map((a) => {
          const tg = a.trigger;
          const prop = db.properties.find((x) => 'prop' in tg && x.id === tg.prop);
          return (
            <div key={a.id} className={'auto-item' + (a.enabled ? '' : ' off')}>
              <div className="auto-row">
                <button className={'switch' + (a.enabled ? ' on' : '')} onClick={() => put({ ...a, enabled: !a.enabled })}><span /></button>
                <input className="auto-name" value={a.name} onChange={(e) => put({ ...a, name: e.target.value })} />
                <button className="icon-btn xs" onClick={() => setEditing(editing === a.id ? null : a.id)}><Pencil size={13} /></button>
                <button className="icon-btn xs danger-h" onClick={() => save({ ...db, automations: list.filter((x) => x.id !== a.id) })}><Trash2 size={13} /></button>
              </div>
              <div className="muted small">{describe(a)}</div>
              {editing === a.id && (
                <div className="auto-edit">
                  <label>{t('auto.when')}</label>
                  <Select
                    value={tg.type}
                    options={[
                      ...(status.length ? [{ value: 'status', label: t('auto.t.status') }] : []),
                      ...(checks.length ? [{ value: 'checked', label: t('auto.t.checked') }] : []),
                      { value: 'created', label: t('auto.t.created') },
                    ]}
                    onChange={(v) => put({ ...a, trigger: v === 'created' ? { type: 'created' } : v === 'checked' ? { type: 'checked', prop: checks[0].id } : { type: 'status', prop: status[0].id, to: status[0].options?.[0]?.id || '' } })}
                  />
                  {tg.type === 'status' && (
                    <>
                      <Select value={tg.prop} options={status.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => put({ ...a, trigger: { ...tg, prop: v, to: status.find((x) => x.id === v)?.options?.[0]?.id || '' } })} />
                      <Select value={tg.to} options={(prop?.options || []).map((o) => ({ value: o.id, label: `${t('auto.becomes')} ${o.label}` }))} onChange={(v) => put({ ...a, trigger: { ...tg, to: v } })} />
                    </>
                  )}
                  {tg.type === 'checked' && <Select value={tg.prop} options={checks.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => put({ ...a, trigger: { ...tg, prop: v } })} />}
                  <label>{t('auto.then')}</label>
                  {a.actions.map((act, i) => (
                    <div key={i} className="auto-act">
                      <Select
                        value={act.type}
                        options={(['notify', 'email', 'set', 'archive'] as const).map((x) => ({ value: x, label: t(`auto.a.${x}`) }))}
                        onChange={(v) => put({ ...a, actions: a.actions.map((y, j) => (j === i ? (v === 'set' ? { type: 'set', prop: settable[0]?.id || '', value: '' } : v === 'email' ? { type: 'email' } : { type: v as any }) : y)) })}
                      />
                      {act.type === 'email' && <input className="input sm" placeholder={t('auto.emailTo')} value={act.to || ''} onChange={(e) => put({ ...a, actions: a.actions.map((y, j) => (j === i ? { ...act, to: e.target.value } : y)) })} />}
                      {act.type === 'set' && (() => {
                        const sp = settable.find((x) => x.id === act.prop) || settable[0];
                        return (
                          <>
                            <Select value={act.prop} options={settable.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => put({ ...a, actions: a.actions.map((y, j) => (j === i ? { ...act, prop: v, value: '' } : y)) })} />
                            {sp?.options ? (
                              <Select value={String(act.value || '')} options={sp.options.map((o) => ({ value: o.id, label: o.label }))} onChange={(v) => put({ ...a, actions: a.actions.map((y, j) => (j === i ? { ...act, value: v } : y)) })} />
                            ) : sp?.type === 'checkbox' ? (
                              <Select value={act.value ? '1' : ''} options={[{ value: '1', label: '✔' }, { value: '', label: '✘' }]} onChange={(v) => put({ ...a, actions: a.actions.map((y, j) => (j === i ? { ...act, value: !!v } : y)) })} />
                            ) : (
                              <input className="input sm" value={String(act.value ?? '')} onChange={(e) => put({ ...a, actions: a.actions.map((y, j) => (j === i ? { ...act, value: e.target.value } : y)) })} />
                            )}
                          </>
                        );
                      })()}
                      <button className="icon-btn xs danger-h" disabled={a.actions.length < 2} onClick={() => put({ ...a, actions: a.actions.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  <button className="btn ghost xs" onClick={() => put({ ...a, actions: [...a.actions, { type: 'notify' }] })}><Plus size={13} /> {t('auto.addAction')}</button>
                </div>
              )}
            </div>
          );
        })}
        {!list.length && (
          <div className="auto-empty">
            <span><Bell size={16} /> <Mail size={16} /> <Archive size={16} /></span>
            <p className="muted small">{t('auto.empty')}</p>
          </div>
        )}
      </div>
      <button className="btn primary sm" onClick={add}><Plus size={14} /> {t('auto.add')}</button>
    </Modal>
  );
}
