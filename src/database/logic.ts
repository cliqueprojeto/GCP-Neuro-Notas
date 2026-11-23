import type { CalcKind, CondRule, DatabaseData, Filter, LineItem, Property, PropType, Row, SelectOption, TimerState, View } from '../lib/types';
import { uid } from '../lib/crypto';
import { appLocale, fmtDate, fmtDateTime, localIso } from '../lib/dates';
import { normalize } from '../lib/doc';
import { evaluate, toNumber, toText, type FValue } from './formula';
import { formatCurrency, maskCep, maskCnpj, maskCpf, maskPhone } from './masks';

export const OPTION_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'red'];

export const PROP_TYPES: PropType[] = [
  'text', 'number', 'currency', 'formula', 'conditional', 'select', 'multi', 'status', 'date', 'checkbox', 'url', 'email', 'phone',
  'cpf', 'cnpj', 'cep', 'password', 'rating', 'progress', 'created', 'files', 'location',
  'longtext', 'items', 'checklist', 'timer',
];

/** Grupos do menu "tipo de campo" (com cor e ícone, como no Notion). */
export const PROP_GROUPS: { key: 'basic' | 'choice' | 'media' | 'docs' | 'system' | 'work'; types: PropType[] }[] = [
  { key: 'basic', types: ['text', 'longtext', 'number', 'currency', 'formula', 'conditional', 'rating', 'progress'] },
  { key: 'work', types: ['items', 'checklist', 'timer'] },
  { key: 'choice', types: ['select', 'multi', 'status', 'checkbox', 'date'] },
  { key: 'media', types: ['files', 'location'] },
  { key: 'docs', types: ['phone', 'email', 'cpf', 'cnpj', 'cep', 'url', 'password'] },
  { key: 'system', types: ['created'] },
];

export const COMPUTED: PropType[] = ['formula', 'conditional', 'created'];

export function isNumericProp(p: Property) {
  if (['number', 'rating', 'progress', 'currency', 'items'].includes(p.type)) return true;
  if (p.type === 'formula' || p.type === 'conditional') return ['number', 'currency', 'percent'].includes(p.resultFormat || '');
  return false;
}

export function newOption(label: string, existing: SelectOption[] = []): SelectOption {
  return { id: uid('o'), label, color: OPTION_COLORS[(existing.length + 1) % OPTION_COLORS.length] };
}

export function titleProp(db: DatabaseData): Property {
  return db.properties.find((p) => p.type === 'title') || db.properties[0];
}

function fmtNumber(n: number, format: string | undefined, locale: string, p?: Property) {
  if (format === 'currency') return formatCurrency(n, p?.currency, p?.locale, p?.decimals);
  if (format === 'percent') return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: p?.decimals ?? 1 }).format(n / 100);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: p?.decimals ?? 4 }).format(n);
}

export function cellText(prop: Property, v: any, locale?: string): string {
  if (v == null || v === '') return '';
  const loc = locale || appLocale();
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
    case 'files':
      return (Array.isArray(v) ? v : []).map((f: any) => f?.name).filter(Boolean).join(', ');
    case 'location':
      return typeof v === 'object' ? v.label || `${v.lat?.toFixed?.(5)}, ${v.lon?.toFixed?.(5)}` : String(v);
    case 'created':
      return fmtDateTime(v, loc);
    case 'date':
      return fmtDate(v, loc);
    case 'items':
      return Array.isArray(v) ? formatCurrency(itemsTotal(v).total, prop.currency, prop.locale, prop.decimals) : '';
    case 'checklist': {
      if (!Array.isArray(v) || !v.length) return '';
      return `${v.filter((c: any) => c?.done).length}/${v.length}`;
    }
    case 'timer':
      return typeof v === 'object' ? fmtDuration(timerElapsed(v)) : '';
    case 'currency':
      return formatCurrency(v, prop.currency, prop.locale, prop.decimals);
    case 'number':
      return isNaN(Number(v)) ? String(v) : fmtNumber(Number(v), prop.format, loc, prop);
    case 'formula':
    case 'conditional': {
      const f = prop.resultFormat || 'auto';
      if (typeof v === 'boolean') return v ? '✔' : '✘';
      if (f === 'text') return String(v);
      if (f === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? new Date(v + 'T00:00:00').toLocaleDateString(loc) : String(v);
      if (typeof v === 'number') return fmtNumber(v, f === 'auto' ? 'number' : f, loc, prop);
      if (f !== 'auto' && !isNaN(Number(v)) && String(v).trim() !== '') return fmtNumber(Number(v), f, loc, prop);
      return String(v);
    }
    default:
      return String(v);
  }
}

export function cellValue(prop: Property, row: Row): any {
  if (prop.type === 'created') return row.createdAt;
  return row.cells[prop.id];
}

// ---------------------------------------------------------------- fórmulas

/** Valor de um campo como entra numa fórmula. */
function formulaInput(p: Property, row: Row, calc: (p: Property) => FValue): FValue {
  if (p.type === 'formula' || p.type === 'conditional') return calc(p);
  const v = cellValue(p, row);
  if (v == null || v === '') return isNumericProp(p) ? 0 : '';
  switch (p.type) {
    case 'number': case 'currency': case 'rating': case 'progress': return Number(v) || 0;
    case 'items': return Array.isArray(v) ? itemsTotal(v).total : 0;
    case 'timer': return typeof v === 'object' ? Math.round(timerElapsed(v) / 60000) : 0;
    case 'checklist': return Array.isArray(v) ? v.filter((c: any) => c?.done).length : 0;
    case 'checkbox': return !!v;
    case 'created': return localIso(v);
    case 'select': case 'status': case 'multi': return cellText(p, v);
    default: return String(v);
  }
}

function ruleMatches(rule: CondRule, value: FValue): boolean {
  const isNum = typeof value === 'number' || (rule.value !== undefined && rule.value !== '' && !isNaN(toNumber(rule.value)) && /^-?[\d.,\s]+$/.test(rule.value));
  const a = toNumber(value), b = toNumber(rule.value ?? ''), c = toNumber(rule.value2 ?? '');
  const sa = toText(value).trim().toLowerCase(), sb = String(rule.value ?? '').trim().toLowerCase();
  switch (rule.op) {
    case 'eq': return isNum && typeof value !== 'string' ? a === b : sa === sb;
    case 'neq': return isNum && typeof value !== 'string' ? a !== b : sa !== sb;
    case 'gt': return a > b;
    case 'gte': return a >= b;
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'between': return a >= Math.min(b, c) && a <= Math.max(b, c);
    case 'contains': return sa.includes(sb);
    case 'empty': return value == null || value === '' || value === false;
    case 'notEmpty': return !(value == null || value === '' || value === false);
  }
  return false;
}

/** Recalcula fórmulas e fórmulas condicionais e grava o resultado nas células. */
export function recompute(db: DatabaseData): DatabaseData {
  const computed = db.properties.filter((p) => p.type === 'formula' || p.type === 'conditional');
  if (!computed.length) return db;
  const byName = new Map<string, Property>();
  for (const p of db.properties) {
    byName.set(normalize(p.name.trim()), p);
    byName.set(p.id, p);
  }
  let changed = false;
  const rows = db.rows.map((row) => {
    const memo = new Map<string, FValue>();
    const stack = new Set<string>();
    const calc = (p: Property): FValue => {
      if (memo.has(p.id)) return memo.get(p.id)!;
      if (stack.has(p.id)) return '#CICLO';
      stack.add(p.id);
      let out: FValue = '';
      const resolve = (name: string): FValue => {
        const q = byName.get(normalize(name.trim())) || byName.get(name);
        if (!q) throw new Error(`campo "${name}" não existe`);
        return formulaInput(q, row, calc);
      };
      try {
        if (p.type === 'formula') out = evaluate(p.formula || '', resolve);
        else {
          out = '';
          let hit = false;
          for (const r of p.rules || []) {
            const src = db.properties.find((x) => x.id === r.prop);
            if (!src) continue;
            if (ruleMatches(r, formulaInput(src, row, calc))) {
              out = literal(r.result, resolve);
              hit = true;
              break;
            }
          }
          if (!hit) out = literal(p.elseResult || '', resolve);
        }
      } catch (e) {
        out = '#ERRO';
      }
      if (typeof out === 'number' && !isFinite(out)) out = '';
      if (typeof out === 'number') out = Math.round(out * 1e10) / 1e10;
      stack.delete(p.id);
      memo.set(p.id, out);
      return out;
    };
    let cells = row.cells;
    for (const p of computed) {
      const v = calc(p);
      if (cells[p.id] !== v) {
        if (cells === row.cells) cells = { ...row.cells };
        cells[p.id] = v;
      }
    }
    if (cells === row.cells) return row;
    changed = true;
    return { ...row, cells };
  });
  return changed ? { ...db, rows } : db;
}

function literal(s: string, resolve: (n: string) => FValue): FValue {
  const t = s.trim();
  if (t.startsWith('=')) return evaluate(t, resolve);
  if (t !== '' && /^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return s;
}

/** Cor da regra condicional que venceu (para pintar a célula). */
export function conditionalColor(prop: Property, row: Row): string | undefined {
  const v = row.cells[prop.id];
  if (v == null) return undefined;
  for (const r of prop.rules || []) if (r.color && String(literalText(r.result)) === String(v)) return r.color;
  return undefined;
}
const literalText = (s: string) => (/^-?\d+([.,]\d+)?$/.test(s.trim()) ? Number(s.trim().replace(',', '.')) : s);

// ---------------------------------------------------------------- máscaras

export function maskFor(prop: Property, text: string): string {
  switch (prop.type) {
    case 'cpf': return maskCpf(text);
    case 'cnpj': return maskCnpj(text);
    case 'cep': return maskCep(text);
    case 'phone': return maskPhone(text, prop.phoneFormat || 'br');
    default: return text;
  }
}

// ----------------------------------------------------------------- filtros

/** Texto usado no filtro de valores (estilo Excel). "" representa "(em branco)". */
export function filterKey(prop: Property, row: Row): string[] {
  const v = cellValue(prop, row);
  if (prop.type === 'multi') {
    const arr: string[] = Array.isArray(v) ? v : [];
    return arr.length ? arr.map((id) => prop.options?.find((o) => o.id === id)?.label ?? '') : [''];
  }
  if (prop.type === 'checkbox') return [v ? '✔' : '✘'];
  if (prop.type === 'password') return [v ? '••••' : ''];
  if (prop.type === 'created') return [fmtDate(v)];
  if (prop.type === 'date') return [v ? fmtDate(v) : ''];
  return [cellText(prop, v)];
}

export function distinctValues(db: DatabaseData, prop: Property): string[] {
  const set = new Set<string>();
  for (const r of db.rows) for (const k of filterKey(prop, r)) set.add(k);
  const order = prop.options?.map((o) => o.label);
  return [...set].sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    if (order) return order.indexOf(a) - order.indexOf(b);
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function matches(prop: Property, row: Row, f: Filter): boolean {
  const v = cellValue(prop, row);
  if (f.op === 'in') {
    const allowed: string[] = Array.isArray(f.value) ? f.value : [];
    return filterKey(prop, row).some((k) => allowed.includes(k));
  }
  const txt = normalize(cellText(prop, v));
  const fv = f.value;
  switch (f.op) {
    case 'contains':
      return txt.includes(normalize(String(fv ?? '')));
    case 'eq':
      if (prop.type === 'select' || prop.type === 'status') return v === fv;
      if (prop.type === 'multi') return Array.isArray(v) && v.includes(fv);
      if (isNumericProp(prop)) return Number(v) === Number(fv);
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

export function compareRows(p: Property, a: Row, b: Row): number {
  const va = cellValue(p, a);
  const vb = cellValue(p, b);
  const empty = (v: any) => v == null || v === '';
  if (empty(va) && !empty(vb)) return 1;
  if (!empty(va) && empty(vb)) return -1;
  if (isNumericProp(p) || p.type === 'created' || ((p.type === 'formula' || p.type === 'conditional') && typeof va === 'number' && typeof vb === 'number'))
    return (Number(va) || 0) - (Number(vb) || 0);
  if (p.type === 'checkbox') return (va ? 1 : 0) - (vb ? 1 : 0);
  if (p.type === 'select' || p.type === 'status') {
    const ia = p.options?.findIndex((o) => o.id === va) ?? -1;
    const ib = p.options?.findIndex((o) => o.id === vb) ?? -1;
    return ia - ib;
  }
  return cellText(p, va).localeCompare(cellText(p, vb), undefined, { numeric: true, sensitivity: 'base' });
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
      rows = [...rows].sort((a, b) => compareRows(p, a, b) * dir);
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
  if (type === 'formula') (p.formula = ''), (p.resultFormat = 'auto');
  if (type === 'conditional') (p.rules = []), (p.elseResult = ''), (p.resultFormat = 'text');
  if (type === 'phone') p.phoneFormat = 'br';
  if (type === 'timer') p.timerMode = 'up';
  return p;
}

/** Ajusta valores ao trocar o tipo de um campo (texto ↔ número ↔ seleção…). */
export function convertType(db: DatabaseData, prop: Property, type: PropType): DatabaseData {
  const next: Property = { ...makeProperty(type, prop.name), id: prop.id, width: prop.width };
  if (['select', 'multi', 'status'].includes(type) && prop.options?.length) next.options = prop.options;
  const opts = [...(next.options || [])];
  const rows = db.rows.map((r) => {
    const old = r.cells[prop.id];
    if (old == null || old === '') return r;
    const txt = cellText(prop, old);
    let v: any = old;
    if (type === 'number' || type === 'currency' || type === 'rating' || type === 'progress') {
      const n = toNumber(txt.replace(/[^\d,.-]/g, ''));
      v = txt.trim() === '' ? '' : n;
    } else if (type === 'select' || type === 'status') {
      if (!opts.some((o) => o.id === old)) {
        let o = opts.find((x) => x.label === txt);
        if (!o && txt) (o = newOption(txt, opts)), opts.push(o);
        v = o?.id ?? '';
      }
    } else if (type === 'multi') {
      const labels = txt.split(/\s*,\s*/).filter(Boolean);
      v = labels.map((l) => {
        let o = opts.find((x) => x.label === l);
        if (!o) (o = newOption(l, opts)), opts.push(o);
        return o.id;
      });
    } else if (type === 'checkbox') v = !!old && txt !== '✘' && txt.toLowerCase() !== 'false' && txt !== '0';
    else if (['cpf', 'cnpj', 'cep', 'phone'].includes(type)) v = maskFor({ ...next, type }, txt);
    else if (!COMPUTED.includes(type)) v = txt;
    return { ...r, cells: { ...r.cells, [prop.id]: v } };
  });
  if (opts.length) next.options = opts;
  return recompute({ ...db, properties: db.properties.map((p) => (p.id === prop.id ? next : p)), rows });
}

export function formatNumber(v: any, format: Property['format'], locale: string, prop?: Property) {
  const n = Number(v);
  if (v === '' || v == null || isNaN(n)) return '';
  return fmtNumber(n, format, locale, prop);
}

// ------------------------------------------------------------- importação

/** Converte uma matriz (planilha) em propriedades e linhas de uma base. */
export function importMatrix(db: DatabaseData, aoa: any[][], mode: 'append' | 'replace'): { db: DatabaseData; added: number } {
  const [head = [], ...body] = aoa.filter((r) => r && r.some((c) => c !== '' && c != null));
  const props: Property[] = db.properties.map((p) => ({ ...p, options: p.options ? [...p.options] : undefined }));
  const map: (Property | null)[] = head.map((h, i) => {
    const name = String(h ?? '').trim() || `Coluna ${i + 1}`;
    let p: Property | undefined = props.find((x) => normalize(x.name) === normalize(name));
    if (!p) {
      const col = body.map((r) => r[i]).filter((v) => v !== '' && v != null);
      const byName: PropType | null = /\bcpf\b/i.test(name) ? 'cpf' : /cnpj/i.test(name) ? 'cnpj' : /\bcep\b/i.test(name) ? 'cep'
        : /telefone|celular|phone|whats|fone/i.test(name) ? 'phone' : /e-?mail/i.test(name) ? 'email' : /^(site|url|link)/i.test(name) ? 'url' : null;
      const type: PropType = byName
        ? byName
        : !col.length
          ? 'text'
          : col.every((v) => typeof v === 'boolean' || /^(sim|não|nao|true|false|yes|no|✔|✘)$/i.test(String(v)))
            ? 'checkbox'
            : col.every((v) => v instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(String(v)))
              ? 'date'
              : col.every((v) => typeof v === 'number' || /^-?R?\$?\s?[\d.]+(,\d+)?$/.test(String(v).trim()))
                ? /R\$|\$/.test(col.map(String).join('')) ? 'currency' : 'number'
                : new Set(col.map(String)).size <= Math.max(6, col.length / 4) && col.length > 3 ? 'select' : 'text';
      p = makeProperty(props.some((x) => x.type === 'title') ? type : 'title', name);
      props.push(p);
    }
    return p;
  });
  const now = Date.now();
  const rows: Row[] = body.map((r, k) => {
    const cells: Record<string, any> = {};
    map.forEach((p, i) => {
      if (!p || COMPUTED.includes(p.type)) return;
      let v = r[i];
      if (v == null || v === '') return;
      if (v instanceof Date) v = localIso(v);
      switch (p.type) {
        case 'number': case 'currency': case 'rating': case 'progress':
          cells[p.id] = typeof v === 'number' ? v : toNumber(String(v).replace(/[^\d,.-]/g, ''));
          break;
        case 'checkbox':
          cells[p.id] = typeof v === 'boolean' ? v : /^(sim|true|yes|✔|1|x)$/i.test(String(v).trim());
          break;
        case 'date':
          cells[p.id] = String(v).slice(0, 10);
          break;
        case 'select': case 'status': {
          p.options ||= [];
          let o = p.options.find((x) => x.label === String(v));
          if (!o) (o = newOption(String(v), p.options)), p.options.push(o);
          cells[p.id] = o.id;
          break;
        }
        case 'multi': {
          p.options ||= [];
          cells[p.id] = String(v).split(/\s*[,;]\s*/).filter(Boolean).map((l) => {
            let o = p!.options!.find((x) => x.label === l);
            if (!o) (o = newOption(l, p!.options!)), p!.options!.push(o);
            return o.id;
          });
          break;
        }
        default:
          cells[p.id] = maskFor(p, String(v));
      }
    });
    return { id: uid('r'), cells, createdAt: now + k, updatedAt: now };
  });
  const next = recompute({ ...db, properties: props, rows: mode === 'replace' ? rows : [...db.rows, ...rows] });
  return { db: next, added: rows.length };
}

// ------------------------------------------------- cálculos do rodapé

export function calcOptions(p: Property): CalcKind[] {
  const base: CalcKind[] = ['none', 'count', 'filled', 'empty', 'unique', 'pctFilled', 'pctEmpty'];
  if (isNumericProp(p) || ((p.type === 'formula' || p.type === 'conditional') && p.resultFormat !== 'text'))
    return ['none', 'sum', 'avg', 'median', 'min', 'max', 'range', ...base.slice(1)];
  if (p.type === 'checkbox') return ['none', 'count', 'checked', 'unchecked', 'pctChecked'];
  if (p.type === 'date' || p.type === 'created') return ['none', 'earliest', 'latest', 'range', ...base.slice(1)];
  return base;
}

export function defaultCalc(p: Property): CalcKind {
  if (p.type === 'progress' || p.type === 'rating') return 'avg';
  if (isNumericProp(p)) return 'sum';
  return 'none';
}

const isEmptyVal = (v: any) => v == null || v === '' || (Array.isArray(v) && !v.length);

/** Calcula o resumo de uma coluna. `kind` diz como apresentar o resultado. */
export function calcColumn(p: Property, rows: Row[], calc: CalcKind): { value: number | string; kind: 'num' | 'count' | 'pct' | 'date' | 'days' } | null {
  if (calc === 'none' || !rows.length) return null;
  const vals = rows.map((r) => cellValue(p, r));
  const filled = vals.filter((v) => !isEmptyVal(v));
  const nums = filled.map(Number).filter((n) => !isNaN(n));
  const pct = (n: number) => ({ value: Math.round((n / rows.length) * 1000) / 10, kind: 'pct' as const });
  switch (calc) {
    case 'count': return { value: rows.length, kind: 'count' };
    case 'filled': return { value: filled.length, kind: 'count' };
    case 'empty': return { value: rows.length - filled.length, kind: 'count' };
    case 'unique': return { value: new Set(rows.flatMap((r) => filterKey(p, r)).filter((k) => k !== '')).size, kind: 'count' };
    case 'pctFilled': return pct(filled.length);
    case 'pctEmpty': return pct(rows.length - filled.length);
    case 'checked': return { value: vals.filter(Boolean).length, kind: 'count' };
    case 'unchecked': return { value: vals.filter((v) => !v).length, kind: 'count' };
    case 'pctChecked': return pct(vals.filter(Boolean).length);
    case 'sum': return nums.length ? { value: nums.reduce((a, b) => a + b, 0), kind: 'num' } : null;
    case 'avg': return nums.length ? { value: nums.reduce((a, b) => a + b, 0) / nums.length, kind: 'num' } : null;
    case 'median': {
      if (!nums.length) return null;
      const s = [...nums].sort((a, b) => a - b), m = Math.floor(s.length / 2);
      return { value: s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2, kind: 'num' };
    }
    case 'min': return nums.length ? { value: Math.min(...nums), kind: 'num' } : null;
    case 'max': return nums.length ? { value: Math.max(...nums), kind: 'num' } : null;
    case 'earliest': case 'latest': case 'range': {
      if (p.type === 'date' || p.type === 'created') {
        const ts = filled.map((v) => (p.type === 'created' ? Number(v) : Date.parse(String(v).slice(0, 10) + 'T00:00:00'))).filter((n) => !isNaN(n));
        if (!ts.length) return null;
        if (calc === 'range') return { value: Math.round((Math.max(...ts) - Math.min(...ts)) / 86400000), kind: 'days' };
        return { value: calc === 'earliest' ? Math.min(...ts) : Math.max(...ts), kind: 'date' };
      }
      return nums.length && calc === 'range' ? { value: Math.max(...nums) - Math.min(...nums), kind: 'num' } : null;
    }
  }
  return null;
}


// ---------------------------------------------------------- tarefas (Kanban)

/** Totais de Produtos/Serviços: concluído, pendente e geral. */
export function itemsTotal(items: LineItem[]) {
  let done = 0, pending = 0;
  for (const it of items || []) {
    const sub = (Number(it.qty) || 0) * (Number(it.unit) || 0);
    if (it.done) done += sub; else pending += sub;
  }
  return { done, pending, total: done + pending };
}

/** Tempo decorrido (ms) de um temporizador, contando o trecho em andamento. */
export function timerElapsed(st: TimerState | null | undefined, now = Date.now()) {
  if (!st) return 0;
  return (st.elapsed || 0) + (st.start ? Math.max(0, now - st.start) : 0);
}

/** Duração total de um temporizador regressivo (ms), ou null se for progressivo. */
export function timerBudget(p: Property, row: Row): number | null {
  if (p.timerMode !== 'down') return null;
  if (p.timerUntil) {
    const end = new Date(p.timerUntil).getTime();
    return isNaN(end) ? null : Math.max(0, end - row.createdAt);
  }
  return (p.timerMinutes || 0) * 60000;
}

export function fmtDuration(ms: number) {
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (neg ? '−' : '') + (h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
}

const DONE_RX = /conclu|finaliz|feito|done|complet|finished|hecho|terminad|listo|entregue|resolvid/i;

/** O registro está concluído? (campo de status na opção final ou com rótulo de concluído) */
export function isRowDone(db: DatabaseData, row: Row): boolean {
  const st = db.properties.filter((p) => p.type === 'status');
  if (!st.length) return false;
  return st.some((p) => {
    const v = row.cells[p.id];
    if (!v) return false;
    const opt = p.options?.find((o) => o.id === v);
    if (!opt) return false;
    return DONE_RX.test(opt.label) || (p.options!.length > 1 && p.options![p.options!.length - 1].id === v && !p.options!.some((o) => DONE_RX.test(o.label)));
  });
}

/** Congela/descongela temporizadores quando o registro é concluído/reaberto. */
export function syncTimers(db: DatabaseData, row: Row): Row {
  const timers = db.properties.filter((p) => p.type === 'timer');
  if (!timers.length) return row;
  const done = isRowDone(db, row);
  let cells = row.cells;
  for (const p of timers) {
    const st: TimerState | undefined = cells[p.id];
    if (done && st && !st.frozen) {
      cells = { ...cells, [p.id]: { elapsed: timerElapsed(st), start: null, frozen: true } };
    } else if (!done && st?.frozen) {
      cells = { ...cells, [p.id]: { ...st, frozen: false } };
    }
  }
  return cells === row.cells ? row : { ...row, cells };
}


/** Registra no histórico do cartão o que mudou entre duas versões do registro. */
export function logChange(db: DatabaseData, prev: Row, next: Row, words: { edited: string; empty: string }, locale?: string): Row {
  const acts = [...(next.activity || prev.activity || [])];
  const now = Date.now();
  for (const p of db.properties) {
    if (COMPUTED.includes(p.type) || p.type === 'timer') continue;
    const a = prev.cells[p.id], b = next.cells[p.id];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    let text: string;
    if (['select', 'status', 'multi', 'checkbox', 'date', 'rating', 'progress', 'number', 'currency'].includes(p.type))
      text = `${p.name}: ${cellText(p, a, locale) || words.empty} → ${cellText(p, b, locale) || words.empty}`;
    else text = `${p.name} ${words.edited}`;
    const last = acts[acts.length - 1];
    // edições seguidas do mesmo campo viram uma entrada só
    if (last && last.prop === p.id && now - last.at < 120000) {
      const from = last.text.includes('→') && text.includes('→') ? last.text.split(': ')[1]?.split(' → ')[0] : null;
      acts[acts.length - 1] = { ...last, at: now, text: from != null ? `${p.name}: ${from} → ${text.split(' → ')[1]}` : text };
    } else acts.push({ id: uid('ac'), at: now, text, prop: p.id });
  }
  return { ...next, activity: acts.slice(-200) };
}
