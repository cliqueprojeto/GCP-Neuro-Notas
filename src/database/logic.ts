import type { DatabaseData, Filter, Property, PropType, Row, SelectOption, View } from '../lib/types';
import { uid } from '../lib/crypto';
import { normalize } from '../lib/doc';

export const OPTION_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'red'];

export const PROP_TYPES: PropType[] = ['text', 'number', 'select', 'multi', 'status', 'date', 'checkbox', 'url', 'email', 'phone', 'password', 'rating', 'progress', 'created'];

export function newOption(label: string, existing: SelectOption[] = []): SelectOption {
  return { id: uid('o'), label, color: OPTION_COLORS[(existing.length + 1) % OPTION_COLORS.length] };
}

export function titleProp(db: DatabaseData): Property {
  return db.properties.find((p) => p.type === 'title') || db.properties[0];
}

export function cellText(prop: Property, v: any): string {
  if (v == null || v === '') return '';
  switch (prop.type) {
    case 'select':
    case 'status':
      return prop.options?.find((o) => o.id === v)?.label ?? '';
    case 'multi':
      return (Array.isArray(v) ? v : []).map((id: string) => prop.options?.find((o) => o.id === id)?.label ?? '').filter(Boolean).join(', ');
    case 'checkbox':
      return v ? '✔' : '';
    case 'password':
      return '••••••••';
    case 'created':
      return new Date(v).toLocaleString();
    default:
      return String(v);
  }
}

export function cellValue(prop: Property, row: Row): any {
  if (prop.type === 'created') return row.createdAt;
  return row.cells[prop.id];
}

function matches(prop: Property, row: Row, f: Filter): boolean {
  const v = cellValue(prop, row);
  const txt = normalize(cellText(prop, v));
  const fv = f.value;
  switch (f.op) {
    case 'contains':
      return txt.includes(normalize(String(fv ?? '')));
    case 'eq':
      if (prop.type === 'select' || prop.type === 'status') return v === fv;
      if (prop.type === 'multi') return Array.isArray(v) && v.includes(fv);
      if (prop.type === 'number' || prop.type === 'rating' || prop.type === 'progress') return Number(v) === Number(fv);
      return txt === normalize(String(fv ?? ''));
    case 'neq':
      if (prop.type === 'select' || prop.type === 'status') return v !== fv;
      if (prop.type === 'multi') return !(Array.isArray(v) && v.includes(fv));
      return txt !== normalize(String(fv ?? ''));
    case 'gt':
      return Number(v) > Number(fv);
    case 'lt':
      return Number(v) < Number(fv);
    case 'before':
      return !!v && String(v) < String(fv);
    case 'after':
      return !!v && String(v) > String(fv);
    case 'empty':
      return v == null || v === '' || (Array.isArray(v) && !v.length);
    case 'notEmpty':
      return !(v == null || v === '' || (Array.isArray(v) && !v.length));
    case 'checked':
      return !!v;
    case 'unchecked':
      return !v;
  }
  return true;
}

export function applyFilters(db: DatabaseData, rows: Row[], filters: Filter[]): Row[] {
  if (!filters?.length) return rows;
  return rows.filter((r) =>
    filters.every((f) => {
      const p = db.properties.find((x) => x.id === f.prop);
      return p ? matches(p, r, f) : true;
    }),
  );
}

export function visibleRows(db: DatabaseData, view: View, search: string): Row[] {
  let rows = applyFilters(db, db.rows, view.filters);
  if (search.trim()) {
    const q = normalize(search);
    rows = rows.filter((r) => db.properties.some((p) => p.type !== 'password' && normalize(cellText(p, cellValue(p, r))).includes(q)));
  }
  if (view.sort) {
    const p = db.properties.find((x) => x.id === view.sort!.prop);
    if (p) {
      const dir = view.sort.dir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const va = cellValue(p, a);
        const vb = cellValue(p, b);
        if (['number', 'rating', 'progress', 'created'].includes(p.type)) return ((Number(va) || 0) - (Number(vb) || 0)) * dir;
        if (p.type === 'checkbox') return ((va ? 1 : 0) - (vb ? 1 : 0)) * dir;
        if (p.type === 'select' || p.type === 'status') {
          const ia = p.options?.findIndex((o) => o.id === va) ?? -1;
          const ib = p.options?.findIndex((o) => o.id === vb) ?? -1;
          return (ia - ib) * dir;
        }
        return cellText(p, va).localeCompare(cellText(p, vb), undefined, { numeric: true }) * dir;
      });
    }
  }
  return rows;
}

export function newRow(db: DatabaseData, cells: Record<string, any> = {}): Row {
  const now = Date.now();
  const base: Record<string, any> = {};
  for (const p of db.properties) if (p.type === 'status' && p.options?.length) base[p.id] = p.options[0].id;
  return { id: uid('r'), cells: { ...base, ...cells }, createdAt: now, updatedAt: now };
}

export function makeProperty(type: PropType, name: string, status: [string, string, string] = ['A fazer', 'Em andamento', 'Concluído']): Property {
  const p: Property = { id: uid('c'), name, type };
  if (type === 'select' || type === 'multi') p.options = [];
  if (type === 'status')
    p.options = [
      { id: uid('o'), label: status[0], color: 'gray' },
      { id: uid('o'), label: status[1], color: 'blue' },
      { id: uid('o'), label: status[2], color: 'green' },
    ];
  if (type === 'number') p.format = 'number';
  return p;
}

export function formatNumber(v: any, format: Property['format'], locale: string) {
  const n = Number(v);
  if (v === '' || v == null || isNaN(n)) return '';
  if (format === 'currency') return new Intl.NumberFormat(locale, { style: 'currency', currency: locale === 'pt-BR' ? 'BRL' : locale === 'es-ES' ? 'EUR' : 'USD' }).format(n);
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(n / 100);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(n);
}
