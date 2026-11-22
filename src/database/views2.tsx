import { useMemo, useRef, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Download, ExternalLink, MapPin, Paperclip, Plus, Upload } from 'lucide-react';
import type { DatabaseData, FileRef, GeoPoint, PropType, Row, View } from '../lib/types';
import { useT, useLang, LOCALES } from '../i18n';
import { toast } from '../store/ui';
import { Select } from '../components/ui';
import { GeoMap } from '../components/GeoMap';
import { cellText, cellValue, titleProp } from './logic';
import { downloadFile, fileKind, fmtSize, openFile, pickFiles, toFileRef } from '../lib/files';
import { openUrl } from '../lib/platform';
import { osmLink } from '../lib/geo';

const DAY = 86400000;
const parseDay = (v: any): Date | null => {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const OPT_HEX: Record<string, string> = { gray: '#94a3b8', brown: '#a16207', orange: '#f97316', yellow: '#eab308', green: '#22c55e', teal: '#14b8a6', blue: '#3b82f6', purple: '#8b5cf6', pink: '#ec4899', red: '#ef4444' };

/** Cor do registro: pela primeira opção de status/seleção. */
function rowColor(db: DatabaseData, r: Row) {
  const p = db.properties.find((x) => x.type === 'status') || db.properties.find((x) => x.type === 'select');
  const o = p?.options?.find((x) => x.id === r.cells[p.id]);
  return o ? OPT_HEX[o.color] || '#8b5cf6' : '#8b5cf6';
}

type Common = { db: DatabaseData; view: View; rows: Row[]; openRow: (id: string) => void; addRow: (c?: Record<string, any>) => Row; addProp: (t: PropType) => any; setView: (p: Partial<View>) => void; setRow: (id: string, cells: Record<string, any>) => void };

/* ------------------------------------------------------------------ Gantt */
export function GanttView({ db, view, rows, openRow, addRow, addProp, setView, setRow }: Common) {
  const t = useT();
  const lang = useLang();
  const dates = db.properties.filter((p) => p.type === 'date');
  const sp = dates.find((p) => p.id === view.dateProp) || dates[0];
  const ep = dates.find((p) => p.id === view.endProp) || dates.find((p) => p !== sp);
  const scale = view.scale || 'day';
  const px = scale === 'day' ? 36 : scale === 'week' ? 14 : 5;
  const tp = titleProp(db);
  const items = rows.map((r) => {
    const s = parseDay(sp && r.cells[sp.id]);
    let e = parseDay(ep && r.cells[ep.id]);
    if (s && (!e || e < s)) e = s;
    return { r, s, e };
  });
  const dated = items.filter((x) => x.s) as { r: Row; s: Date; e: Date }[];
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const min = dated.length ? new Date(Math.min(...dated.map((x) => +x.s))) : today;
  const max = dated.length ? new Date(Math.max(...dated.map((x) => +x.e))) : addDays(today, 30);
  const start = addDays(new Date(Math.min(+min, +today)), -3);
  const end = addDays(new Date(Math.max(+max, +today)), scale === 'month' ? 60 : 14);
  const days = Math.round((+end - +start) / DAY) + 1;
  const width = days * px;
  const drag = useRef<{ id: string; mode: 'move' | 'start' | 'end'; x0: number; s: Date; e: Date } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; s: Date; e: Date } | null>(null);

  if (!sp)
    return (
      <div className="db-empty">
        <p>{t('db.gantt.needDate')}</p>
        <button className="btn primary" onClick={() => addProp('date')}><Plus size={15} /> {t('db.type.date')}</button>
      </div>
    );

  const onDown = (e: React.PointerEvent, id: string, mode: 'move' | 'start' | 'end', s: Date, en: Date) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { id, mode, x0: e.clientX, s, e: en };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dd = Math.round((e.clientX - d.x0) / px);
    let s = d.s, en = d.e;
    if (d.mode === 'move') (s = addDays(d.s, dd)), (en = addDays(d.e, dd));
    if (d.mode === 'start') s = new Date(Math.min(+addDays(d.s, dd), +d.e));
    if (d.mode === 'end') en = new Date(Math.max(+addDays(d.e, dd), +d.s));
    setGhost({ id: d.id, s, e: en });
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !ghost || ghost.id !== d.id) return setGhost(null);
    const cells: Record<string, any> = { [sp.id]: keyOf(ghost.s) };
    if (ep) cells[ep.id] = keyOf(ghost.e);
    setRow(d.id, cells);
    setGhost(null);
  };

  // cabeçalho: meses + dias/semanas
  const months: { label: string; x: number; w: number }[] = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const a = Math.max(+d, +start), b = Math.min(+new Date(d.getFullYear(), d.getMonth() + 1, 1), +end + DAY);
    months.push({ label: new Intl.DateTimeFormat(LOCALES[lang], { month: 'long', year: 'numeric' }).format(d), x: ((a - +start) / DAY) * px, w: ((b - a) / DAY) * px });
  }
  const ticks = Array.from({ length: days }, (_, i) => addDays(start, i)).filter((d) => (scale === 'day' ? true : scale === 'week' ? d.getDay() === 1 : d.getDate() === 1));
  const x = (d: Date) => ((+d - +start) / DAY) * px;

  return (
    <div className="gantt">
      <div className="gantt-bar">
        <Select value={sp.id} options={dates.map((p) => ({ value: p.id, label: `${t('db.gantt.start')}: ${p.name}` }))} onChange={(dateProp) => setView({ dateProp })} />
        <Select value={ep?.id || ''} options={[{ value: '', label: t('db.gantt.noEnd') }, ...dates.filter((p) => p.id !== sp.id).map((p) => ({ value: p.id, label: `${t('db.gantt.end')}: ${p.name}` }))]} onChange={(endProp) => setView({ endProp: endProp || undefined })} />
        {!ep && <button className="btn ghost sm" onClick={() => { const p = addProp('date'); if (p?.id) setView({ endProp: p.id }); }}><Plus size={14} /> {t('db.gantt.addEnd')}</button>}
        <span className="grow" />
        <div className="seg sm">
          {(['day', 'week', 'month'] as const).map((s) => <button key={s} className={scale === s ? 'on' : ''} onClick={() => setView({ scale: s })}>{t(`db.gantt.${s}` as any)}</button>)}
        </div>
      </div>
      <div className="gantt-wrap" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="gantt-left">
          <div className="gantt-corner">{tp.name}</div>
          {items.map(({ r }) => (
            <button key={r.id} className="gantt-name" onClick={() => openRow(r.id)}><span className="gdot" style={{ background: rowColor(db, r) }} />{cellText(tp, cellValue(tp, r)) || t('page.untitled')}</button>
          ))}
          <button className="gantt-name add" onClick={() => openRow(addRow({ [sp.id]: keyOf(today), ...(ep ? { [ep.id]: keyOf(addDays(today, 4)) } : {}) }).id)}><Plus size={14} /> {t('db.new')}</button>
        </div>
        <div className="gantt-scroll">
          <div className="gantt-grid" style={{ width }}>
            <div className="gantt-months">{months.map((m) => <span key={m.label} style={{ left: m.x, width: m.w }}>{m.label}</span>)}</div>
            <div className="gantt-ticks">
              {ticks.map((d) => (
                <span key={+d} className={(d.getDay() === 0 || d.getDay() === 6) && scale === 'day' ? 'we' : ''} style={{ left: x(d), width: scale === 'day' ? px : undefined }}>
                  {scale === 'day' ? d.getDate() : scale === 'week' ? `${d.getDate()}/${d.getMonth() + 1}` : new Intl.DateTimeFormat(LOCALES[lang], { month: 'short' }).format(d)}
                </span>
              ))}
            </div>
            <div className="gantt-today" style={{ left: x(today) + (scale === 'day' ? px / 2 : 0) }} />
            {items.map(({ r, s, e }) => {
              const g = ghost?.id === r.id ? ghost : null;
              const S = g?.s || s, E = g?.e || e;
              return (
                <div key={r.id} className="gantt-row" onDoubleClick={(ev) => {
                  if (S) return;
                  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                  const d = addDays(start, Math.floor((ev.clientX - rect.left) / px));
                  setRow(r.id, { [sp.id]: keyOf(d), ...(ep ? { [ep.id]: keyOf(addDays(d, 2)) } : {}) });
                }}>
                  {S && E ? (
                    <div className={'gantt-task' + (g ? ' drag' : '')} style={{ left: x(S), width: Math.max(px, x(addDays(E, 1)) - x(S)), ['--gc' as any]: rowColor(db, r) }}
                      onPointerDown={(ev) => onDown(ev, r.id, 'move', s!, e!)} onDoubleClick={(ev) => (ev.stopPropagation(), openRow(r.id))}
                      title={`${cellText(tp, cellValue(tp, r))} · ${S.toLocaleDateString(LOCALES[lang])} → ${E.toLocaleDateString(LOCALES[lang])}`}>
                      <span className="gh l" onPointerDown={(ev) => onDown(ev, r.id, 'start', s!, e!)} />
                      <span className="gt">{cellText(tp, cellValue(tp, r)) || t('page.untitled')}</span>
                      <span className="gh r" onPointerDown={(ev) => onDown(ev, r.id, 'end', s!, e!)} />
                    </div>
                  ) : (
                    <span className="gantt-nodate">{t('db.gantt.noDate')}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="muted small">{t('db.gantt.hint')}</p>
    </div>
  );
}

/* ------------------------------------------------------------ Cronograma */
export function TimelineView({ db, view, rows, openRow, addRow, addProp, setView }: Common) {
  const t = useT();
  const lang = useLang();
  const dates = db.properties.filter((p) => p.type === 'date');
  const dp = dates.find((p) => p.id === view.dateProp) || dates[0];
  const tp = titleProp(db);
  if (!dp)
    return (
      <div className="db-empty">
        <p>{t('db.calendar.needDate')}</p>
        <button className="btn primary" onClick={() => addProp('date')}><Plus size={15} /> {t('db.type.date')}</button>
      </div>
    );
  const dated = rows.map((r) => ({ r, d: parseDay(r.cells[dp.id]) })).filter((x) => x.d).sort((a, b) => +a.d! - +b.d!) as { r: Row; d: Date }[];
  const undated = rows.filter((r) => !parseDay(r.cells[dp.id]));
  const groups = new Map<string, { r: Row; d: Date }[]>();
  for (const it of dated) {
    const k = `${it.d.getFullYear()}-${it.d.getMonth()}`;
    groups.set(k, [...(groups.get(k) || []), it]);
  }
  const today = keyOf(new Date());
  const shown = db.properties.filter((p) => p.id !== tp.id && p.id !== dp.id && !(view.hidden || []).includes(p.id) && ['status', 'select', 'multi', 'text', 'currency', 'number', 'location'].includes(p.type)).slice(0, 3);
  return (
    <div className="timeline">
      <div className="gantt-bar">
        {dates.length > 1 && <Select value={dp.id} options={dates.map((p) => ({ value: p.id, label: `${t('db.dateProp')}: ${p.name}` }))} onChange={(dateProp) => setView({ dateProp })} />}
        <span className="grow" />
        <button className="btn ghost sm" onClick={() => openRow(addRow({ [dp.id]: today }).id)}><Plus size={14} /> {t('db.new')}</button>
      </div>
      {!dated.length && <p className="muted">{t('db.timeline.empty')}</p>}
      {[...groups.entries()].map(([k, list]) => (
        <section key={k} className="tl-month">
          <h4><CalendarRange size={15} /> {new Intl.DateTimeFormat(LOCALES[lang], { month: 'long', year: 'numeric' }).format(list[0].d)}</h4>
          <div className="tl-line">
            {list.map(({ r, d }) => {
              const past = keyOf(d) < today, isToday = keyOf(d) === today;
              return (
                <button key={r.id} className={'tl-item' + (past ? ' past' : '') + (isToday ? ' today' : '')} onClick={() => openRow(r.id)} style={{ ['--gc' as any]: rowColor(db, r) }}>
                  <span className="tl-date"><b>{d.getDate()}</b><small>{new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'short' }).format(d)}</small></span>
                  <span className="tl-dot" />
                  <span className="tl-card">
                    <b>{cellText(tp, cellValue(tp, r)) || t('page.untitled')}</b>
                    <span className="tl-meta">{shown.map((p) => { const v = cellText(p, cellValue(p, r), LOCALES[lang]); return v ? <span key={p.id}>{v}</span> : null; })}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {undated.length > 0 && (
        <details className="tl-undated"><summary>{t('db.timeline.undated', { n: undated.length })}</summary>
          {undated.map((r) => <button key={r.id} className="menu-item" onClick={() => openRow(r.id)}>{cellText(tp, cellValue(tp, r)) || t('page.untitled')}</button>)}
        </details>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Mapa */
export function MapDbView({ db, view, rows, openRow, addProp, setView }: Common) {
  const t = useT();
  const locs = db.properties.filter((p) => p.type === 'location');
  const lp = locs.find((p) => p.id === view.locProp) || locs[0];
  const tp = titleProp(db);
  const markers = useMemo(() => (lp ? rows.map((r) => ({ r, g: r.cells[lp.id] as GeoPoint | undefined })).filter((x) => x.g && isFinite(x.g.lat)).map(({ r, g }) => ({ id: r.id, lat: g!.lat, lon: g!.lon, label: `${cellText(tp, cellValue(tp, r)) || ''} — ${g!.label}`, color: rowColor(db, r) })) : []), [rows, lp, tp, db]);
  if (!lp)
    return (
      <div className="db-empty">
        <p>{t('db.map.needLoc')}</p>
        <button className="btn primary" onClick={() => addProp('location')}><MapPin size={15} /> {t('db.type.location')}</button>
      </div>
    );
  const missing = rows.filter((r) => !r.cells[lp.id]);
  return (
    <div className="db-map">
      {locs.length > 1 && <div className="gantt-bar"><Select value={lp.id} options={locs.map((p) => ({ value: p.id, label: p.name }))} onChange={(locProp) => setView({ locProp })} /></div>}
      <div className="db-map-layout">
        <GeoMap markers={markers} onMarker={openRow} height="min(62vh, 560px)" />
        <aside className="db-map-list">
          {rows.map((r) => {
            const g = r.cells[lp.id] as GeoPoint | undefined;
            return (
              <div key={r.id} className="dml-item">
                <button className="grow" onClick={() => openRow(r.id)}>
                  <b><span className="gdot" style={{ background: rowColor(db, r) }} />{cellText(tp, cellValue(tp, r)) || t('page.untitled')}</b>
                  <small className="muted ellipsis">{g ? g.label : t('db.map.noLoc')}</small>
                </button>
                {g && <button className="icon-btn xs" title={t('geo.openMap')} onClick={() => openUrl(osmLink(g))}><ExternalLink size={13} /></button>}
              </div>
            );
          })}
          {missing.length > 0 && <p className="muted small">{t('db.map.missing', { n: missing.length })}</p>}
        </aside>
      </div>
      <p className="muted small">© OpenStreetMap · {t('db.map.hint')}</p>
    </div>
  );
}

/* --------------------------------------------------------------- Anexos */
export function FilesView({ db, view, rows, openRow, addRow, addProp, setView }: Common) {
  const t = useT();
  const lang = useLang();
  const fps = db.properties.filter((p) => p.type === 'files');
  const fp = fps.find((p) => p.id === view.filesProp) || fps[0];
  const tp = titleProp(db);
  const [over, setOver] = useState(false);
  const all = fp ? rows.flatMap((r) => ((r.cells[fp.id] as FileRef[]) || []).map((f) => ({ f, r }))) : [];
  const ingest = async (files: File[]) => {
    if (!files.length) return;
    let prop = fp;
    if (!prop) prop = addProp('files');
    if (!prop) return;
    try {
      for (const file of files) {
        const ref = await toFileRef(file);
        addRow({ [tp.id]: file.name.replace(/\.[^.]+$/, ''), [prop.id]: [ref] });
      }
      toast(t('files.added', { n: files.length }), 'success');
    } catch (e) {
      toast(String((e as Error).message), 'error');
    }
  };
  if (!fp)
    return (
      <div className="db-empty">
        <p>{t('db.files.needProp')}</p>
        <button className="btn primary" onClick={() => addProp('files')}><Paperclip size={15} /> {t('db.type.files')}</button>
      </div>
    );
  return (
    <div className={'files-view' + (over ? ' over' : '')} onDragOver={(e) => (e.preventDefault(), setOver(true))} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void ingest(Array.from(e.dataTransfer.files)); }}>
      <div className="gantt-bar">
        {fps.length > 1 && <Select value={fp.id} options={fps.map((p) => ({ value: p.id, label: p.name }))} onChange={(filesProp) => setView({ filesProp })} />}
        <span className="muted small">{t('db.files.count', { n: all.length })}</span>
        <span className="grow" />
        <button className="btn primary sm" onClick={async () => ingest(await pickFiles(true))}><Upload size={14} /> {t('files.attach')}</button>
      </div>
      <div className="files-grid">
        {all.map(({ f, r }) => {
          const k = fileKind(f);
          const I = k.icon;
          return (
            <div key={f.id} className="file-card">
              <button className="fcard-prev" onClick={() => openFile(f)} style={{ ['--fk' as any]: k.color }}>
                {f.type.startsWith('image/') ? <img src={f.data} alt={f.name} /> : <><I size={34} /><span className="fk-label">{k.label}</span></>}
              </button>
              <div className="fcard-body">
                <b className="ellipsis" title={f.name}>{f.name}</b>
                <small className="muted">{fmtSize(f.size)} · {new Date(f.addedAt).toLocaleDateString(LOCALES[lang])}</small>
                <div className="row">
                  <button className="link-sm grow ellipsis" onClick={() => openRow(r.id)}>{cellText(tp, cellValue(tp, r)) || t('page.untitled')}</button>
                  <button className="icon-btn xs" title={t('files.download')} onClick={() => void downloadFile(f)}><Download size={13} /></button>
                </div>
              </div>
            </div>
          );
        })}
        <button className="file-card add" onClick={async () => ingest(await pickFiles(true))}>
          <Paperclip size={26} />
          <b>{t('files.dropHere')}</b>
          <small className="muted">{t('files.limit')}</small>
        </button>
      </div>
    </div>
  );
}
