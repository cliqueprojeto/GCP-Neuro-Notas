/** Agenda unificada: datas de todas as bases de dados e notas do diário. */
import type { Page, Property, Row } from './types';
import { livePages } from '../store/vault';
import { titleProp } from '../database/logic';

export interface AgendaItem {
  id: string;
  date: string; // AAAA-MM-DD
  title: string;
  page: Page; // base de dados ou nota do diário
  row?: Row;
  prop?: Property; // propriedade de data usada
  kind: 'row' | 'journal';
  done: boolean;
  task: boolean; // a base tem status/caixa de conclusão (conta como tarefa)
  color: string;
}

const PALETTE = ['#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#22c55e', '#ef4444', '#06b6d4'];

export function colorFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function isDone(page: Page, row: Row): boolean {
  const db = page.db!;
  for (const p of db.properties) {
    const v = row.cells[p.id];
    if (p.type === 'status' && p.options?.length && v) {
      const o = p.options.find((x) => x.id === v);
      if (o && (o.color === 'green' || o.id === p.options[p.options.length - 1].id)) return true;
    }
    if (p.type === 'checkbox' && /conclu|feito|done|hecho|complet/i.test(p.name) && v) return true;
  }
  return false;
}

export function agenda(pagesMap: Record<string, Page>): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const page of livePages(pagesMap)) {
    if (page.journalDate) {
      out.push({ id: 'j' + page.id, date: page.journalDate, title: page.title, page, kind: 'journal', done: false, task: false, color: '#f59e0b' });
      continue;
    }
    if (page.type !== 'database' || !page.db) continue;
    const dates = page.db.properties.filter((p) => p.type === 'date');
    if (!dates.length) continue;
    const tp = titleProp(page.db);
    const color = colorFor(page.id);
    const task = page.db.properties.some((p) => p.type === 'status' || p.type === 'checkbox');
    for (const row of page.db.rows) {
      for (const dp of dates) {
        const v = row.cells[dp.id];
        if (!v || typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) continue;
        out.push({
          id: `${page.id}:${row.id}:${dp.id}`,
          date: v.slice(0, 10),
          title: String(row.cells[tp.id] || '') || '—',
          page, row, prop: dp, kind: 'row', done: isDone(page, row), task, color,
        });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function byDay(items: AgendaItem[]): Map<string, AgendaItem[]> {
  const m = new Map<string, AgendaItem[]>();
  for (const it of items) {
    const arr = m.get(it.date);
    if (arr) arr.push(it);
    else m.set(it.date, [it]);
  }
  return m;
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDay = (k: string) => new Date(k + 'T00:00:00');
export function addDays(k: string, n: number) {
  const d = parseDay(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
/** Segunda-feira da semana de `k`. */
export function weekStart(k: string) {
  const d = parseDay(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}
