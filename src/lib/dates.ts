/**
 * Datas e horas sempre no padrão do idioma do app (PT: DD/MM/AAAA, 24 h),
 * no fuso horário local do aparelho — nunca no formato americano por acaso.
 */
import { usePrefs, detectLang } from '../store/prefs';
import { LOCALES } from '../i18n';

export function appLocale(): string {
  const l = usePrefs.getState().lang;
  return LOCALES[l === 'auto' ? detectLang() : l] || 'pt-BR';
}

const toDate = (v: number | string | Date) => {
  if (v instanceof Date) return v;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00');
  return new Date(v);
};

/** 22/11/2026 */
export function fmtDate(v: number | string | Date, locale = appLocale()) {
  const d = toDate(v);
  return isNaN(+d) ? '' : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 22/11/2026, 14:05 */
export function fmtDateTime(v: number | string | Date, locale = appLocale()) {
  const d = toDate(v);
  return isNaN(+d) ? '' : d.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: locale.startsWith('en-US') ? 'h12' : 'h23' });
}

/** 22 de novembro de 2026 */
export function fmtDateLong(v: number | string | Date, locale = appLocale()) {
  const d = toDate(v);
  return isNaN(+d) ? '' : d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "há 5 minutos", "ontem", ou a data. */
export function fmtRelative(v: number, locale = appLocale()) {
  const diff = (v - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const a = Math.abs(diff);
  if (a < 45) return rtf.format(Math.round(diff), 'second');
  if (a < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (a < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(v, locale);
}

/** Converte "AAAA-MM-DD" para o texto do idioma (DD/MM/AAAA em PT). */
export function isoToLocal(iso: string, locale = appLocale()) {
  if (!iso) return '';
  return fmtDate(iso, locale);
}

/** Ordem dos campos dia/mês/ano no idioma (ex.: ['d','m','y']). */
export function dateOrder(locale = appLocale()): ('d' | 'm' | 'y')[] {
  const parts = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date(2026, 10, 22));
  return parts.filter((p) => ['day', 'month', 'year'].includes(p.type)).map((p) => (p.type === 'day' ? 'd' : p.type === 'month' ? 'm' : 'y'));
}

/** Lê o texto digitado no padrão do idioma e devolve "AAAA-MM-DD" (ou '' se inválido). */
export function localToIso(text: string, locale = appLocale()): string {
  const nums = text.match(/\d+/g);
  if (!nums || nums.length < 3) return '';
  const ord = dateOrder(locale);
  const m: Record<string, number> = {};
  ord.forEach((k, i) => (m[k] = Number(nums[i])));
  let y = m.y;
  if (y < 100) y += 2000;
  const d = new Date(y, m.m - 1, m.d);
  if (d.getFullYear() !== y || d.getMonth() !== m.m - 1 || d.getDate() !== m.d) return '';
  return `${y}-${String(m.m).padStart(2, '0')}-${String(m.d).padStart(2, '0')}`;
}

/** "AAAA-MM-DD" no fuso local (toISOString usaria UTC e viraria o dia às 21h no Brasil). */
export function localIso(d: Date | number = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Máscara de digitação no padrão do idioma: 22112026 → 22/11/2026. */
export function maskDate(text: string, locale = appLocale()) {
  const sep = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date()).find((p) => p.type === 'literal')?.value || '/';
  const d = text.replace(/\D/g, '').slice(0, 8);
  const ord = dateOrder(locale);
  const sizes = ord.map((k) => (k === 'y' ? 4 : 2));
  const out: string[] = [];
  let i = 0;
  for (const n of sizes) { if (i >= d.length) break; out.push(d.slice(i, i + n)); i += n; }
  return out.join(sep.trim() || '/');
}
