import type { DatabaseData, Page, Property, Row, Widget } from '../lib/types';
import { applyFilters, cellValue } from '../database/logic';

export interface Datum {
  key: string;
  label: string;
  value: number;
  series?: Record<string, number>;
  color?: number; // índice fixo da cor: a cor acompanha a categoria, não a posição
}

function bucketDate(v: string, b: Widget['dateBucket']): string {
  if (!v) return '';
  const d = new Date(v.length === 10 ? v + 'T12:00:00' : v);
  if (isNaN(d.getTime())) return '';
  const z = (n: number) => String(n).padStart(2, '0');
  if (b === 'year') return String(d.getFullYear());
  if (b === 'day') return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  if (b === 'week') {
    const t = new Date(d);
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return `${t.getFullYear()}-${z(t.getMonth() + 1)}-${z(t.getDate())}`;
  }
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}`;
}

/** Chaves de agrupamento de um registro (várias para multisseleção). */
function groupKeys(prop: Property | undefined, row: Row, w: Widget, emptyLabel: string): { key: string; label: string }[] {
  if (!prop) return [{ key: 'all', label: 'Total' }];
  const v = cellValue(prop, row);
  switch (prop.type) {
    case 'select':
    case 'status': {
      const o = prop.options?.find((x) => x.id === v);
      return [{ key: o?.id || '', label: o?.label || emptyLabel }];
    }
    case 'multi': {
      const arr: string[] = Array.isArray(v) ? v : [];
      if (!arr.length) return [{ key: '', label: emptyLabel }];
      return arr.map((id) => ({ key: id, label: prop.options?.find((o) => o.id === id)?.label || id }));
    }
    case 'checkbox':
      return [{ key: v ? '1' : '0', label: v ? '✔' : '✘' }];
    case 'date':
    case 'created': {
      const k = bucketDate(prop.type === 'created' ? new Date(row.createdAt).toISOString() : v, w.dateBucket || 'month');
      return [{ key: k, label: k || emptyLabel }];
    }
    default: {
      const s = v == null || v === '' ? '' : String(v);
      return [{ key: s, label: s || emptyLabel }];
    }
  }
}

function aggregate(values: number[], agg: Widget['agg']): number {
  if (agg === 'count') return values.length;
  const nums = values.filter((x) => !isNaN(x));
  if (!nums.length) return 0;
  if (agg === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (agg === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (agg === 'min') return Math.min(...nums);
  return Math.max(...nums);
}

export function computeWidget(w: Widget, pages: Record<string, Page>, emptyLabel: string): { data: Datum[]; seriesKeys: { key: string; label: string; color: number }[]; total: number } {
  const src = pages[w.source];
  const db: DatabaseData | undefined = src?.db;
  if (!db) return { data: [], seriesKeys: [], total: 0 };
  const rows = applyFilters(db, db.rows, w.filters || []);
  const gp = db.properties.find((p) => p.id === w.groupBy);
  const sp = w.seriesBy ? db.properties.find((p) => p.id === w.seriesBy) : undefined;
  const mp = db.properties.find((p) => p.id === w.measure);
  const measure = (r: Row) => (w.agg === 'count' || !mp ? 1 : Number(cellValue(mp, r)));

  const groups = new Map<string, { label: string; vals: number[]; series: Map<string, number[]> }>();
  const seriesLabels = new Map<string, string>();
  for (const r of rows) {
    for (const g of groupKeys(gp, r, w, emptyLabel)) {
      if (!groups.has(g.key)) groups.set(g.key, { label: g.label, vals: [], series: new Map() });
      const G = groups.get(g.key)!;
      const m = measure(r);
      G.vals.push(m);
      if (sp) {
        for (const s of groupKeys(sp, r, w, emptyLabel)) {
          seriesLabels.set(s.key, s.label);
          G.series.set(s.key, [...(G.series.get(s.key) || []), m]);
        }
      }
    }
  }
  let data: Datum[] = [...groups.entries()].map(([key, g]) => {
    const d: Datum = { key, label: g.label, value: aggregate(g.vals, w.agg) };
    if (sp) {
      d.series = {};
      for (const [sk, vals] of g.series) d.series[sk] = aggregate(vals, w.agg);
    }
    return d;
  });

  // Ordem: datas e opções seguem a ordem natural; demais conforme escolhido.
  const natural = gp && ['date', 'created'].includes(gp.type);
  if (natural || w.sort === 'label') {
    if (gp && (gp.type === 'select' || gp.type === 'status') && !natural && w.sort === 'label') {
      const order = (gp.options || []).map((o) => o.id);
      data.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    } else data.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  } else data.sort((a, b) => (w.sort === 'value-asc' ? a.value - b.value : b.value - a.value));

  if (w.limit && data.length > w.limit && !natural) {
    const head = data.slice(0, w.limit - 1);
    const rest = data.slice(w.limit - 1);
    head.push({ key: '__other', label: 'Outros', value: rest.reduce((s, d) => s + d.value, 0) });
    data = head;
  }
  // Cores estáveis: ordem das opções (seleção/status) ou ordem alfabética.
  const order = gp && gp.options?.length ? gp.options.map((o) => o.id) : [...data.map((d) => d.key)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  data.forEach((d) => (d.color = d.key === '__other' ? order.length : Math.max(0, order.indexOf(d.key))));
  const sOrder = sp && sp.options?.length ? sp.options.map((o) => o.id) : [...seriesLabels.keys()].sort();
  const seriesKeys = [...seriesLabels.entries()].map(([key, label]) => ({ key, label, color: Math.max(0, sOrder.indexOf(key)) })).sort((a, b) => a.color - b.color);
  const total = w.agg === 'count' ? rows.length : aggregate(rows.map(measure), w.agg);
  return { data, seriesKeys, total };
}
