import { useMemo, useState } from 'react';
import { CalendarDays, CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Notebook, Plus } from 'lucide-react';
import { useT, useLang, LOCALES } from '../i18n';
import { useVault } from '../store/vault';
import { useUi, toast } from '../store/ui';
import { usePrefs } from '../store/prefs';
import { agenda, byDay, addDays, dayKey, monthGrid, parseDay, weekStart, type AgendaItem } from '../lib/agenda';
import { todayKey } from '../lib/doc';
import { openDaily } from './Journal';
import { Cell } from '../database/Cell';
import { PageIcon, Popover } from './ui';
import { makeProperty, newRow, recompute, titleProp } from '../database/logic';
import { uid } from '../lib/crypto';
import type { Page } from '../lib/types';
import { useRef } from 'react';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function monthLabel(loc: string, y: number, m: number) {
  return cap(new Intl.DateTimeFormat(loc, { month: 'long' }).format(new Date(y, m, 1))) + ' ' + y;
}

function useAgenda() {
  const pages = useVault((s) => s.pages);
  return useMemo(() => {
    const items = agenda(pages);
    return { items, days: byDay(items) };
  }, [pages]);
}

/** Calendário compacto fixo na barra lateral (acima do Diário). */
export function MiniCalendar() {
  const lang = useLang();
  const t = useT();
  const open = usePrefs((s) => s.miniCalendar);
  const setPrefs = usePrefs((s) => s.set);
  const go = useUi((s) => s.go);
  const { days } = useAgenda();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const grid = monthGrid(cursor.y, cursor.m);
  const wd = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)));
  const shift = (d: number) => setCursor((c) => ({ y: c.m + d < 0 ? c.y - 1 : c.m + d > 11 ? c.y + 1 : c.y, m: (c.m + d + 12) % 12 }));
  const monthItems = grid.filter((k) => parseDay(k).getMonth() === cursor.m).reduce((s, k) => s + (days.get(k)?.filter((x) => x.kind === 'row').length || 0), 0);
  return (
    <div className={'mini-cal' + (open ? ' open' : '')}>
      <div className="mini-cal-head">
        <button className="mini-cal-title" onClick={() => setPrefs({ miniCalendar: !open })}>
          <CalendarDays size={16} />
          <span className="grow">{monthLabel(LOCALES[lang], cursor.y, cursor.m)}</span>
          {monthItems > 0 && <span className="badge">{monthItems}</span>}
          <ChevronDown size={14} className="mini-cal-chev" />
        </button>
        {open && (
          <>
            <button className="icon-btn xs" onClick={() => shift(-1)} aria-label="‹"><ChevronLeft size={14} /></button>
            <button className="icon-btn xs" onClick={() => shift(1)} aria-label="›"><ChevronRight size={14} /></button>
          </>
        )}
      </div>
      {open && (
        <>
          <div className="mini-cal-grid">
            {wd.map((w, i) => <span key={i} className="mini-wd">{w}</span>)}
            {grid.map((k) => {
              const d = parseDay(k);
              const items = days.get(k) || [];
              const pending = items.filter((x) => x.kind === 'row' && !x.done).length;
              const doneN = items.filter((x) => x.kind === 'row' && x.done).length;
              const journal = items.some((x) => x.kind === 'journal');
              return (
                <button
                  key={k}
                  className={'mini-day' + (d.getMonth() !== cursor.m ? ' out' : '') + (k === today ? ' today' : '') + (items.length ? ' has' : '')}
                  title={items.length ? items.slice(0, 6).map((x) => '• ' + x.title).join('\n') : ''}
                  onClick={() => go({ name: 'calendar', date: k, mode: 'day' })}
                >
                  {d.getDate()}
                  {(pending > 0 || doneN > 0 || journal) && (
                    <span className="mini-dots">
                      {pending > 0 && <i className="p" />}
                      {doneN > 0 && <i className="d" />}
                      {journal && <i className="j" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mini-cal-foot">
            <button onClick={() => go({ name: 'calendar', date: today, mode: 'month' })}><CalendarRange size={13} /> {t('cal.month')}</button>
            <button onClick={() => go({ name: 'calendar', date: today, mode: 'week' })}>{t('cal.week')}</button>
            <button onClick={() => go({ name: 'calendar', date: today, mode: 'day' })}>{t('cal.day')}</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Página de calendário: mês, semana e dia com detalhes de cada registro. */
export function CalendarHub({ date, mode = 'month' }: { date?: string; mode?: 'month' | 'week' | 'day' }) {
  const t = useT();
  const lang = useLang();
  const go = useUi((s) => s.go);
  const pages = useVault((s) => s.pages);
  const { items, days } = useAgenda();
  const today = todayKey();
  const cur = date || today;
  const [filter, setFilter] = useState<string>('');
  const loc = LOCALES[lang];
  const sources = useMemo(() => [...new Map(items.filter((i) => i.kind === 'row').map((i) => [i.page.id, i.page])).values()], [items]);
  const visible = (list: AgendaItem[] = []) => list.filter((i) => !filter || (filter === 'journal' ? i.kind === 'journal' : i.page.id === filter));
  const set = (d: string, m = mode) => go({ name: 'calendar', date: d, mode: m });
  const step = (dir: -1 | 1) => {
    if (mode === 'day') return set(addDays(cur, dir));
    if (mode === 'week') return set(addDays(cur, 7 * dir));
    const d = parseDay(cur);
    set(dayKey(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
  };
  const curD = parseDay(cur);
  const title = cap(
    mode === 'month'
      ? new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(curD)
      : mode === 'week'
        ? `${new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(parseDay(weekStart(cur)))} – ${new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDay(addDays(weekStart(cur), 6)))}`
        : new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(curD));
  const wd = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
  const monthTotal = monthGrid(curD.getFullYear(), curD.getMonth()).filter((k) => parseDay(k).getMonth() === curD.getMonth()).flatMap((k) => visible(days.get(k)).filter((x) => x.kind === 'row'));
  const overdue = items.filter((i) => i.kind === 'row' && i.task && !i.done && i.date < today);

  return (
    <div className="page-shell cal-hub">
      <div className="cal-hub-head">
        <div className="eyebrow"><CalendarDays size={13} /> {t('nav.calendar')}</div>
        <div className="cal-hub-bar">
          <button className="icon-btn" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
          <h1 className="cal-hub-title">{title}</h1>
          <button className="icon-btn" onClick={() => step(1)}><ChevronRight size={18} /></button>
          <button className="btn ghost sm" onClick={() => set(today)}>{t('common.today')}</button>
          <div className="grow" />
          <div className="seg">
            {(['month', 'week', 'day'] as const).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => set(cur, m)}>{t(`cal.${m}`)}</button>
            ))}
          </div>
          <NewEvent date={cur} pages={pages} />
        </div>
        <div className="chips">
          <button className={'chip xs' + (!filter ? ' on' : '')} onClick={() => setFilter('')}>✨ {t('tpl.all')}</button>
          {sources.map((p) => (
            <button key={p.id} className={'chip xs' + (filter === p.id ? ' on' : '')} onClick={() => setFilter(filter === p.id ? '' : p.id)}>
              <i className="cal-dot" style={{ background: items.find((i) => i.page.id === p.id)?.color }} /> {p.title || t('page.untitled')}
            </button>
          ))}
          <button className={'chip xs' + (filter === 'journal' ? ' on' : '')} onClick={() => setFilter(filter === 'journal' ? '' : 'journal')}><Notebook size={12} /> {t('nav.today')}</button>
        </div>
        <div className="cal-summary muted small">
          {t('cal.summary', { n: monthTotal.length, d: monthTotal.filter((x) => x.done).length })}
          {overdue.length > 0 && <span className="cal-overdue"> · {t('cal.overdue', { n: overdue.length })}</span>}
        </div>
      </div>

      {mode === 'month' && (
        <div className="cal-month">
          {wd.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          {monthGrid(curD.getFullYear(), curD.getMonth()).map((k) => {
            const list = visible(days.get(k));
            const d = parseDay(k);
            return (
              <div key={k} className={'cal-cell' + (d.getMonth() !== curD.getMonth() ? ' out' : '') + (k === today ? ' today' : '')} onDoubleClick={() => set(k, 'day')}>
                <button className="cal-cell-num" onClick={() => set(k, 'day')}>{d.getDate()}</button>
                {list.slice(0, 4).map((i) => <EventChip key={i.id} item={i} />)}
                {list.length > 4 && <button className="cal-more" onClick={() => set(k, 'day')}>+{list.length - 4}</button>}
              </div>
            );
          })}
        </div>
      )}

      {mode === 'week' && (
        <div className="cal-week">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart(cur), i)).map((k) => {
            const list = visible(days.get(k));
            const d = parseDay(k);
            return (
              <div key={k} className={'cal-wcol' + (k === today ? ' today' : '')}>
                <button className="cal-wcol-head" onClick={() => set(k, 'day')}>
                  <small>{new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d)}</small>
                  <b>{d.getDate()}</b>
                </button>
                <div className="cal-wcol-body">
                  {list.map((i) => <EventCard key={i.id} item={i} compact />)}
                  {!list.length && <span className="muted small cal-free">{t('cal.free')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'day' && (
        <div className="cal-day-view">
          <div className="cal-day-list">
            {visible(days.get(cur)).filter((i) => i.kind === 'row').map((i) => <EventCard key={i.id} item={i} />)}
            {!visible(days.get(cur)).some((i) => i.kind === 'row') && (
              <div className="cal-empty">
                <Clock size={28} />
                <p>{t('cal.emptyDay')}</p>
                <NewEvent date={cur} pages={pages} big />
              </div>
            )}
          </div>
          <aside className="cal-day-side">
            <div className="section-label">{t('nav.today')}</div>
            {visible(days.get(cur)).filter((i) => i.kind === 'journal').map((i) => (
              <button key={i.id} className="menu-item" onClick={() => go({ name: 'page', id: i.page.id })}><Notebook size={15} /> {i.title}</button>
            ))}
            <button className="btn ghost sm" onClick={() => openDaily(cur)}><Plus size={14} /> {t('cal.openJournal')}</button>
            {overdue.length > 0 && (
              <>
                <div className="section-label">{t('cal.overdueTitle')}</div>
                {overdue.slice(0, 8).map((i) => <EventChip key={i.id} item={i} withDate />)}
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function EventChip({ item, withDate }: { item: AgendaItem; withDate?: boolean }) {
  const go = useUi((s) => s.go);
  const lang = useLang();
  return (
    <button className={'cal-ev' + (item.done ? ' done' : '')} style={{ ['--ev' as any]: item.color }} onClick={() => go({ name: 'page', id: item.page.id })} title={`${item.title} · ${item.page.title}`}>
      {item.kind === 'journal' ? '📔 ' : item.done ? <Check size={11} /> : null}
      <span className="ellipsis">{item.title}</span>
      {withDate && <small>{new Intl.DateTimeFormat(LOCALES[lang], { day: '2-digit', month: '2-digit' }).format(parseDay(item.date))}</small>}
    </button>
  );
}

function EventCard({ item, compact }: { item: AgendaItem; compact?: boolean }) {
  const t = useT();
  const go = useUi((s) => s.go);
  const update = useVault((s) => s.updatePage);
  if (item.kind === 'journal') return <EventChip item={item} />;
  const db = item.page.db!;
  const tp = titleProp(db);
  const props = db.properties.filter((p) => p.id !== tp.id && p.id !== item.prop?.id && p.type !== 'password' && item.row!.cells[p.id] != null && item.row!.cells[p.id] !== '' && !(Array.isArray(item.row!.cells[p.id]) && !item.row!.cells[p.id].length)).slice(0, compact ? 2 : 6);
  const setRow = (cells: Record<string, any>) =>
    update(item.page.id, { db: recompute({ ...db, rows: db.rows.map((r) => (r.id === item.row!.id ? { ...r, cells: { ...r.cells, ...cells }, updatedAt: Date.now() } : r)) }) });
  const status = db.properties.find((p) => p.type === 'status');
  return (
    <div className={'cal-card' + (item.done ? ' done' : '') + (compact ? ' compact' : '')} style={{ ['--ev' as any]: item.color }}>
      <div className="cal-card-head">
        {status && !compact && (
          <button className={'cal-check' + (item.done ? ' on' : '')} title={t('cal.toggleDone')} onClick={() => {
            const opts = status.options || [];
            const doneOpt = opts.find((o) => o.color === 'green') || opts[opts.length - 1];
            setRow({ [status.id]: item.done ? opts[0]?.id : doneOpt?.id });
          }}>{item.done && <Check size={12} />}</button>
        )}
        <b className="grow" onClick={() => go({ name: 'page', id: item.page.id })}>{item.title}</b>
      </div>
      <div className="cal-card-src" onClick={() => go({ name: 'page', id: item.page.id })}><PageIcon icon={item.page.icon} size={12} /> {item.page.title} · {item.prop?.name}</div>
      {props.length > 0 && (
        <div className="cal-card-props">
          {props.map((p) => (
            <div key={p.id} className="cal-prop">
              {!compact && <span className="muted">{p.name}</span>}
              <Cell prop={p} row={item.row!} compact readOnly={!['checkbox', 'rating'].includes(p.type)} onChange={(v) => setRow({ [p.id]: v })} onPropChange={() => undefined} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cria um registro com data em uma base que tenha campo de data (ou cria a "Agenda"). */
function NewEvent({ date, pages, big }: { date: string; pages: Record<string, Page>; big?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const ref = useRef<HTMLButtonElement>(null);
  const v = useVault.getState();
  const dbs = Object.values(pages).filter((p) => !p.deletedAt && p.type === 'database' && p.db?.properties.some((x) => x.type === 'date'));
  const [target, setTarget] = useState<string>('');
  const create = () => {
    if (!title.trim()) return;
    let page = dbs.find((d) => d.id === target) || dbs[0];
    if (!page) {
      const tprop = makeProperty('title', t('cal.event'));
      const dprop = makeProperty('date', t('db.type.date'));
      const sprop = makeProperty('status', t('db.type.status'), [t('db.status.todo'), t('db.status.doing'), t('db.status.done')]);
      const viewId = uid('v'), calId = uid('v');
      page = v.createPage({
        type: 'database', title: t('cal.agenda'), icon: '🗓️',
        db: { properties: [tprop, dprop, sprop], rows: [], views: [{ id: calId, name: t('db.view.calendar'), type: 'calendar', dateProp: dprop.id, filters: [] }, { id: viewId, name: t('db.view.table'), type: 'table', filters: [] }], activeView: calId },
      });
    }
    const db = page.db!;
    const dp = db.properties.find((x) => x.type === 'date')!;
    const row = newRow(db, { [titleProp(db).id]: title.trim(), [dp.id]: date });
    v.updatePage(page.id, { db: recompute({ ...db, rows: [...db.rows, row] }) });
    toast(t('cal.created'), 'success');
    setTitle('');
    setOpen(false);
  };
  return (
    <>
      <button ref={ref} className={'btn primary ' + (big ? '' : 'sm')} onClick={() => setOpen(!open)}><Plus size={15} /> {t('cal.new')}</button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} align="right">
        <div className="stack pad" style={{ width: 300 }}>
          <input className="input" autoFocus placeholder={t('cal.eventTitle')} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          {dbs.length > 0 ? (
            <select className="select" value={target || dbs[0].id} onChange={(e) => setTarget(e.target.value)}>
              {dbs.map((d) => <option key={d.id} value={d.id}>{d.title || t('page.untitled')}</option>)}
            </select>
          ) : (
            <p className="muted small">{t('cal.willCreateAgenda')}</p>
          )}
          <button className="btn primary sm" disabled={!title.trim()} onClick={create}>{t('common.save')}</button>
        </div>
      </Popover>
    </>
  );
}
