import { usePrefs } from '../store/prefs';
/** Máscaras automáticas (CPF, CNPJ, CEP, telefone) e moedas por país. */

const digits = (s: string) => String(s ?? '').replace(/\D/g, '');

function apply(d: string, pattern: string): string {
  let out = '';
  let i = 0;
  for (const ch of pattern) {
    if (i >= d.length) break;
    if (ch === '0') out += d[i++];
    else out += ch;
  }
  return out;
}

export function maskCpf(s: string) {
  return apply(digits(s).slice(0, 11), '000.000.000-00');
}
export function maskCnpj(s: string) {
  return apply(digits(s).slice(0, 14), '00.000.000/0000-00');
}
export function maskCep(s: string) {
  return apply(digits(s).slice(0, 8), '00000-000');
}
export function maskPhone(s: string, format: 'br' | 'intl' = 'br'): string {
  const raw = String(s ?? '');
  if (format === 'intl' || raw.trim().startsWith('+')) {
    const d = digits(raw).slice(0, 15);
    if (!d) return raw.trim().startsWith('+') ? '+' : '';
    // +CC resto em grupos
    const cc = d.startsWith('55') ? 2 : d.startsWith('1') ? 1 : Math.min(2, d.length);
    const rest = d.slice(cc);
    if (d.startsWith('55') && rest.length) return '+55 ' + maskPhone(rest, 'br');
    return ('+' + d.slice(0, cc) + ' ' + rest.replace(/(\d{3,4})(?=\d)/g, '$1 ')).trim();
  }
  const d = digits(raw).slice(0, 11);
  if (d.length <= 10) return apply(d, '(00) 0000-0000');
  return apply(d, '(00) 00000-0000');
}

export function validCpf(s: string): boolean {
  const d = digits(s);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += +d[i] * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === +d[9] && calc(10) === +d[10];
}

export function validCnpj(s: string): boolean {
  const d = digits(s);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((s2, wi, i) => s2 + +d[i] * wi, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +d[12] && calc(13) === +d[13];
}

export function isComplete(type: string, v: string): boolean {
  const n = digits(v).length;
  if (type === 'cpf') return n === 11;
  if (type === 'cnpj') return n === 14;
  if (type === 'cep') return n === 8;
  if (type === 'phone') return n >= 10;
  return true;
}

// ------------------------------------------------------------------ moedas

export interface CurrencyInfo {
  code: string;
  locale: string;
  country: string; // emoji da bandeira + nome curto
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'BRL', locale: 'pt-BR', country: '🇧🇷 Brasil' },
  { code: 'USD', locale: 'en-US', country: '🇺🇸 Estados Unidos' },
  { code: 'EUR', locale: 'de-DE', country: '🇪🇺 Zona do euro' },
  { code: 'EUR', locale: 'es-ES', country: '🇪🇸 España' },
  { code: 'EUR', locale: 'pt-PT', country: '🇵🇹 Portugal' },
  { code: 'GBP', locale: 'en-GB', country: '🇬🇧 Reino Unido' },
  { code: 'ARS', locale: 'es-AR', country: '🇦🇷 Argentina' },
  { code: 'MXN', locale: 'es-MX', country: '🇲🇽 México' },
  { code: 'CLP', locale: 'es-CL', country: '🇨🇱 Chile' },
  { code: 'COP', locale: 'es-CO', country: '🇨🇴 Colombia' },
  { code: 'PEN', locale: 'es-PE', country: '🇵🇪 Perú' },
  { code: 'UYU', locale: 'es-UY', country: '🇺🇾 Uruguay' },
  { code: 'PYG', locale: 'es-PY', country: '🇵🇾 Paraguay' },
  { code: 'BOB', locale: 'es-BO', country: '🇧🇴 Bolivia' },
  { code: 'CAD', locale: 'en-CA', country: '🇨🇦 Canada' },
  { code: 'AUD', locale: 'en-AU', country: '🇦🇺 Australia' },
  { code: 'JPY', locale: 'ja-JP', country: '🇯🇵 日本' },
  { code: 'CNY', locale: 'zh-CN', country: '🇨🇳 中国' },
  { code: 'CHF', locale: 'de-CH', country: '🇨🇭 Schweiz' },
  { code: 'AOA', locale: 'pt-AO', country: '🇦🇴 Angola' },
  { code: 'MZN', locale: 'pt-MZ', country: '🇲🇿 Moçambique' },
  { code: 'INR', locale: 'en-IN', country: '🇮🇳 India' },
];

const REGION_CURRENCY: Record<string, string> = {
  BR: 'BRL', US: 'USD', PT: 'EUR', ES: 'EUR', FR: 'EUR', DE: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR',
  GB: 'GBP', AR: 'ARS', MX: 'MXN', CL: 'CLP', CO: 'COP', PE: 'PEN', UY: 'UYU', PY: 'PYG', BO: 'BOB', CA: 'CAD', AU: 'AUD', JP: 'JPY', CN: 'CNY',
  CH: 'CHF', AO: 'AOA', MZ: 'MZN', IN: 'INR', VE: 'VES', EC: 'USD',
};

/** Localidade e moeda padrão: segue o idioma do app (PT → BRL), usando a região do sistema quando ela fala o mesmo idioma. */
export function systemCurrency(): { locale: string; code: string } {
  const langs = (typeof navigator !== 'undefined' && (navigator.languages?.length ? navigator.languages : [navigator.language])) || ['pt-BR'];
  let app = '';
  try { const pl = usePrefs.getState().lang; app = pl === 'auto' ? '' : pl; } catch { /* fora do app */ }
  for (const l of langs) {
    if (app && !l.toLowerCase().startsWith(app)) continue;
    const region = l.split('-')[1]?.toUpperCase();
    if (region && REGION_CURRENCY[region]) return { locale: l, code: REGION_CURRENCY[region] };
  }
  const base = app || (langs[0] || 'pt').slice(0, 2);
  return base === 'pt' ? { locale: 'pt-BR', code: 'BRL' } : base === 'es' ? { locale: 'es-ES', code: 'EUR' } : { locale: 'en-US', code: 'USD' };
}

export function currencyDigits(code: string, locale: string): number {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatCurrency(v: any, code?: string, locale?: string, decimals?: number): string {
  const n = Number(v);
  if (v === '' || v == null || isNaN(n)) return '';
  const sys = systemCurrency();
  const c = code || sys.code;
  const loc = locale || (code ? CURRENCIES.find((x) => x.code === code)?.locale : sys.locale) || sys.locale;
  try {
    const d = decimals ?? currencyDigits(c, loc);
    return new Intl.NumberFormat(loc, { style: 'currency', currency: c, minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

/**
 * Máscara de digitação estilo caixa eletrônico: cada dígito entra pela direita.
 * "1" → 0,01 · "123" → 1,23 · "123456" → 1.234,56
 */
export function currencyFromTyping(text: string, fractionDigits: number): number | '' {
  const neg = /^\s*-/.test(text) || /-\s*$/.test(text);
  const d = digits(text);
  if (!d) return '';
  const n = parseInt(d, 10) / 10 ** fractionDigits;
  return neg ? -n : n;
}
