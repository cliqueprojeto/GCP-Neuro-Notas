import { create } from 'zustand';
import type { UpdateFrequency } from '../lib/types';

export type Lang = 'pt' | 'en' | 'es';

interface Prefs {
  lang: Lang | 'auto';
  theme: string;
  updateFrequency: UpdateFrequency;
  lastUpdateCheck: number;
  skippedVersion: string;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  miniCalendar: boolean;
  graphColors: { link?: string; board?: string; child?: string; suggestion?: string; width?: number };
  set: (p: Partial<Omit<Prefs, 'set'>>) => void;
}

const KEY = 'gcp-notas:prefs';

function load(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export const usePrefs = create<Prefs>((set, get) => ({
  lang: 'auto',
  theme: 'neuro',
  updateFrequency: 'startup',
  lastUpdateCheck: 0,
  skippedVersion: '',
  sidebarCollapsed: false,
  sidebarWidth: 264,
  miniCalendar: true,
  graphColors: {},
  ...load(),
  set: (p) => {
    set(p);
    const { set: _s, ...rest } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* armazenamento indisponível */
    }
  },
}));

export function detectLang(): Lang {
  const langs = (navigator.languages?.length ? navigator.languages : [navigator.language || 'en']).map((l) => l.toLowerCase());
  for (const l of langs) {
    if (l.startsWith('pt')) return 'pt';
    if (l.startsWith('es')) return 'es';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

export function resolvedLang(): Lang {
  const l = usePrefs.getState().lang;
  return l === 'auto' ? detectLang() : l;
}
