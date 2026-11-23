import { useEffect, useRef, useState } from 'react';
import { Check, GripVertical, Pause, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useVault } from '../store/vault';
import { useUi } from '../store/ui';
import { PageIcon, Popover } from '../components/ui';
import { NeuroIcon } from '../components/NeuroIcon';
import type { CheckItem, LineItem, Property, Row, TimerState } from '../lib/types';
import { useT } from '../i18n';
import { DateInput } from '../components/DateInput';
import { uid } from '../lib/crypto';
import { formatCurrency } from './masks';
import { fmtDuration, itemsTotal, timerBudget, timerElapsed } from './logic';

/* ------------------------------------------------------------ texto longo */

export function LongTextCell({ value, onChange, readOnly, compact }: { value: string; onChange: (v: string) => void; readOnly?: boolean; compact?: boolean }) {
  const t = useT();
  if (compact || readOnly) return <span className="cell-longtext-ro">{value || ''}</span>;
  return (
    <textarea
      className="input cell-longtext"
      rows={3}
      value={value || ''}
      placeholder={t('work.longPh')}
      onChange={(e) => onChange(e.target.value)}
      onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }}
    />
  );
}

/* ------------------------------------------------------ produtos/serviços */

export function ItemsCell({ prop, value, onChange, readOnly, compact }: { prop: Property; value: LineItem[]; onChange: (v: LineItem[]) => void; readOnly?: boolean; compact?: boolean }) {
  const t = useT();
  const items = Array.isArray(value) ? value : [];
  const money = (n: number) => formatCurrency(n, prop.currency, prop.locale, prop.decimals);
  const tot = itemsTotal(items);
  if (compact) return items.length ? <span className="items-badge">{items.length} · {money(tot.total)}</span> : null;
  const set = (id: string, patch: Partial<LineItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const num = (s: string) => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
  return (
    <div className="items-cell">
      <div className="items-head">
        <span>{t('work.no')}</span><span>{t('work.desc')}</span><span className="r">{t('work.qty')}</span><span className="r">{t('work.unit')}</span><span className="r">{t('work.subtotal')}</span><span />
      </div>
      {items.map((it, i) => (
        <div key={it.id} className={'items-row' + (it.done ? ' done' : '')}>
          <button className={'cell-check' + (it.done ? ' on' : '')} title={t('work.markDone')} disabled={readOnly} onClick={() => set(it.id, { done: !it.done })}>
            {it.done ? <Check size={13} /> : <span className="items-n">{i + 1}</span>}
          </button>
          <input className="items-in" value={it.desc} readOnly={readOnly} placeholder={t('work.descPh')} onChange={(e) => set(it.id, { desc: e.target.value })} />
          <input className="items-in r" inputMode="decimal" value={it.qty} readOnly={readOnly} onChange={(e) => set(it.id, { qty: num(e.target.value) })} />
          <input className="items-in r" inputMode="decimal" defaultValue={String(it.unit).replace('.', ',')} readOnly={readOnly} onBlur={(e) => set(it.id, { unit: num(e.target.value) })} />
          <span className="r items-sub">{money((Number(it.qty) || 0) * (Number(it.unit) || 0))}</span>
          {!readOnly ? <button className="icon-btn xs danger-h" title={t('common.remove')} onClick={() => onChange(items.filter((x) => x.id !== it.id))}><Trash2 size={13} /></button> : <span />}
        </div>
      ))}
      <div className="items-totals">
        <div><span>{t('work.subDone')}</span><b className="ok">{money(tot.done)}</b></div>
        <div><span>{t('work.subPending')}</span><b className="warn">{money(tot.pending)}</b></div>
        <div className="grand"><span>{t('work.total')}</span><b>{money(tot.total)}</b></div>
      </div>
      {!readOnly && (
        <button className="btn ghost sm items-add" onClick={() => onChange([...items, { id: uid('li'), desc: '', qty: 1, unit: 0 }])}>
          <Plus size={14} /> {t('work.addItem')}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- subtarefas */

export function ChecklistCell({ value, onChange, readOnly, compact }: { value: CheckItem[]; onChange: (v: CheckItem[]) => void; readOnly?: boolean; compact?: boolean }) {
  const t = useT();
  const list = Array.isArray(value) ? value : [];
  const done = list.filter((c) => c.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const [draft, setDraft] = useState('');
  const [drag, setDrag] = useState<string | null>(null);
  if (compact)
    return list.length ? (
      <span className={'check-badge' + (done === list.length ? ' all' : '')}><Check size={12} /> {done}/{list.length}</span>
    ) : null;
  const set = (id: string, patch: Partial<CheckItem>) => onChange(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const add = () => {
    const txt = draft.trim();
    if (!txt) return;
    onChange([...list, { id: uid('ck'), text: txt, done: false }]);
    setDraft('');
  };
  return (
    <div className="checklist">
      <div className="check-progress">
        <span>{pct}%</span>
        <div className="bar"><i style={{ width: pct + '%' }} /></div>
        <span className="muted small">{done}/{list.length}</span>
      </div>
      {list.map((c) => (
        <div
          key={c.id}
          className={'check-item' + (c.done ? ' done' : '') + (drag === c.id ? ' dragging' : '')}
          draggable={!readOnly}
          onDragStart={() => setDrag(c.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (!drag || drag === c.id) return;
            const a = list.findIndex((x) => x.id === drag);
            const next = [...list];
            const [it] = next.splice(a, 1);
            next.splice(next.findIndex((x) => x.id === c.id), 0, it);
            onChange(next);
            setDrag(null);
          }}
          onDragEnd={() => setDrag(null)}
        >
          {!readOnly && <GripVertical size={14} className="check-grip" />}
          <button className={'cell-check' + (c.done ? ' on' : '')} disabled={readOnly} onClick={() => set(c.id, { done: !c.done })}>{c.done && <Check size={13} />}</button>
          <input className="check-text" value={c.text} readOnly={readOnly} onChange={(e) => set(c.id, { text: e.target.value })} />
          {c.done && <span className="pill c-green">{t('work.doneTag')}</span>}
          <DateInput className="check-date" value={c.due || ''} disabled={readOnly} onChange={(due) => set(c.id, { due })} />
          {!readOnly && <button className="icon-btn xs danger-h" title={t('common.remove')} onClick={() => onChange(list.filter((x) => x.id !== c.id))}><Trash2 size={13} /></button>}
        </div>
      ))}
      {!readOnly && (
        <div className="check-add">
          <Plus size={14} />
          <input value={draft} placeholder={t('work.addSub')} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} />
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- temporizador */

function useTick(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const h = setInterval(() => set((x) => x + 1), 1000);
    return () => clearInterval(h);
  }, [on]);
}

export function TimerCell({ prop, row, value, onChange, readOnly, compact }: { prop: Property; row: Row; value: TimerState | null; onChange: (v: TimerState) => void; readOnly?: boolean; compact?: boolean }) {
  const t = useT();
  const st: TimerState = value && typeof value === 'object' ? value : { elapsed: 0, start: null };
  const running = !!st.start && !st.frozen;
  useTick(running);
  const el = timerElapsed(st);
  const budget = timerBudget(prop, row);
  const shown = budget != null ? budget - el : el;
  const over = budget != null && shown < 0;
  const label = fmtDuration(shown);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly || st.frozen) return;
    onChange(running ? { elapsed: el, start: null } : { elapsed: st.elapsed || 0, start: Date.now() });
  };
  if (compact)
    return (st.elapsed || st.start) ? (
      <span className={'timer-badge' + (running ? ' run' : '') + (over ? ' over' : '') + (st.frozen ? ' frozen' : '')} onClick={toggle}>
        {running ? <Pause size={11} /> : <Play size={11} />} {label}
      </span>
    ) : null;
  return (
    <div className={'timer-cell' + (running ? ' run' : '') + (over ? ' over' : '') + (st.frozen ? ' frozen' : '')}>
      <button className="timer-btn" disabled={readOnly || st.frozen} onClick={toggle} title={running ? t('work.pause') : t('work.start')}>
        {running ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <span className="timer-val">{label}</span>
      <span className="muted small">
        {st.frozen ? t('work.timerFrozen') : budget != null ? (over ? t('work.timerOver') : t('work.timerLeft')) : t('work.timerUp')}
      </span>
      {!readOnly && !st.frozen && (st.elapsed > 0 || running) && (
        <button className="icon-btn xs" title={t('work.reset')} onClick={(e) => (e.stopPropagation(), onChange({ elapsed: 0, start: null }))}><RotateCcw size={13} /></button>
      )}
    </div>
  );
}

/* ------------------------------------------------- Neuro Links (relação) */

export function RelationCell({ value, onChange, readOnly, compact }: { value: string[]; onChange: (v: string[]) => void; readOnly?: boolean; compact?: boolean }) {
  const t = useT();
  const pages = useVault((s) => s.pages);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const ids = (Array.isArray(value) ? value : []).filter((id) => pages[id] && !pages[id].deletedAt);
  const opts = Object.values(pages).filter((p) => !p.deletedAt && !ids.includes(p.id) && (!q || (p.title || '').toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
  const chips = ids.map((id) => (
    <span key={id} className="rel-chip" onClick={(e) => { e.stopPropagation(); useUi.getState().go({ name: 'page', id }); }} title={t('db.open')}>
      <NeuroIcon size={11} /> {pages[id].title || t('page.untitled')}
      {!readOnly && !compact && <button className="rel-x" onClick={(e) => { e.stopPropagation(); onChange(ids.filter((x) => x !== id)); }}><X size={11} /></button>}
    </span>
  ));
  if (compact || readOnly) return <span className="rel-list">{chips}</span>;
  return (
    <div className="rel-cell" ref={ref}>
      {chips}
      <button className="rel-add" onClick={(e) => { e.stopPropagation(); setOpen(true); }}><Plus size={12} /> {t('rel.add')}</button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)}>
        <div className="rel-pop" onClick={(e) => e.stopPropagation()}>
          <input className="input" autoFocus placeholder={t('embed.searchPage')} value={q} onChange={(e) => setQ(e.target.value)} />
          {opts.map((p) => (
            <button key={p.id} className="menu-item" onClick={() => { onChange([...ids, p.id]); setQ(''); }}><PageIcon icon={p.icon} size={14} /> <span className="grow ellipsis">{p.title || t('page.untitled')}</span></button>
          ))}
          {!opts.length && <p className="muted small">{t('embed.none')}</p>}
        </div>
      </Popover>
    </div>
  );
}
