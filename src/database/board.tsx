import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownUp, Archive as ArchiveIcon, ArchiveRestore, Bell, Calendar, Check, History, ListTodo, MapPin, MessageSquare, Paperclip, Pencil, Plus, Send, ShoppingCart, Timer, Trash2, LayoutGrid,
} from 'lucide-react';
import type { DatabaseData, Property, PropType, Row, View } from '../lib/types';
import { useT, useLang, LOCALES } from '../i18n';
import { Modal, Popover } from '../components/ui';
import { askConfirm } from '../components/PromptHost';
import { Cell, OptionPill } from './Cell';
import { TypeIcon, TypeMenu } from './fields';
import { titleProp } from './logic';
import { uid } from '../lib/crypto';
import { fmtDateTime, fmtRelative } from '../lib/dates';
import { DateInput } from '../components/DateInput';

type SetRow = (id: string, cells: Record<string, any>) => void;
const WIDE: PropType[] = ['longtext', 'items', 'checklist', 'files'];
const BADGE: PropType[] = ['checklist', 'items', 'timer'];
const INTERACTIVE = 'button,input,textarea,select,a,.cell-check,.stars,.timer-badge,[contenteditable="true"]';

/* ================================================================ quadro */

export function BoardView({ db, view, rows, setRow, addRow, openRow, setProp, shown, addProp, moveCard }: {
  db: DatabaseData; view: View; rows: Row[]; setRow: SetRow; addRow: (c?: Record<string, any>) => Row; openRow: (id: string) => void;
  setProp: (p: Property) => void; shown: Property[]; addProp: (t: PropType) => Property;
  moveCard: (id: string, cells: Record<string, any>, beforeId: string | null, groupId: string) => void;
}) {
  const t = useT();
  const group = db.properties.find((p) => p.id === view.groupBy && (p.type === 'select' || p.type === 'status'));
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; started: boolean; armed: boolean; dx: number; dy: number; w: number; timer?: any } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; w: number } | null>(null);
  const [target, setTarget] = useState<{ col: string; before: string | null } | null>(null);
  const targetRef = useRef<{ col: string; before: string | null } | null>(null);
  const suppress = useRef(false);

  useEffect(() => () => end(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group)
    return (
      <div className="db-empty">
        <p>{t('db.board.needGroup')}</p>
        <button className="btn primary" onClick={() => addProp('status')}><Plus size={15} /> {t('db.type.status')}</button>
      </div>
    );
  const cols = [{ id: '', label: t('db.board.none'), color: 'gray' }, ...(group.options || [])];
  const tp = titleProp(db);

  function locate(x: number, y: number) {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const col = el?.closest('[data-col]') as HTMLElement | null;
    if (!col) return null;
    const cards = Array.from(col.querySelectorAll<HTMLElement>('[data-card]')).filter((c) => c.dataset.card !== drag.current?.id);
    const before = cards.find((c) => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
    return { col: col.dataset.col || '', before: before?.dataset.card || null };
  }
  function autoScroll(x: number) {
    const b = boardRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    if (x > r.right - 60) b.scrollLeft += 18;
    else if (x < r.left + 60) b.scrollLeft -= 18;
  }
  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (!d.started) {
      if (!d.armed) { if (dist > 8) end(); return; } // toque: rolou a tela antes do toque longo
      if (dist < 5) return;
      d.started = true;
      document.body.classList.add('board-dragging');
    }
    setGhost({ id: d.id, x: e.clientX - d.dx, y: e.clientY - d.dy, w: d.w });
    const tg = locate(e.clientX, e.clientY);
    if (tg) { targetRef.current = tg; setTarget(tg); }
    autoScroll(e.clientX);
  }
  function onUp() {
    const d = drag.current;
    if (d?.started && targetRef.current && group) {
      const tg = targetRef.current;
      moveCard(d.id, { [group.id]: tg.col }, tg.before, group.id);
      suppress.current = true;
      setTimeout(() => (suppress.current = false), 50);
    }
    end();
  }
  function noScroll(e: TouchEvent) { if (drag.current?.armed) e.preventDefault(); }
  function end() {
    if (drag.current?.timer) clearTimeout(drag.current.timer);
    drag.current = null;
    targetRef.current = null;
    setGhost(null);
    setTarget(null);
    document.body.classList.remove('board-dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', end);
    window.removeEventListener('touchmove', noScroll);
  }
  function start(e: React.PointerEvent<HTMLDivElement>, r: Row) {
    if (e.button !== 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.pointerType !== 'mouse';
    drag.current = { id: r.id, x: e.clientX, y: e.clientY, started: false, armed: !touch, dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width };
    if (touch) {
      // no celular/tablet: segure o cartão para arrastar (o toque rápido abre)
      drag.current.timer = setTimeout(() => {
        if (!drag.current) return;
        drag.current.armed = true;
        drag.current.started = true;
        (navigator as any).vibrate?.(12);
        document.body.classList.add('board-dragging');
        setGhost({ id: r.id, x: rect.left, y: rect.top, w: rect.width });
        suppress.current = true;
      }, 380);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', end);
    window.addEventListener('touchmove', noScroll, { passive: false });
  }

  const dragged = ghost ? db.rows.find((r) => r.id === ghost.id) : null;
  const card = (r: Row, extra = '') => (
    <CardBody db={db} r={r} tp={tp} group={group} shown={shown} setRow={setRow} setProp={setProp} className={extra} />
  );

  return (
    <div className="board" ref={boardRef}>
      {cols.map((c) => {
        const items = rows.filter((r) => (r.cells[group.id] || '') === c.id);
        if (c.id === '' && !items.length) return null;
        const isTarget = target?.col === c.id;
        return (
          <div key={c.id || 'none'} data-col={c.id} className={'board-col' + (isTarget ? ' over' : '')}>
            <div className="board-col-head">
              <OptionPill label={c.label} color={c.color} />
              <span className="board-count">{items.length}</span>
              <button className="icon-btn xs" title={t('db.new')} onClick={() => openRow(addRow({ [group.id]: c.id }).id)}><Plus size={14} /></button>
            </div>
            {items.map((r) => (
              <div key={r.id} className="card-slot">
                {isTarget && target?.before === r.id && <div className="card-drop" />}
                <div
                  data-card={r.id}
                  className={'card' + (ghost?.id === r.id ? ' drag-src' : '')}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => start(e, r)}
                  onClick={(e) => {
                    if (suppress.current || (e.target as HTMLElement).closest(INTERACTIVE)) return;
                    openRow(r.id);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && openRow(r.id)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {card(r)}
                </div>
              </div>
            ))}
            {isTarget && target?.before === null && <div className="card-drop" />}
            <button className="board-add" onClick={() => openRow(addRow({ [group.id]: c.id }).id)}><Plus size={14} /> {t('db.new')}</button>
          </div>
        );
      })}
      {ghost && dragged && createPortal(
        <div className="card card-ghost" style={{ left: ghost.x, top: ghost.y, width: ghost.w }}>{card(dragged)}</div>,
        document.body,
      )}
    </div>
  );
}

function CardBody({ db, r, tp, group, shown, setRow, setProp, className = '' }: {
  db: DatabaseData; r: Row; tp: Property; group: Property; shown: Property[]; setRow: SetRow; setProp: (p: Property) => void; className?: string;
}) {
  const t = useT();
  const filled = (p: Property) => r.cells[p.id] != null && r.cells[p.id] !== '' && !(Array.isArray(r.cells[p.id]) && !r.cells[p.id].length);
  const badges = db.properties.filter((p) => BADGE.includes(p.type) && filled(p));
  const props = shown.filter((p) => p.id !== tp.id && p.id !== group.id && !BADGE.includes(p.type) && p.type !== 'longtext' && filled(p)).slice(0, 4);
  const n = r.comments?.length || 0;
  return (
    <div className={'card-in ' + className}>
      <div className="card-title">{r.cells[tp.id] || t('page.untitled')}</div>
      {props.map((p) => (
        <div key={p.id} className="card-prop">
          <Cell prop={p} row={r} compact readOnly={!['checkbox', 'rating'].includes(p.type)} onChange={(v) => setRow(r.id, { [p.id]: v })} onPropChange={setProp} />
        </div>
      ))}
      {(badges.length > 0 || n > 0) && (
        <div className="card-badges">
          {badges.map((p) => (
            <Cell key={p.id} prop={p} row={r} compact onChange={(v) => setRow(r.id, { [p.id]: v })} onPropChange={setProp} />
          ))}
          {n > 0 && <span className="card-comments"><MessageSquare size={12} /> {n}</span>}
        </div>
      )}
    </div>
  );
}

/* ============================================================ registro */

const QUICK: { type: PropType; icon: any; key: 'work.q.sub' | 'work.q.items' | 'work.q.timer' | 'work.q.date' | 'work.q.files' | 'work.q.place' | 'work.q.long' }[] = [
  { type: 'checklist', icon: ListTodo, key: 'work.q.sub' },
  { type: 'date', icon: Calendar, key: 'work.q.date' },
  { type: 'items', icon: ShoppingCart, key: 'work.q.items' },
  { type: 'timer', icon: Timer, key: 'work.q.timer' },
  { type: 'files', icon: Paperclip, key: 'work.q.files' },
  { type: 'location', icon: MapPin, key: 'work.q.place' },
];

export function RowModal({ db, dbTitle, row, onClose, setRow, setProp, setNotes, patchRow, addProp, onDelete }: {
  db: DatabaseData; dbTitle: string; row: Row; onClose: () => void; setRow: SetRow; setProp: (p: Property) => void; setNotes: (n: string) => void;
  patchRow: (p: Partial<Row>) => void; addProp: (t: PropType) => Property; onDelete: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const tp = titleProp(db);
  const [addOpen, setAddOpen] = useState(false);
  const [remOpen, setRemOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [newest, setNewest] = useState(true);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);

  const others = db.properties.filter((p) => p.id !== tp.id);
  const simple = others.filter((p) => !WIDE.includes(p.type));
  const wide = others.filter((p) => WIDE.includes(p.type));

  const focusProp = (id: string) => {
    setFlash(id);
    setTimeout(() => body.current?.querySelector(`[data-prop="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
    setTimeout(() => setFlash(null), 1400);
  };
  const quick = (type: PropType) => {
    const have = db.properties.find((p) => p.type === type);
    focusProp(have ? have.id : addProp(type).id);
  };
  const comments = [...(row.comments || [])].sort((a, b) => (newest ? b.at - a.at : a.at - b.at));
  const acts = [...(row.activity || [])].sort((a, b) => (newest ? b.at - a.at : a.at - b.at));
  const send = () => {
    const txt = draft.trim();
    if (!txt) return;
    patchRow({ comments: [...(row.comments || []), { id: uid('cm'), text: txt, at: Date.now() }] });
    setDraft('');
  };
  const loc = LOCALES[lang];

  return (
    <Modal
      open
      onClose={onClose}
      width={820}
      className="row-modal"
      title={<input className="row-title" value={row.cells[tp.id] || ''} placeholder={t('page.untitled')} onChange={(e) => setRow(row.id, { [tp.id]: e.target.value })} autoFocus />}
      footer={
        <>
          <button className="btn ghost danger" onClick={async () => (await askConfirm({ title: t('work.delCard'), danger: true, okLabel: t('common.delete') })) && onDelete()}><Trash2 size={15} /> {t('common.delete')}</button>
          <button className="btn ghost" onClick={() => { patchRow({ archivedAt: row.archivedAt ? null : Date.now() }); if (!row.archivedAt) onClose(); }}>{row.archivedAt ? <ArchiveRestore size={15} /> : <ArchiveIcon size={15} />} {row.archivedAt ? t('archive.restore') : t('archive.action')}</button>
          <div className="grow" />
          <button className="btn primary" onClick={onClose}><Check size={15} /> {t('common.done')}</button>
        </>
      }
    >
      <div ref={body} className="row-body">
        <div className="row-where muted small"><LayoutGrid size={13} /> {t('work.inList')} <b>{dbTitle || t('page.untitled')}</b></div>
        <div className="row-quick">
          {QUICK.map((q) => (
            <button key={q.type} className="chip-btn" onClick={() => quick(q.type)}><q.icon size={14} /> {t(q.key)}</button>
          ))}
          <button className={'chip-btn' + (row.remindAt || remOpen ? ' on' : '')} onClick={() => setRemOpen(!remOpen)}><Bell size={14} /> {t('work.q.reminder')}</button>
          <button ref={addRef} className="chip-btn accent" onClick={() => setAddOpen(true)}><Plus size={14} /> {t('work.addField')}</button>
          <Popover anchor={addRef.current} open={addOpen} onClose={() => setAddOpen(false)}>
            <TypeMenu onPick={(ty) => { setAddOpen(false); focusProp(addProp(ty).id); }} />
          </Popover>
        </div>

        {(remOpen || row.remindAt) && (
          <div className="row-reminder">
            <Bell size={15} /> <b>{t('work.reminder')}</b>
            <DateInput withTime value={row.remindAt || ''} onChange={(v) => patchRow({ remindAt: v || undefined })} />
            <span className="muted small">{t('work.reminderHint')}</span>
          </div>
        )}
        <div className="row-props">
          {simple.map((p) => (
            <div className={'row-prop' + (flash === p.id ? ' flash' : '')} key={p.id} data-prop={p.id}>
              <span className="row-prop-name"><TypeIcon type={p.type} size={12} /> {p.name}</span>
              <div className="row-prop-val">
                <Cell prop={p} row={row} onChange={(v) => setRow(row.id, { [p.id]: v })} onPropChange={setProp} />
              </div>
            </div>
          ))}
        </div>

        {wide.map((p) => (
          <section key={p.id} className={'row-section' + (flash === p.id ? ' flash' : '')} data-prop={p.id}>
            <h4><TypeIcon type={p.type} size={13} /> {p.name}</h4>
            <Cell prop={p} row={row} onChange={(v) => setRow(row.id, { [p.id]: v })} onPropChange={setProp} />
          </section>
        ))}

        <section className="row-section">
          <h4><Pencil size={15} /> {t('work.description')}</h4>
          <textarea className="input notes" rows={5} placeholder={t('db.notes')} value={row.notes || ''} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <section className="row-section row-social">
          <div className="row-tabs">
            <button className={tab === 'comments' ? 'on' : ''} onClick={() => setTab('comments')}><MessageSquare size={14} /> {t('work.comments')} <span className="count">{row.comments?.length || 0}</span></button>
            <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}><History size={14} /> {t('work.activity')} <span className="count">{row.activity?.length || 0}</span></button>
            <div className="grow" />
            <button className="btn ghost xs" onClick={() => setNewest(!newest)}><ArrowDownUp size={13} /> {newest ? t('work.newest') : t('work.oldest')}</button>
          </div>
          {tab === 'comments' ? (
            <>
              <div className="comment-new">
                <textarea className="input" rows={2} value={draft} placeholder={t('work.commentPh')} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.preventDefault(), send()); }} />
                <button className="btn primary sm" disabled={!draft.trim()} onClick={send}><Send size={14} /> {t('work.send')}</button>
              </div>
              {comments.map((c) => (
                <div key={c.id} className="comment">
                  <div className="comment-head">
                    <b>{t('work.you')}</b>
                    <span className="muted small" title={fmtDateTime(c.at, loc)}>{fmtRelative(c.at, loc)}{c.edited ? ` · ${t('work.edited')}` : ''}</span>
                    <div className="grow" />
                    <button className="icon-btn xs" title={t('common.edit')} onClick={() => setEditing(editing === c.id ? null : c.id)}><Pencil size={12} /></button>
                    <button className="icon-btn xs danger-h" title={t('common.delete')} onClick={() => patchRow({ comments: (row.comments || []).filter((x) => x.id !== c.id) })}><Trash2 size={12} /></button>
                  </div>
                  {editing === c.id ? (
                    <textarea className="input" autoFocus defaultValue={c.text} rows={2}
                      onBlur={(e) => { patchRow({ comments: (row.comments || []).map((x) => (x.id === c.id ? { ...x, text: e.target.value, edited: Date.now() } : x)) }); setEditing(null); }} />
                  ) : (
                    <p className="comment-text">{c.text}</p>
                  )}
                </div>
              ))}
              {!comments.length && <p className="muted small empty-note">{t('work.noComments')}</p>}
            </>
          ) : (
            <ol className="activity">
              {acts.map((a) => (
                <li key={a.id}><span className="dot" /> <span className="grow">{a.text}</span> <span className="muted small" title={fmtDateTime(a.at, loc)}>{fmtRelative(a.at, loc)}</span></li>
              ))}
              {!acts.length && <p className="muted small empty-note">{t('work.noActivity')}</p>}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}
