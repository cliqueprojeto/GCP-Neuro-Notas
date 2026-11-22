import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowDownAZ, ArrowDownUp, ArrowDownZA, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, BookmarkPlus, CalendarDays, ChevronLeft, ChevronRight,
  Columns3, Copy, CopyPlus, Download, EyeOff, FileDown, FileSpreadsheet, Filter as FilterIcon, FilterX, GalleryVerticalEnd, GripVertical, LayoutList,
  Maximize2, MoreHorizontal, Plus, Printer, Search, Settings2, Table2, Trash2, Upload, X,
} from 'lucide-react';
import type { CalcKind, DatabaseData, Filter, Page, Property, PropType, Row, View, ViewType } from '../lib/types';
import { useT, useLang, LOCALES, type TKey } from '../i18n';
import { useVault } from '../store/vault';
import { toast } from '../store/ui';
import { ContextMenu, Modal, Popover, Select, longPress, type MenuEntry } from '../components/ui';
import { Cell, OptionPill } from './Cell';
import { COMPUTED, calcColumn, calcOptions, defaultCalc, convertType, distinctValues, isNumericProp, importMatrix, makeProperty, newRow, recompute, titleProp, visibleRows } from './logic';
import { PropConfig, TypeIcon, TypeMenu } from './fields';
import { printTable, readSpreadsheet, tableCsv, tablePdf, tableXlsx } from './io';
import { SaveTemplateModal } from '../templates/user';
import { uid } from '../lib/crypto';
import { normalize } from '../lib/doc';

const VIEW_ICONS: Record<ViewType, any> = { table: Table2, board: Columns3, gallery: GalleryVerticalEnd, calendar: CalendarDays, list: LayoutList };

type Ctx = { x: number; y: number; items: MenuEntry[] } | null;

export function DatabaseView({ page }: { page: Page }) {
  const t = useT();
  const update = useVault((s) => s.updatePage);
  const db = page.db!;
  const view = db.views.find((v) => v.id === db.activeView) || db.views[0];
  const [search, setSearch] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [menu, setMenu] = useState<'' | 'filter' | 'sort' | 'props' | 'view' | 'add' | 'export'>('');
  const [tplOpen, setTplOpen] = useState(false);
  const [importing, setImporting] = useState<{ name: string; sheets: { name: string; aoa: any[][] }[] } | null>(null);
  const refs = {
    filter: useRef<HTMLButtonElement>(null), sort: useRef<HTMLButtonElement>(null), props: useRef<HTMLButtonElement>(null),
    view: useRef<HTMLButtonElement>(null), add: useRef<HTMLButtonElement>(null), export: useRef<HTMLButtonElement>(null),
  };

  const save = (next: DatabaseData) => update(page.id, { db: recompute(next) });
  const setView = (patch: Partial<View>) => save({ ...db, views: db.views.map((v) => (v.id === view.id ? { ...v, ...patch } : v)) });
  const setRow = (id: string, cells: Record<string, any>) => save({ ...db, rows: db.rows.map((r) => (r.id === id ? { ...r, cells: { ...r.cells, ...cells }, updatedAt: Date.now() } : r)) });
  const setProp = (p: Property) => save({ ...db, properties: db.properties.map((x) => (x.id === p.id ? p : x)) });
  const addRow = (cells: Record<string, any> = {}, at?: number) => {
    const r = newRow(db, cells);
    const rows = [...db.rows];
    rows.splice(at ?? rows.length, 0, r);
    save({ ...db, rows });
    return r;
  };
  const delRow = (id: string) => save({ ...db, rows: db.rows.filter((r) => r.id !== id) });
  const addProp = (type: PropType, at?: number) => {
    const p = makeProperty(type, t(`db.type.${type}` as TKey), [t('db.status.todo'), t('db.status.doing'), t('db.status.done')]);
    const properties = [...db.properties];
    properties.splice(at ?? properties.length, 0, p);
    save({ ...db, properties });
    return p;
  };
  const rows = useMemo(() => visibleRows(db, view, search), [db, view, search]);
  const shown = db.properties.filter((p) => !(view.hidden || []).includes(p.id));
  const yes = t('common.yes');

  const addView = (type: ViewType) => {
    const v: View = { id: uid('v'), name: t(`db.view.${type}` as TKey), type, filters: [] };
    if (type === 'board') v.groupBy = db.properties.find((p) => p.type === 'status' || p.type === 'select')?.id;
    if (type === 'calendar') v.dateProp = db.properties.find((p) => p.type === 'date')?.id;
    save({ ...db, views: [...db.views, v], activeView: v.id });
    setMenu('');
  };

  const run = async (fn: () => Promise<unknown> | unknown) => {
    setMenu('');
    try {
      const out = await fn();
      if (out) toast(t('export.done'), 'success');
    } catch (e) {
      toast(t('export.error') + ' ' + String((e as Error).message || e), 'error');
    }
  };
  const doImport = async () => {
    try {
      const book = await readSpreadsheet();
      if (book?.sheets.length) setImporting(book);
    } catch (e) {
      toast(t('db.import.error') + ' ' + String((e as Error).message || e), 'error');
    }
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
        <button ref={refs.filter} title={t('db.filter')} className={'btn ghost sm' + (view.filters.length ? ' active' : '')} onClick={() => setMenu(menu === 'filter' ? '' : 'filter')}>
          <FilterIcon size={15} /> <span className="hide-xs">{t('db.filter')}</span>{view.filters.length ? ` (${view.filters.length})` : ''}
        </button>
        <button ref={refs.sort} title={t('db.sort')} className={'btn ghost sm' + (view.sort ? ' active' : '')} onClick={() => setMenu(menu === 'sort' ? '' : 'sort')}>
          <ArrowDownUp size={15} /> <span className="hide-xs">{t('db.sort')}</span>
        </button>
        <button ref={refs.props} title={t('db.properties')} className="btn ghost sm" onClick={() => setMenu(menu === 'props' ? '' : 'props')}><EyeOff size={15} /> <span className="hide-xs">{t('db.properties')}</span></button>
        <div className="db-tools">
          <button className="icon-btn sm" title={t('db.print')} onClick={() => printTable(page.title || t('page.untitled'), shown, rows, yes)}><Printer size={16} /></button>
          <button ref={refs.export} className="icon-btn sm" title={t('db.export')} onClick={() => setMenu(menu === 'export' ? '' : 'export')}><Download size={16} /></button>
          <button className="icon-btn sm" title={t('db.import')} onClick={doImport}><Upload size={16} /></button>
          <button className="icon-btn sm" title={t('utpl.titleDb')} onClick={() => setTplOpen(true)}><BookmarkPlus size={16} /></button>
          <button ref={refs.view} className="icon-btn sm" title={t('db.viewSettings')} onClick={() => setMenu(menu === 'view' ? '' : 'view')}><Settings2 size={16} /></button>
        </div>
        <button className="btn primary sm" onClick={() => setOpenRow(addRow().id)}><Plus size={15} /> {t('db.new')}</button>

        <Popover anchor={refs.export.current} open={menu === 'export'} onClose={() => setMenu('')} align="right">
          <div className="menu" style={{ width: 240 }}>
            <button className="menu-item" onClick={() => run(() => printTable(page.title || t('page.untitled'), shown, rows, yes))}><Printer size={15} /> {t('db.print')}</button>
            <button className="menu-item" onClick={() => run(() => tablePdf(page.title || t('page.untitled'), shown, rows, yes))}><FileDown size={15} /> {t('db.exportPdf')}</button>
            <button className="menu-item" onClick={() => run(() => tableXlsx(page.title || t('page.untitled'), shown, rows))}><FileSpreadsheet size={15} /> {t('db.exportXlsx')}</button>
            <button className="menu-item" onClick={() => run(() => tableCsv(page.title || t('page.untitled'), shown, rows))}><Download size={15} /> {t('db.exportCsv')}</button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => (setMenu(''), doImport())}><Upload size={15} /> {t('db.import')}</button>
            <p className="muted small pad-x">{t('db.export.hint')}</p>
          </div>
        </Popover>
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
                <TypeIcon type={p.type} size={12} /> {p.name}
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
            <button className="menu-item" onClick={() => save({ ...db, views: [...db.views, { ...view, id: uid('v'), name: view.name + ' 2' }] })}><Copy size={15} /> {t('db.duplicateView')}</button>
            <button className="menu-item" onClick={() => (setMenu(''), setTplOpen(true))}><BookmarkPlus size={15} /> {t('utpl.titleDb')}</button>
            {db.views.length > 1 && (
              <button className="menu-item danger" onClick={() => (save({ ...db, views: db.views.filter((v) => v.id !== view.id), activeView: db.views.find((v) => v.id !== view.id)!.id }), setMenu(''))}>
                <Trash2 size={15} /> {t('db.deleteView')}
              </button>
            )}
          </div>
        </Popover>
      </div>

      {view.filters.length > 0 && (
        <div className="filter-chips">
          {view.filters.map((f) => {
            const p = db.properties.find((x) => x.id === f.prop);
            if (!p) return null;
            return (
              <span key={f.id} className="filter-chip">
                <TypeIcon type={p.type} size={11} /> {p.name}: {f.op === 'in' ? `${(f.value || []).length} ${t('db.values')}` : t(`db.op.${f.op}` as TKey) + (f.value ? ` ${p.options?.find((o) => o.id === f.value)?.label ?? f.value}` : '')}
                <button onClick={() => setView({ filters: view.filters.filter((x) => x.id !== f.id) })}><X size={12} /></button>
              </span>
            );
          })}
          <button className="btn ghost xs" onClick={() => setView({ filters: [] })}><FilterX size={13} /> {t('db.clearFilters')}</button>
        </div>
      )}

      {view.type === 'table' && <TableView db={db} view={view} setView={setView} props={shown} rows={rows} setRow={setRow} setProp={setProp} addRow={addRow} addProp={addProp} openRow={setOpenRow} save={save} />}
      {view.type === 'board' && <BoardView db={db} view={view} rows={rows} setRow={setRow} addRow={addRow} openRow={setOpenRow} setProp={setProp} shown={shown} addProp={addProp} />}
      {view.type === 'gallery' && <GalleryView db={db} rows={rows} openRow={setOpenRow} addRow={addRow} shown={shown} setRow={setRow} setProp={setProp} />}
      {view.type === 'calendar' && <CalendarView db={db} view={view} rows={rows} openRow={setOpenRow} addRow={addRow} addProp={addProp} />}
      {view.type === 'list' && <ListView db={db} rows={rows} openRow={setOpenRow} addRow={addRow} shown={shown} setRow={setRow} setProp={setProp} />}

      <div className="db-foot muted small">{t('db.count', { n: rows.length, total: db.rows.length })}{view.type === 'table' && <span className="hide-mobile"> · {t('db.tableHint')}</span>}</div>

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
      {tplOpen && <SaveTemplateModal page={page} open onClose={() => setTplOpen(false)} />}
      {importing && (
        <ImportModal
          book={importing}
          onClose={() => setImporting(null)}
          onImport={(aoa, mode) => {
            const { db: next, added } = importMatrix(db, aoa, mode);
            save(next);
            toast(t('db.import.done', { n: added }), 'success');
            setImporting(null);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------- importação

function ImportModal({ book, onClose, onImport }: { book: { name: string; sheets: { name: string; aoa: any[][] }[] }; onClose: () => void; onImport: (aoa: any[][], mode: 'append' | 'replace') => void }) {
  const t = useT();
  const [sheet, setSheet] = useState(0);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const aoa = book.sheets[sheet]?.aoa || [];
  const head = aoa[0] || [];
  return (
    <Modal
      open
      onClose={onClose}
      width={720}
      title={<><Upload size={18} /> {t('db.import')}</>}
      footer={
        <>
          <div className="seg">
            <button className={mode === 'append' ? 'on' : ''} onClick={() => setMode('append')}>{t('db.import.append')}</button>
            <button className={mode === 'replace' ? 'on' : ''} onClick={() => setMode('replace')}>{t('db.import.replace')}</button>
          </div>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={aoa.length < 2} onClick={() => onImport(aoa, mode)}>{t('db.import.go', { n: Math.max(0, aoa.length - 1) })}</button>
        </>
      }
    >
      <p className="muted small">{book.name} · {t('db.import.hint')}</p>
      {book.sheets.length > 1 && <Select value={String(sheet)} options={book.sheets.map((s, i) => ({ value: String(i), label: s.name }))} onChange={(v) => setSheet(+v)} />}
      <div className="table-scroll import-preview">
        <table className="db-table">
          <thead><tr>{head.map((h, i) => <th key={i}><span className="th-btn">{String(h || `#${i + 1}`)}</span></th>)}</tr></thead>
          <tbody>
            {aoa.slice(1, 8).map((r, i) => (
              <tr key={i}>{head.map((_, j) => <td key={j}><div className="td-inner"><span className="cell-text">{r[j] instanceof Date ? r[j].toLocaleDateString() : String(r[j] ?? '')}</span></div></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {aoa.length > 8 && <p className="muted small">+{aoa.length - 8}…</p>}
    </Modal>
  );
}

// ----------------------------------------------------------------- filtros

export function FilterEditor({ db, filters, onChange }: { db: DatabaseData; filters: Filter[]; onChange: (f: Filter[]) => void }) {
  const t = useT();
  const opsFor = (p?: Property): Filter['op'][] => {
    if (!p) return ['contains'];
    if (p.type === 'checkbox') return ['checked', 'unchecked'];
    if (isNumericProp(p)) return ['eq', 'neq', 'gt', 'lt', 'empty', 'notEmpty'];
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
        const needsValue = !['empty', 'notEmpty', 'checked', 'unchecked', 'in'].includes(f.op);
        return (
          <div className="filter-row" key={f.id}>
            <Select value={f.prop} options={db.properties.map((x) => ({ value: x.id, label: x.name }))} onChange={(prop) => set(f.id, { prop, op: opsFor(db.properties.find((x) => x.id === prop))[0], value: '' })} />
            <Select value={f.op} options={[...(f.op === 'in' ? (['in'] as Filter['op'][]) : []), ...opsFor(p)].map((op) => ({ value: op, label: t(`db.op.${op}` as TKey) }))} onChange={(op) => set(f.id, { op })} />
            {needsValue &&
              (p && ['select', 'status', 'multi'].includes(p.type) ? (
                <Select value={f.value} placeholder="—" options={(p.options || []).map((o) => ({ value: o.id, label: o.label }))} onChange={(value) => set(f.id, { value })} />
              ) : (
                <input className="input" type={p?.type === 'date' ? 'date' : p && isNumericProp(p) ? 'number' : 'text'} value={f.value ?? ''} onChange={(e) => set(f.id, { value: e.target.value })} />
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
  view: View;
  setView: (patch: Partial<View>) => void;
  props: Property[];
  rows: Row[];
  setRow: (id: string, c: Record<string, any>) => void;
  setProp: (p: Property) => void;
  addRow: (c?: Record<string, any>, at?: number) => Row;
  addProp: (t: PropType, at?: number) => Property;
  openRow: (id: string) => void;
  save: (db: DatabaseData) => void;
}

function TableView({ db, view, setView, props, rows, setRow, setProp, addRow, addProp, openRow, save }: TableProps) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const [ctx, setCtx] = useState<Ctx>(null);
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [overRow, setOverRow] = useState<{ id: string; after: boolean } | null>(null);
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<{ id: string; after: boolean } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const idx = (id: string) => db.rows.findIndex((r) => r.id === id);
  const moveRow = (id: string, targetId: string, after: boolean) => {
    if (id === targetId) return;
    if (view.sort) return toast(t('db.dragNeedsNoSort'), 'info');
    const list = db.rows.filter((r) => r.id !== id);
    const row = db.rows[idx(id)];
    let at = list.findIndex((r) => r.id === targetId);
    if (at < 0 || !row) return;
    if (after) at++;
    list.splice(at, 0, row);
    save({ ...db, rows: list });
  };
  const shiftRow = (id: string, d: -1 | 1) => {
    const pos = rows.findIndex((r) => r.id === id);
    const other = rows[pos + d];
    if (other) moveRow(id, other.id, d === 1);
  };
  const moveCol = (id: string, targetId: string, after: boolean) => {
    if (id === targetId) return;
    const list = db.properties.filter((p) => p.id !== id);
    const col = db.properties.find((p) => p.id === id)!;
    let at = list.findIndex((p) => p.id === targetId);
    if (after) at++;
    list.splice(at, 0, col);
    save({ ...db, properties: list });
  };
  const duplicateRow = (r: Row) => {
    const copy = { ...newRow(db), cells: structuredClone(r.cells), notes: r.notes };
    const list = [...db.rows];
    list.splice(idx(r.id) + 1, 0, copy);
    save({ ...db, rows: list });
  };
  const rowMenu = (r: Row, x: number, y: number) =>
    setCtx({
      x, y,
      items: [
        { icon: <Maximize2 size={15} />, label: t('db.open'), onClick: () => openRow(r.id) },
        { sep: true },
        { icon: <ArrowUp size={15} />, label: t('db.row.insertAbove'), onClick: () => addRow({}, idx(r.id)) },
        { icon: <ArrowDown size={15} />, label: t('db.row.insertBelow'), onClick: () => addRow({}, idx(r.id) + 1) },
        { icon: <CopyPlus size={15} />, label: t('common.duplicate'), onClick: () => duplicateRow(r) },
        { sep: true },
        { icon: <ArrowUp size={15} />, label: t('db.row.moveUp'), onClick: () => shiftRow(r.id, -1), disabled: rows[0]?.id === r.id },
        { icon: <ArrowDown size={15} />, label: t('db.row.moveDown'), onClick: () => shiftRow(r.id, 1), disabled: rows[rows.length - 1]?.id === r.id },
        { sep: true },
        { icon: <Trash2 size={15} />, label: t('db.row.delete'), danger: true, onClick: () => save({ ...db, rows: db.rows.filter((x) => x.id !== r.id) }) },
      ],
    });

  return (
    <div className="table-scroll">
      <table className="db-table">
        <thead>
          <tr>
            <th className="th-handle" />
            {props.map((p) => (
              <PropHeader
                key={p.id}
                prop={p}
                db={db}
                view={view}
                setView={setView}
                setProp={setProp}
                save={save}
                addProp={addProp}
                moveCol={moveCol}
                dragging={dragCol}
                over={overCol?.id === p.id ? overCol.after : null}
                onDragStart={() => setDragCol(p.id)}
                onDragOver={(after) => setOverCol({ id: p.id, after })}
                onDrop={() => {
                  if (dragCol && overCol) moveCol(dragCol, overCol.id, overCol.after);
                  setDragCol(null);
                  setOverCol(null);
                }}
              />
            ))}
            <th className="th-add">
              <button ref={addRef} className="icon-btn sm" onClick={() => setAddOpen(!addOpen)} title={t('db.addProperty')}><Plus size={15} /></button>
              <Popover anchor={addRef.current} open={addOpen} onClose={() => setAddOpen(false)} align="right">
                <TypeMenu onPick={(ty) => (addProp(ty), setAddOpen(false))} />
              </Popover>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, n) => (
            <tr
              key={r.id}
              className={(dragRow === r.id ? 'dragging' : '') + (overRow?.id === r.id ? (overRow.after ? ' drop-after' : ' drop-before') : '')}
              onContextMenu={(e) => {
                const el = e.target as HTMLInputElement;
                // Com texto selecionado num campo, mantém o menu nativo (copiar/colar).
                if (/^(INPUT|TEXTAREA)$/.test(el.tagName) && el.selectionStart !== el.selectionEnd) return;
                e.preventDefault();
                rowMenu(r, e.clientX, e.clientY);
              }}
              onDragOver={(e) => {
                if (!dragRow) return;
                e.preventDefault();
                const rc = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setOverRow({ id: r.id, after: e.clientY > rc.top + rc.height / 2 });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragRow && overRow) moveRow(dragRow, overRow.id, overRow.after);
                setDragRow(null);
                setOverRow(null);
              }}
            >
              <td className="td-handle" {...longPress((x, y) => rowMenu(r, x, y))}>
                <div
                  className="row-grip"
                  draggable
                  onDragStart={(e) => (setDragRow(r.id), e.dataTransfer.setData('text/plain', r.id), (e.dataTransfer.effectAllowed = 'move'))}
                  onDragEnd={() => (setDragRow(null), setOverRow(null))}
                  onClick={(e) => rowMenu(r, e.clientX, e.clientY)}
                  title={t('db.row.menu')}
                >
                  <span className="row-num">{n + 1}</span>
                  <GripVertical size={14} className="grip-ic" />
                </div>
              </td>
              {props.map((p, i) => (
                <td key={p.id} className={`td-${p.type}` + (COMPUTED.includes(p.type) ? ' td-computed' : '')}>
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
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td className="td-handle" />
              {props.map((p) => (
                <td key={p.id} className="td-sum">
                  <CalcCell prop={p} rows={rows} calc={view.calcs?.[p.id] ?? defaultCalc(p)} onCalc={(c) => setView({ calcs: { ...(view.calcs || {}), [p.id]: c } })} />
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        )}
      </table>
      <button className="db-add-row" onClick={() => addRow()}><Plus size={15} /> {t('db.new')}</button>
      {ctx && <ContextMenu {...ctx} onClose={() => setCtx(null)} />}
    </div>
  );
}

/** Rodapé da coluna: escolha o cálculo (soma, média, contagem única, % preenchido…). */
function CalcCell({ prop, rows, calc, onCalc }: { prop: Property; rows: Row[]; calc: CalcKind; onCalc: (c: CalcKind) => void }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const r = calcColumn(prop, rows, calc);
  let shown: React.ReactNode = null;
  if (r) {
    if (r.kind === 'pct') shown = `${r.value.toLocaleString(LOCALES[lang])}%`;
    else if (r.kind === 'count') shown = Number(r.value).toLocaleString(LOCALES[lang]);
    else if (r.kind === 'date') shown = new Date(Number(r.value)).toLocaleDateString(LOCALES[lang]);
    else if (r.kind === 'days') shown = t('db.calc.days', { n: r.value });
    else {
      const fake = { id: 'x', cells: { [prop.id]: Math.round(Number(r.value) * 100) / 100 }, createdAt: 0, updatedAt: 0 } as Row;
      const fp = prop.type === 'progress' ? { ...prop, type: 'number' as PropType } : prop.type === 'rating' ? { ...prop, type: 'number' as PropType } : prop;
      shown = <Cell prop={fp} row={fake} compact readOnly onChange={() => undefined} onPropChange={() => undefined} />;
    }
  }
  return (
    <>
      <button ref={ref} className={'calc-cell' + (calc === 'none' ? ' empty' : '')} onClick={() => setOpen(!open)} title={t('db.calc.choose')}>
        {calc === 'none' ? <span className="calc-hint">{t('db.calc.add')} ▾</span> : <><small>{t(`db.calc.${calc}` as TKey)}</small> <b>{shown ?? '—'}</b></>}
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} align="right">
        <div className="menu" style={{ width: 230 }}>
          {calcOptions(prop).map((c) => (
            <button key={c} className={'menu-item' + (c === calc ? ' active' : '')} onClick={() => (onCalc(c), setOpen(false))}>
              <span className="grow">{t(`db.calc.${c}` as TKey)}</span>
              {c === calc && <span className="calc-check">✓</span>}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

// -------------------------------------------- cabeçalho com filtro estilo Excel

function PropHeader({ prop, db, view, setView, setProp, save, addProp, moveCol, dragging, over, onDragStart, onDragOver, onDrop }: {
  prop: Property; db: DatabaseData; view: View; setView: (p: Partial<View>) => void; setProp: (p: Property) => void; save: (d: DatabaseData) => void;
  addProp: (t: PropType, at?: number) => Property; moveCol: (id: string, target: string, after: boolean) => void;
  dragging: string | null; over: boolean | null; onDragStart: () => void; onDragOver: (after: boolean) => void; onDrop: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState<'' | 'menu' | 'filter' | 'type'>('');
  const ref = useRef<HTMLButtonElement>(null);
  const fref = useRef<HTMLButtonElement>(null);
  const filtered = view.filters.some((f) => f.prop === prop.id);
  const sorted = view.sort?.prop === prop.id ? view.sort.dir : null;
  const pos = db.properties.findIndex((p) => p.id === prop.id);
  const cycleSort = () => setView({ sort: sorted === 'asc' ? { prop: prop.id, dir: 'desc' } : sorted === 'desc' ? null : { prop: prop.id, dir: 'asc' } });
  const neighbor = (d: -1 | 1) => db.properties[pos + d];
  return (
    <th
      className={`th-${prop.type}` + (dragging === prop.id ? ' dragging' : '') + (over === null ? '' : over ? ' drop-after' : ' drop-before')}
      draggable
      onDragStart={(e) => {
        if ((e.target as HTMLElement).closest('.popover')) return;
        e.dataTransfer.setData('text/plain', prop.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        const rc = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onDragOver(e.clientX > rc.left + rc.width / 2);
      }}
      onDrop={(e) => (e.preventDefault(), onDrop())}
      onDragEnd={onDrop}
      onContextMenu={(e) => (e.preventDefault(), setOpen('menu'))}
    >
      <div className="th-wrap">
        <GripVertical size={12} className="th-grip" />
        <button ref={ref} className="th-btn" onClick={() => setOpen(open === 'menu' ? '' : 'menu')}>
          <TypeIcon type={prop.type} size={12} />
          <span className="th-name">{prop.name}</span>
        </button>
        <button ref={fref} className={'th-ic' + (filtered ? ' on' : '')} onClick={() => setOpen(open === 'filter' ? '' : 'filter')} title={t('db.filter')}>
          <FilterIcon size={13} />
        </button>
        <button className={'th-ic' + (sorted ? ' on' : '')} onClick={cycleSort} title={t('db.sort')}>
          {sorted === 'asc' ? <ArrowUp size={13} /> : sorted === 'desc' ? <ArrowDown size={13} /> : <ArrowUpDown size={13} />}
        </button>
      </div>
      <Popover anchor={fref.current} open={open === 'filter'} onClose={() => setOpen('')}>
        <ValueFilter db={db} prop={prop} view={view} setView={setView} onClose={() => setOpen('')} />
      </Popover>
      <Popover anchor={ref.current} open={open === 'menu' || open === 'type'} onClose={() => setOpen('')}>
        {open === 'type' ? (
          <TypeMenu current={prop.type} onPick={(type) => (save(convertType(db, prop, type)), setOpen('menu'))} />
        ) : (
          <div className="stack pad prop-menu" style={{ width: 320 }}>
            <input className="input" value={prop.name} autoFocus onChange={(e) => setProp({ ...prop, name: e.target.value })} />
            {prop.type !== 'title' && (
              <button className="type-current" onClick={() => setOpen('type')}>
                <TypeIcon type={prop.type} /> <span className="grow">{t(`db.type.${prop.type}` as TKey)}</span> <ChevronRight size={15} />
              </button>
            )}
            <PropConfig prop={prop} db={db} setProp={setProp} />
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => setView({ sort: { prop: prop.id, dir: 'asc' } })}><ArrowDownAZ size={15} /> {t('db.sortAsc')}</button>
            <button className="menu-item" onClick={() => setView({ sort: { prop: prop.id, dir: 'desc' } })}><ArrowDownZA size={15} /> {t('db.sortDesc')}</button>
            {prop.type !== 'title' && <button className="menu-item" onClick={() => (setView({ hidden: [...(view.hidden || []), prop.id] }), setOpen(''))}><EyeOff size={15} /> {t('db.hideColumn')}</button>}
            <button className="menu-item" onClick={() => (addProp('text', pos), setOpen(''))}><ArrowLeft size={15} /> {t('db.col.insertLeft')}</button>
            <button className="menu-item" onClick={() => (addProp('text', pos + 1), setOpen(''))}><ArrowRight size={15} /> {t('db.col.insertRight')}</button>
            {neighbor(-1) && <button className="menu-item" onClick={() => moveCol(prop.id, neighbor(-1).id, false)}><ChevronLeft size={15} /> {t('db.col.moveLeft')}</button>}
            {neighbor(1) && <button className="menu-item" onClick={() => moveCol(prop.id, neighbor(1).id, true)}><ChevronRight size={15} /> {t('db.col.moveRight')}</button>}
            {prop.type !== 'title' && (
              <button
                className="menu-item"
                onClick={() => {
                  const copy = { ...structuredClone(prop), id: uid('c'), name: prop.name + ' 2' };
                  const properties = [...db.properties];
                  properties.splice(pos + 1, 0, copy);
                  save({ ...db, properties, rows: db.rows.map((r) => ({ ...r, cells: { ...r.cells, [copy.id]: structuredClone(r.cells[prop.id]) } })) });
                  setOpen('');
                }}
              >
                <CopyPlus size={15} /> {t('db.col.duplicate')}
              </button>
            )}
            {prop.type !== 'title' && (
              <button
                className="menu-item danger"
                onClick={() => {
                  save({ ...db, properties: db.properties.filter((p) => p.id !== prop.id), views: db.views.map((v) => ({ ...v, filters: v.filters.filter((f) => f.prop !== prop.id), sort: v.sort?.prop === prop.id ? null : v.sort })) });
                  setOpen('');
                }}
              >
                <Trash2 size={15} /> {t('db.deleteProperty')}
              </button>
            )}
          </div>
        )}
      </Popover>
    </th>
  );
}

/** Filtro por valores da coluna, como o autofiltro do Excel. */
function ValueFilter({ db, prop, view, setView, onClose }: { db: DatabaseData; prop: Property; view: View; setView: (p: Partial<View>) => void; onClose: () => void }) {
  const t = useT();
  const all = useMemo(() => distinctValues(db, prop), [db, prop]);
  const current = view.filters.find((f) => f.prop === prop.id && f.op === 'in');
  const [sel, setSel] = useState<Set<string>>(() => new Set(current ? current.value : all));
  const [q, setQ] = useState('');
  const list = all.filter((v) => !q || normalize(v || t('db.blank')).includes(normalize(q)));
  const allOn = list.every((v) => sel.has(v));
  const toggle = (v: string) => {
    const n = new Set(sel);
    n.has(v) ? n.delete(v) : n.add(v);
    setSel(n);
  };
  const apply = () => {
    const chosen = q ? list.filter((v) => sel.has(v)) : all.filter((v) => sel.has(v));
    const others = view.filters.filter((f) => !(f.prop === prop.id && f.op === 'in'));
    if (!q && chosen.length === all.length) setView({ filters: others });
    else setView({ filters: [...others, { id: current?.id || uid('f'), prop: prop.id, op: 'in', value: chosen }] });
    onClose();
  };
  return (
    <div className="xfilter">
      <div className="xfilter-title"><TypeIcon type={prop.type} size={12} /> {prop.name}</div>
      <div className="xfilter-sort">
        <button className="menu-item" onClick={() => (setView({ sort: { prop: prop.id, dir: 'asc' } }), onClose())}><ArrowDownAZ size={15} /> {t('db.sortAsc')}</button>
        <button className="menu-item" onClick={() => (setView({ sort: { prop: prop.id, dir: 'desc' } }), onClose())}><ArrowDownZA size={15} /> {t('db.sortDesc')}</button>
      </div>
      <input className="input" autoFocus placeholder={t('db.searchValues')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply()} />
      <label className="xfilter-all">
        <input type="checkbox" checked={allOn} onChange={() => {
          const n = new Set(sel);
          list.forEach((v) => (allOn ? n.delete(v) : n.add(v)));
          setSel(n);
        }} />
        <b>{t('db.selectAll')}</b>
      </label>
      <div className="xfilter-list">
        {list.map((v) => (
          <label key={v || '__blank'}>
            <input type="checkbox" checked={sel.has(v)} onChange={() => toggle(v)} />
            <span className={v ? '' : 'muted'}>{v || t('db.blank')}</span>
          </label>
        ))}
        {!list.length && <div className="muted small">{t('editor.noResults')}</div>}
      </div>
      <div className="xfilter-foot">
        <button className="btn ghost xs" onClick={() => (setView({ filters: view.filters.filter((f) => f.prop !== prop.id) }), onClose())}>{t('db.clearFilter')}</button>
        <div className="grow" />
        <button className="btn primary sm" onClick={apply}>{t('db.apply')}</button>
      </div>
    </div>
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
