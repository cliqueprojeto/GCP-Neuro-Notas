import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp, CalendarDays, ChevronLeft, ChevronRight, Columns3, Copy, Download, EyeOff, Filter as FilterIcon, GalleryVerticalEnd, LayoutList,
  Maximize2, MoreHorizontal, Plus, Search, Settings2, Table2, Trash2, X,
} from 'lucide-react';
import type { DatabaseData, Filter, Page, Property, PropType, Row, View, ViewType } from '../lib/types';
import { useT, useLang, LOCALES, type TKey } from '../i18n';
import { useVault } from '../store/vault';
import { Modal, Popover, Select } from '../components/ui';
import { Cell, OptionPill } from './Cell';
import { PROP_TYPES, cellText, cellValue, makeProperty, newRow, titleProp, visibleRows } from './logic';
import { uid } from '../lib/crypto';
import { saveTextFile } from '../lib/platform';

const VIEW_ICONS: Record<ViewType, any> = { table: Table2, board: Columns3, gallery: GalleryVerticalEnd, calendar: CalendarDays, list: LayoutList };

export function DatabaseView({ page }: { page: Page }) {
  const t = useT();
  const update = useVault((s) => s.updatePage);
  const db = page.db!;
  const view = db.views.find((v) => v.id === db.activeView) || db.views[0];
  const [search, setSearch] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [menu, setMenu] = useState<'' | 'filter' | 'sort' | 'props' | 'view' | 'add'>('');
  const refs = { filter: useRef<HTMLButtonElement>(null), sort: useRef<HTMLButtonElement>(null), props: useRef<HTMLButtonElement>(null), view: useRef<HTMLButtonElement>(null), add: useRef<HTMLButtonElement>(null) };

  const save = (next: DatabaseData) => update(page.id, { db: next });
  const setView = (patch: Partial<View>) => save({ ...db, views: db.views.map((v) => (v.id === view.id ? { ...v, ...patch } : v)) });
  const setRow = (id: string, cells: Record<string, any>) => save({ ...db, rows: db.rows.map((r) => (r.id === id ? { ...r, cells: { ...r.cells, ...cells }, updatedAt: Date.now() } : r)) });
  const setProp = (p: Property) => save({ ...db, properties: db.properties.map((x) => (x.id === p.id ? p : x)) });
  const addRow = (cells: Record<string, any> = {}) => {
    const r = newRow(db, cells);
    save({ ...db, rows: [...db.rows, r] });
    return r;
  };
  const delRow = (id: string) => save({ ...db, rows: db.rows.filter((r) => r.id !== id) });
  const addProp = (type: PropType) => {
    const p = makeProperty(type, t(`db.type.${type}` as TKey), [t('db.status.todo'), t('db.status.doing'), t('db.status.done')]);
    save({ ...db, properties: [...db.properties, p] });
  };
  const rows = useMemo(() => visibleRows(db, view, search), [db, view, search]);
  const shown = db.properties.filter((p) => !(view.hidden || []).includes(p.id));

  const addView = (type: ViewType) => {
    const v: View = { id: uid('v'), name: t(`db.view.${type}` as TKey), type, filters: [] };
    if (type === 'board') v.groupBy = db.properties.find((p) => p.type === 'status' || p.type === 'select')?.id;
    if (type === 'calendar') v.dateProp = db.properties.find((p) => p.type === 'date')?.id;
    save({ ...db, views: [...db.views, v], activeView: v.id });
    setMenu('');
  };

  const exportCsv = () => {
    const props = db.properties.filter((p) => p.type !== 'password');
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [props.map((p) => esc(p.name)).join(','), ...rows.map((r) => props.map((p) => esc(cellText(p, cellValue(p, r)))).join(','))];
    void saveTextFile(`${page.title || 'base'}.csv`, lines.join('\n'), [{ name: 'CSV', extensions: ['csv'] }]);
  };

  return (
    <div className="db">
      <div className="db-bar">
        <div className="db-views">
          {db.views.map((v) => {
            const Icon = VIEW_ICONS[v.type];
            return (
              <button key={v.id} className={'db-view-tab' + (v.id === view.id ? ' on' : '')} onClick={() => save({ ...db, activeView: v.id })}>
                <Icon size={15} /> {v.name}
              </button>
            );
          })}
          <button ref={refs.add} className="icon-btn sm" onClick={() => setMenu(menu === 'add' ? '' : 'add')} title={t('db.addView')}><Plus size={16} /></button>
          <Popover anchor={refs.add.current} open={menu === 'add'} onClose={() => setMenu('')}>
            <div className="menu">
              {(Object.keys(VIEW_ICONS) as ViewType[]).map((ty) => {
                const Icon = VIEW_ICONS[ty];
                return (
                  <button key={ty} className="menu-item" onClick={() => addView(ty)}><Icon size={16} /> {t(`db.view.${ty}` as TKey)}</button>
                );
              })}
            </div>
          </Popover>
        </div>
        <div className="grow" />
        <div className="db-search">
          <Search size={15} />
          <input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button ref={refs.filter} className={'btn ghost sm' + (view.filters.length ? ' active' : '')} onClick={() => setMenu(menu === 'filter' ? '' : 'filter')}>
          <FilterIcon size={15} /> {t('db.filter')}{view.filters.length ? ` (${view.filters.length})` : ''}
        </button>
        <button ref={refs.sort} className={'btn ghost sm' + (view.sort ? ' active' : '')} onClick={() => setMenu(menu === 'sort' ? '' : 'sort')}>
          <ArrowDownUp size={15} /> {t('db.sort')}
        </button>
        <button ref={refs.props} className="btn ghost sm" onClick={() => setMenu(menu === 'props' ? '' : 'props')}><EyeOff size={15} /> {t('db.properties')}</button>
        <button ref={refs.view} className="icon-btn sm" onClick={() => setMenu(menu === 'view' ? '' : 'view')}><Settings2 size={16} /></button>
        <button className="btn primary sm" onClick={() => setOpenRow(addRow().id)}><Plus size={15} /> {t('db.new')}</button>

        <Popover anchor={refs.filter.current} open={menu === 'filter'} onClose={() => setMenu('')} align="right">
          <FilterEditor db={db} filters={view.filters} onChange={(filters) => setView({ filters })} />
        </Popover>
        <Popover anchor={refs.sort.current} open={menu === 'sort'} onClose={() => setMenu('')} align="right">
          <div className="stack pad" style={{ width: 280 }}>
            <Select
              value={view.sort?.prop || ''}
              placeholder={t('db.sortBy')}
              options={[{ value: '', label: t('db.noSort') }, ...db.properties.map((p) => ({ value: p.id, label: p.name }))]}
              onChange={(prop) => setView({ sort: prop ? { prop, dir: view.sort?.dir || 'asc' } : null })}
            />
            {view.sort && (
              <div className="seg">
                <button className={view.sort.dir === 'asc' ? 'on' : ''} onClick={() => setView({ sort: { ...view.sort!, dir: 'asc' } })}>↑ {t('db.asc')}</button>
                <button className={view.sort.dir === 'desc' ? 'on' : ''} onClick={() => setView({ sort: { ...view.sort!, dir: 'desc' } })}>↓ {t('db.desc')}</button>
              </div>
            )}
          </div>
        </Popover>
        <Popover anchor={refs.props.current} open={menu === 'props'} onClose={() => setMenu('')} align="right">
          <div className="menu" style={{ width: 260 }}>
            {db.properties.map((p) => (
              <label key={p.id} className="menu-item">
                <input
                  type="checkbox"
                  checked={!(view.hidden || []).includes(p.id)}
                  disabled={p.type === 'title'}
                  onChange={(e) => setView({ hidden: e.target.checked ? (view.hidden || []).filter((x) => x !== p.id) : [...(view.hidden || []), p.id] })}
                />
                {p.name}
              </label>
            ))}
          </div>
        </Popover>
        <Popover anchor={refs.view.current} open={menu === 'view'} onClose={() => setMenu('')} align="right">
          <div className="stack pad" style={{ width: 290 }}>
            <input className="input" value={view.name} onChange={(e) => setView({ name: e.target.value })} />
            {view.type === 'board' && (
              <Select
                value={view.groupBy}
                placeholder={t('db.groupBy')}
                options={db.properties.filter((p) => p.type === 'select' || p.type === 'status').map((p) => ({ value: p.id, label: `${t('db.groupBy')}: ${p.name}` }))}
                onChange={(groupBy) => setView({ groupBy })}
              />
            )}
            {view.type === 'calendar' && (
              <Select
                value={view.dateProp}
                placeholder={t('db.dateProp')}
                options={db.properties.filter((p) => p.type === 'date').map((p) => ({ value: p.id, label: `${t('db.dateProp')}: ${p.name}` }))}
                onChange={(dateProp) => setView({ dateProp })}
              />
            )}
            <button className="menu-item" onClick={exportCsv}><Download size={15} /> {t('db.exportCsv')}</button>
            <button className="menu-item" onClick={() => save({ ...db, views: [...db.views, { ...view, id: uid('v'), name: view.name + ' 2' }] })}><Copy size={15} /> {t('db.duplicateView')}</button>
            {db.views.length > 1 && (
              <button className="menu-item danger" onClick={() => (save({ ...db, views: db.views.filter((v) => v.id !== view.id), activeView: db.views.find((v) => v.id !== view.id)!.id }), setMenu(''))}>
                <Trash2 size={15} /> {t('db.deleteView')}
              </button>
            )}
          </div>
        </Popover>
      </div>

      {view.type === 'table' && <TableView db={db} props={shown} rows={rows} setRow={setRow} setProp={setProp} addRow={addRow} addProp={addProp} openRow={setOpenRow} save={save} />}
      {view.type === 'board' && <BoardView db={db} view={view} rows={rows} setRow={setRow} addRow={addRow} openRow={setOpenRow} setProp={setProp} shown={shown} addProp={addProp} />}
      {view.type === 'gallery' && <GalleryView db={db} rows={rows} openRow={setOpenRow} addRow={addRow} shown={shown} setRow={setRow} setProp={setProp} />}
      {view.type === 'calendar' && <CalendarView db={db} view={view} rows={rows} openRow={setOpenRow} addRow={addRow} addProp={addProp} />}
      {view.type === 'list' && <ListView db={db} rows={rows} openRow={setOpenRow} addRow={addRow} shown={shown} setRow={setRow} setProp={setProp} />}

      <div className="db-foot muted small">{t('db.count', { n: rows.length, total: db.rows.length })}</div>

      {openRow && db.rows.find((r) => r.id === openRow) && (
        <RowModal
          db={db}
          row={db.rows.find((r) => r.id === openRow)!}
          onClose={() => setOpenRow(null)}
          setRow={setRow}
          setProp={setProp}
          setNotes={(notes) => save({ ...db, rows: db.rows.map((r) => (r.id === openRow ? { ...r, notes, updatedAt: Date.now() } : r)) })}
          onDelete={() => (delRow(openRow), setOpenRow(null))}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------- filtros

export function FilterEditor({ db, filters, onChange }: { db: DatabaseData; filters: Filter[]; onChange: (f: Filter[]) => void }) {
  const t = useT();
  const opsFor = (p?: Property): Filter['op'][] => {
    if (!p) return ['contains'];
    if (p.type === 'checkbox') return ['checked', 'unchecked'];
    if (['number', 'rating', 'progress'].includes(p.type)) return ['eq', 'neq', 'gt', 'lt', 'empty', 'notEmpty'];
    if (p.type === 'date') return ['eq', 'before', 'after', 'empty', 'notEmpty'];
    if (['select', 'status', 'multi'].includes(p.type)) return ['eq', 'neq', 'empty', 'notEmpty'];
    return ['contains', 'eq', 'neq', 'empty', 'notEmpty'];
  };
  const set = (id: string, patch: Partial<Filter>) => onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  return (
    <div className="stack pad" style={{ width: 460, maxWidth: '92vw' }}>
      {!filters.length && <div className="muted small">{t('db.noFilters')}</div>}
      {filters.map((f) => {
        const p = db.properties.find((x) => x.id === f.prop);
        const needsValue = !['empty', 'notEmpty', 'checked', 'unchecked'].includes(f.op);
        return (
          <div className="filter-row" key={f.id}>
            <Select value={f.prop} options={db.properties.map((x) => ({ value: x.id, label: x.name }))} onChange={(prop) => set(f.id, { prop, op: opsFor(db.properties.find((x) => x.id === prop))[0], value: '' })} />
            <Select value={f.op} options={opsFor(p).map((op) => ({ value: op, label: t(`db.op.${op}` as TKey) }))} onChange={(op) => set(f.id, { op })} />
            {needsValue &&
              (p && ['select', 'status', 'multi'].includes(p.type) ? (
                <Select value={f.value} placeholder="—" options={(p.options || []).map((o) => ({ value: o.id, label: o.label }))} onChange={(value) => set(f.id, { value })} />
              ) : (
                <input className="input" type={p?.type === 'date' ? 'date' : ['number', 'rating', 'progress'].includes(p?.type || '') ? 'number' : 'text'} value={f.value ?? ''} onChange={(e) => set(f.id, { value: e.target.value })} />
              ))}
            <button className="icon-btn" onClick={() => onChange(filters.filter((x) => x.id !== f.id))}><X size={15} /></button>
          </div>
        );
      })}
      <button className="btn ghost sm" onClick={() => onChange([...filters, { id: uid('f'), prop: db.properties[0].id, op: opsFor(db.properties[0])[0], value: '' }])}>
        <Plus size={14} /> {t('db.addFilter')}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ tabela

interface TableProps {
  db: DatabaseData;
  props: Property[];
  rows: Row[];
  setRow: (id: string, c: Record<string, any>) => void;
  setProp: (p: Property) => void;
  addRow: () => Row;
  addProp: (t: PropType) => void;
  openRow: (id: string) => void;
  save: (db: DatabaseData) => void;
}

function TableView({ db, props, rows, setRow, setProp, addRow, addProp, openRow, save }: TableProps) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="table-scroll">
      <table className="db-table">
        <thead>
          <tr>
            {props.map((p) => (
              <PropHeader key={p.id} prop={p} db={db} setProp={setProp} save={save} />
            ))}
            <th className="th-add">
              <button ref={addRef} className="icon-btn sm" onClick={() => setAddOpen(!addOpen)} title={t('db.addProperty')}><Plus size={15} /></button>
              <Popover anchor={addRef.current} open={addOpen} onClose={() => setAddOpen(false)} align="right">
                <div className="menu type-menu">
                  {PROP_TYPES.map((ty) => (
                    <button key={ty} className="menu-item" onClick={() => (addProp(ty), setAddOpen(false))}>{t(`db.type.${ty}` as TKey)}</button>
                  ))}
                </div>
              </Popover>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {props.map((p, i) => (
                <td key={p.id} className={`td-${p.type}`}>
                  <div className="td-inner">
                    <Cell prop={p} row={r} onChange={(v) => setRow(r.id, { [p.id]: v })} onPropChange={setProp} />
                    {i === 0 && (
                      <button className="row-open" onClick={() => openRow(r.id)} title={t('db.open')}><Maximize2 size={13} /></button>
                    )}
                  </div>
                </td>
              ))}
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <button className="db-add-row" onClick={() => addRow()}><Plus size={15} /> {t('db.new')}</button>
    </div>
  );
}

function PropHeader({ prop, db, setProp, save }: { prop: Property; db: DatabaseData; setProp: (p: Property) => void; save: (d: DatabaseData) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <th className={`th-${prop.type}`}>
      <button ref={ref} className="th-btn" onClick={() => setOpen(!open)}>
        {prop.name}
        <MoreHorizontal size={14} className="th-more" />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)}>
        <div className="stack pad" style={{ width: 250 }}>
          <input className="input" value={prop.name} autoFocus onChange={(e) => setProp({ ...prop, name: e.target.value })} />
          {prop.type !== 'title' && (
            <Select
              value={prop.type}
              options={PROP_TYPES.map((ty) => ({ value: ty, label: t(`db.type.${ty}` as TKey) }))}
              onChange={(type) => setProp({ ...prop, type, options: prop.options || (['select', 'multi', 'status'].includes(type) ? [] : undefined) })}
            />
          )}
          {prop.type === 'number' && (
            <Select
              value={prop.format || 'number'}
              options={[
                { value: 'number', label: t('db.format.number') },
                { value: 'currency', label: t('db.format.currency') },
                { value: 'percent', label: t('db.format.percent') },
              ]}
              onChange={(format) => setProp({ ...prop, format: format as any })}
            />
          )}
          {prop.type !== 'title' && (
            <button
              className="menu-item danger"
              onClick={() => {
                save({ ...db, properties: db.properties.filter((p) => p.id !== prop.id) });
                setOpen(false);
              }}
            >
              <Trash2 size={15} /> {t('db.deleteProperty')}
            </button>
          )}
        </div>
      </Popover>
    </th>
  );
}

// ------------------------------------------------------------------ quadro

function BoardView({ db, view, rows, setRow, addRow, openRow, setProp, shown, addProp }: {
  db: DatabaseData; view: View; rows: Row[]; setRow: TableProps['setRow']; addRow: (c?: Record<string, any>) => Row; openRow: (id: string) => void;
  setProp: (p: Property) => void; shown: Property[]; addProp: (t: PropType) => void;
}) {
  const t = useT();
  const group = db.properties.find((p) => p.id === view.groupBy && (p.type === 'select' || p.type === 'status'));
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  if (!group)
    return (
      <div className="db-empty">
        <p>{t('db.board.needGroup')}</p>
        <button className="btn primary" onClick={() => addProp('status')}><Plus size={15} /> {t('db.type.status')}</button>
      </div>
    );
  const cols = [{ id: '', label: t('db.board.none'), color: 'gray' }, ...(group.options || [])];
  const tp = titleProp(db);
  return (
    <div className="board">
      {cols.map((c) => {
        const items = rows.filter((r) => (r.cells[group.id] || '') === c.id);
        if (c.id === '' && !items.length) return null;
        return (
          <div
            key={c.id || 'none'}
            className={'board-col' + (over === c.id ? ' over' : '')}
            onDragOver={(e) => (e.preventDefault(), setOver(c.id))}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              if (drag) setRow(drag, { [group.id]: c.id });
              setDrag(null);
              setOver(null);
            }}
          >
            <div className="board-col-head">
              <OptionPill label={c.label} color={c.color} />
              <span className="muted small">{items.length}</span>
            </div>
            {items.map((r) => (
              <div key={r.id} className="card" draggable onDragStart={() => setDrag(r.id)} onDragEnd={() => setDrag(null)} onClick={() => openRow(r.id)}>
                <div className="card-title">{r.cells[tp.id] || t('page.untitled')}</div>
                {shown.filter((p) => p.id !== tp.id && p.id !== group.id && r.cells[p.id] != null && r.cells[p.id] !== '' && !(Array.isArray(r.cells[p.id]) && !r.cells[p.id].length)).slice(0, 4).map((p) => (
                  <div key={p.id} className="card-prop" onClick={(e) => e.stopPropagation()}>
                    <Cell prop={p} row={r} compact readOnly={!['checkbox', 'rating'].includes(p.type)} onChange={(v) => setRow(r.id, { [p.id]: v })} onPropChange={setProp} />
                  </div>
                ))}
              </div>
            ))}
            <button className="board-add" onClick={() => openRow(addRow({ [group.id]: c.id }).id)}><Plus size={14} /> {t('db.new')}</button>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------- galeria

function GalleryView({ db, rows, openRow, addRow, shown, setRow, setProp }: { db: DatabaseData; rows: Row[]; openRow: (id: string) => void; addRow: () => Row; shown: Property[]; setRow: TableProps['setRow']; setProp: (p: Property) => void }) {
  const t = useT();
  const tp = titleProp(db);
  const urlProp = db.properties.find((p) => p.type === 'url');
  return (
    <div className="db-gallery">
      {rows.map((r, i) => (
        <div key={r.id} className="g-card" onClick={() => openRow(r.id)}>
          <div className="g-cover" style={{ background: `var(--cover-${i % 6})` }}>
            <span>{(r.cells[tp.id] || '?').slice(0, 1).toUpperCase()}</span>
          </div>
          <div className="g-body">
            <div className="card-title">{r.cells[tp.id] || t('page.untitled')}</div>
            {urlProp && r.cells[urlProp.id] && <div className="muted small ellipsis">{r.cells[urlProp.id]}</div>}
            {shown.filter((p) => p.id !== tp.id && p.id !== urlProp?.id && r.cells[p.id] != null && r.cells[p.id] !== '').slice(0, 3).map((p) => (
              <div key={p.id} className="card-prop" onClick={(e) => e.stopPropagation()}>
                <Cell prop={p} row={r} compact readOnly={!['checkbox', 'rating', 'password'].includes(p.type)} onChange={(v) => setRow(r.id, { [p.id]: v })} onPropChange={setProp} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="g-card add" onClick={() => openRow(addRow().id)}><Plus size={22} /> {t('db.new')}</button>
    </div>
  );
}

// ------------------------------------------------------------ calendário

function CalendarView({ db, view, rows, openRow, addRow, addProp }: { db: DatabaseData; view: View; rows: Row[]; openRow: (id: string) => void; addRow: (c?: Record<string, any>) => Row; addProp: (t: PropType) => void }) {
  const t = useT();
  const lang = useLang();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const dp = db.properties.find((p) => p.id === view.dateProp && p.type === 'date') || db.properties.find((p) => p.type === 'date');
  if (!dp)
    return (
      <div className="db-empty">
        <p>{t('db.calendar.needDate')}</p>
        <button className="btn primary" onClick={() => addProp('date')}><Plus size={15} /> {t('db.type.date')}</button>
      </div>
    );
  const tp = titleProp(db);
  const start = new Date(month);
  start.setDate(1 - ((start.getDay() + 6) % 7)); // semana começa na segunda
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = key(new Date());
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <h3>{new Intl.DateTimeFormat(LOCALES[lang], { month: 'long', year: 'numeric' }).format(month)}</h3>
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
        <button className="btn ghost sm" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>{t('common.today')}</button>
      </div>
      <div className="cal-grid">
        {weekdays.map((w) => <div key={w} className="cal-wd">{w}</div>)}
        {days.map((d) => {
          const k = key(d);
          const items = rows.filter((r) => r.cells[dp.id] === k);
          return (
            <div key={k} className={'cal-day' + (d.getMonth() !== month.getMonth() ? ' out' : '') + (k === today ? ' today' : '')} onDoubleClick={() => openRow(addRow({ [dp.id]: k }).id)}>
              <span className="cal-num">{d.getDate()}</span>
              {items.slice(0, 4).map((r) => (
                <button key={r.id} className="cal-item" onClick={() => openRow(r.id)}>{r.cells[tp.id] || t('page.untitled')}</button>
              ))}
              {items.length > 4 && <span className="muted small">+{items.length - 4}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ lista

function ListView({ db, rows, openRow, addRow, shown, setRow, setProp }: { db: DatabaseData; rows: Row[]; openRow: (id: string) => void; addRow: () => Row; shown: Property[]; setRow: TableProps['setRow']; setProp: (p: Property) => void }) {
  const t = useT();
  const tp = titleProp(db);
  return (
    <div className="db-list">
      {rows.map((r) => (
        <div key={r.id} className="list-row" onClick={() => openRow(r.id)}>
          <span className="list-title">{r.cells[tp.id] || t('page.untitled')}</span>
          <div className="list-props" onClick={(e) => e.stopPropagation()}>
            {shown.filter((p) => p.id !== tp.id && r.cells[p.id] != null && r.cells[p.id] !== '').slice(0, 4).map((p) => (
              <Cell key={p.id} prop={p} row={r} compact readOnly={!['checkbox', 'rating'].includes(p.type)} onChange={(v) => setRow(r.id, { [p.id]: v })} onPropChange={setProp} />
            ))}
          </div>
        </div>
      ))}
      <button className="db-add-row" onClick={() => openRow(addRow().id)}><Plus size={15} /> {t('db.new')}</button>
    </div>
  );
}

// ------------------------------------------------------- registro aberto

function RowModal({ db, row, onClose, setRow, setProp, setNotes, onDelete }: {
  db: DatabaseData; row: Row; onClose: () => void; setRow: TableProps['setRow']; setProp: (p: Property) => void; setNotes: (n: string) => void; onDelete: () => void;
}) {
  const t = useT();
  const tp = titleProp(db);
  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title={
        <input className="row-title" value={row.cells[tp.id] || ''} placeholder={t('page.untitled')} onChange={(e) => setRow(row.id, { [tp.id]: e.target.value })} autoFocus />
      }
      footer={
        <>
          <button className="btn ghost danger" onClick={onDelete}><Trash2 size={15} /> {t('common.delete')}</button>
          <div className="grow" />
          <button className="btn primary" onClick={onClose}>{t('common.done')}</button>
        </>
      }
    >
      <div className="row-props">
        {db.properties.filter((p) => p.id !== tp.id).map((p) => (
          <div className="row-prop" key={p.id}>
            <span className="row-prop-name">{p.name}</span>
            <div className="row-prop-val">
              <Cell prop={p} row={row} onChange={(v) => setRow(row.id, { [p.id]: v })} onPropChange={setProp} />
            </div>
          </div>
        ))}
      </div>
      <textarea className="input notes" rows={6} placeholder={t('db.notes')} value={row.notes || ''} onChange={(e) => setNotes(e.target.value)} />
    </Modal>
  );
}
