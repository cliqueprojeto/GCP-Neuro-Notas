import { pt, type Dict } from './pt';
import { en } from './en';
import { es } from './es';
import { usePrefs, detectLang, type Lang } from '../store/prefs';

export type TKey = keyof Dict;
const DICTS: Record<Lang, Dict> = { pt, en, es };

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[lang][key] ?? pt[key] ?? String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useLang(): Lang {
  const l = usePrefs((s) => s.lang);
  return l === 'auto' ? detectLang() : l;
}

export function useT() {
  const lang = useLang();
  return (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

/** Para uso fora de componentes React. */
export function t(key: TKey, vars?: Record<string, string | number>) {
  const l = usePrefs.getState().lang;
  return translate(l === 'auto' ? detectLang() : l, key, vars);
}

export const LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
