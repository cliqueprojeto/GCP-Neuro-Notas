import { usePrefs } from '../store/prefs';
/** Estrutura visual do tema: muda formas, sombras, transparências e tipografia (não só as cores). */
export type Structure = 'classic' | 'glass' | 'flat' | 'soft' | 'editorial' | 'mesh';
export const STRUCTURES: Structure[] = ['classic', 'glass', 'flat', 'soft', 'editorial', 'mesh'];

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  vars: Record<string, string>;
  structure?: Structure;
  premium?: boolean;
}

/** Tema personalizado criado pelo usuário. */
export interface CustomTheme { dark: boolean; bg: string; panel: string; text: string; accent: string; accent2: string; structure: Structure; radius: number }
export const DEFAULT_CUSTOM: CustomTheme = { dark: true, bg: '#0f1226', panel: '#171b38', text: '#eef0ff', accent: '#8b5cf6', accent2: '#22d3ee', structure: 'glass', radius: 14 };

/** Monta um tema a partir de poucas cores-base. */
function theme(
  id: string,
  name: string,
  dark: boolean,
  c: {
    bg: string;
    side: string;
    panel: string;
    panel2: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
    accentText?: string;
  },
): Theme {
  return {
    id,
    name,
    dark,
    vars: {
      '--bg': c.bg,
      '--sidebar': c.side,
      '--panel': c.panel,
      '--panel-2': c.panel2,
      '--border': c.border,
      '--text': c.text,
      // mais contraste para quem tem baixa visão: o cinza secundário puxa para a cor do texto
      '--muted': `color-mix(in srgb, ${c.muted} ${dark ? 72 : 62}%, ${c.text})`,
      '--danger': dark ? '#f87171' : '#c81e1e',
      '--accent': c.accent,
      '--accent-2': c.accent2,
      '--accent-text': c.accentText ?? '#ffffff',
      '--accent-soft': `color-mix(in srgb, ${c.accent} 16%, transparent)`,
      '--accent-grad': `linear-gradient(135deg, ${c.accent}, ${c.accent2})`,
      '--hover': dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,20,40,0.05)',
      '--shadow': dark ? '0 18px 50px rgba(0,0,0,0.45)' : '0 18px 50px rgba(30,30,70,0.14)',
      '--code-bg': dark ? 'rgba(0,0,0,0.35)' : 'rgba(20,20,60,0.05)',
    },
  };
}

export const THEMES: Theme[] = [
  // Tema da marca GCP-Neuro Notas: violeta profundo, sinapses ciano e centelha dourada.
  theme('neuro', 'Neuro', true, {
    bg: '#0b0a24', side: '#080719', panel: '#13113a', panel2: '#1b1848', border: '#2a2663',
    text: '#efedff', muted: '#9a95d1', accent: '#8b5cf6', accent2: '#22d3ee',
  }),
  theme('neuro-light', 'Neuro Light', false, {
    bg: '#f7f6ff', side: '#efedfd', panel: '#ffffff', panel2: '#f2f0ff', border: '#e1ddf7',
    text: '#1c1840', muted: '#6b6596', accent: '#7c3aed', accent2: '#0891b2',
  }),
  theme('midnight', 'Midnight', true, {
    bg: '#0d0f1f', side: '#0a0c1a', panel: '#141733', panel2: '#1b1f42', border: '#272b55',
    text: '#eceefd', muted: '#9298c4', accent: '#8b5cf6', accent2: '#38bdf8',
  }),
  theme('obsidian', 'Obsidian', true, {
    bg: '#16151c', side: '#121117', panel: '#1e1c26', panel2: '#26232f', border: '#34303f',
    text: '#ebe8f2', muted: '#9a94aa', accent: '#a78bfa', accent2: '#f472b6',
  }),
  theme('aurora', 'Aurora', true, {
    bg: '#071a1d', side: '#05141a', panel: '#0c252b', panel2: '#113139', border: '#1d434c',
    text: '#e3f6f4', muted: '#86b3b0', accent: '#2dd4bf', accent2: '#a3e635', accentText: '#052e2b',
  }),
  theme('graphite', 'Graphite', true, {
    bg: '#111214', side: '#0c0d0f', panel: '#18191c', panel2: '#202226', border: '#2c2f34',
    text: '#ececee', muted: '#9a9ca3', accent: '#f59e0b', accent2: '#ef4444', accentText: '#1a1205',
  }),
  theme('ocean', 'Deep Ocean', true, {
    bg: '#0a1222', side: '#08101d', panel: '#0f1a30', panel2: '#14223d', border: '#20325a',
    text: '#e4ecfb', muted: '#8ea2c8', accent: '#3b82f6', accent2: '#06b6d4',
  }),
  theme('rose-noir', 'Rosé Noir', true, {
    bg: '#1a0f16', side: '#150b12', panel: '#24131e', panel2: '#2e1827', border: '#432336',
    text: '#fbe9f1', muted: '#c597ae', accent: '#ec4899', accent2: '#f97316',
  }),
  theme('paper', 'Paper', false, {
    bg: '#fbfaf7', side: '#f3f1ec', panel: '#ffffff', panel2: '#f6f4ef', border: '#e6e2d9',
    text: '#26231e', muted: '#7a7468', accent: '#7c3aed', accent2: '#db2777',
  }),
  theme('snow', 'Snow', false, {
    bg: '#f7f8fc', side: '#eef0f7', panel: '#ffffff', panel2: '#f3f5fb', border: '#dfe3ef',
    text: '#1b2033', muted: '#6b7390', accent: '#4f46e5', accent2: '#0ea5e9',
  }),
  theme('sakura', 'Sakura', false, {
    bg: '#fff8fa', side: '#fdeef3', panel: '#ffffff', panel2: '#fff2f6', border: '#f6d9e3',
    text: '#3a1f2a', muted: '#9a6b7d', accent: '#e11d74', accent2: '#a855f7',
  }),
  theme('mint', 'Mint', false, {
    bg: '#f5fbf8', side: '#e9f6f0', panel: '#ffffff', panel2: '#effaf5', border: '#d3ebe0',
    text: '#14302a', muted: '#5f857a', accent: '#059669', accent2: '#0891b2',
  }),
  theme('sand', 'Sand', false, {
    bg: '#fbf7f0', side: '#f4ecdf', panel: '#fffdf9', panel2: '#f8f1e6', border: '#eadfcd',
    text: '#33291b', muted: '#8a7a62', accent: '#c2410c', accent2: '#ca8a04',
  }),
  theme('lavender', 'Lavender', false, {
    bg: '#f9f7ff', side: '#f0ecfd', panel: '#ffffff', panel2: '#f4f1fe', border: '#e2dcf7',
    text: '#271f45', muted: '#7a70a0', accent: '#7c3aed', accent2: '#2563eb',
  }),
  // ---------- premium: cores e estrutura próprias ----------
  premium(theme('nebula', 'Nebula Glass', true, {
    bg: '#070616', side: '#0c0a24', panel: '#141133', panel2: '#1c1844', border: '#2d2866',
    text: '#f1efff', muted: '#a49fd6', accent: '#a855f7', accent2: '#22d3ee',
  }), 'glass', 'radial-gradient(900px 600px at 12% 8%, rgba(168,85,247,.35), transparent 60%), radial-gradient(800px 600px at 92% 90%, rgba(34,211,238,.25), transparent 60%), radial-gradient(600px 400px at 70% 20%, rgba(236,72,153,.18), transparent 60%), #070616'),
  premium(theme('carbon', 'Carbon Flat', true, {
    bg: '#0e0e10', side: '#0a0a0b', panel: '#161618', panel2: '#1d1d20', border: '#2f2f34',
    text: '#f4f4f5', muted: '#a1a1aa', accent: '#f59e0b', accent2: '#f97316', accentText: '#1c1305',
  }), 'flat'),
  premium(theme('emerald-night', 'Emerald Soft', true, {
    bg: '#06130f', side: '#081a14', panel: '#0d221b', panel2: '#122c23', border: '#1c3d31',
    text: '#e6fbf2', muted: '#8fc2ad', accent: '#10b981', accent2: '#84cc16', accentText: '#022c1e',
  }), 'soft'),
  premium(theme('noir', 'Noir Editorial', true, {
    bg: '#0c0b0a', side: '#100f0d', panel: '#161412', panel2: '#1e1b18', border: '#34302a',
    text: '#f5efe6', muted: '#b3a998', accent: '#d4a64a', accent2: '#e8d5a8', accentText: '#1a1204',
  }), 'editorial'),
  premium(theme('cyber', 'Cyber Mesh', true, {
    bg: '#05060f', side: '#080a18', panel: '#0e1124', panel2: '#141834', border: '#252c5a',
    text: '#eaf6ff', muted: '#93a7d8', accent: '#00e5ff', accent2: '#ff2bd6', accentText: '#001318',
  }), 'mesh', 'conic-gradient(from 210deg at 70% 30%, rgba(0,229,255,.22), rgba(255,43,214,.2), rgba(124,58,237,.22), rgba(0,229,255,.22)), radial-gradient(700px 500px at 15% 85%, rgba(255,43,214,.18), transparent 60%), #05060f'),
  premium(theme('cloud', 'Cloud Glass', false, {
    bg: '#eef3fb', side: '#f6f9ff', panel: '#ffffff', panel2: '#f2f6fd', border: '#d8e1f0',
    text: '#14213d', muted: '#5a6b8c', accent: '#2563eb', accent2: '#06b6d4',
  }), 'glass', 'radial-gradient(900px 600px at 10% 0%, rgba(37,99,235,.16), transparent 60%), radial-gradient(800px 600px at 95% 100%, rgba(6,182,212,.18), transparent 60%), radial-gradient(600px 500px at 60% 40%, rgba(236,72,153,.08), transparent 60%), #eef3fb'),
  premium(theme('swiss', 'Swiss Flat', false, {
    bg: '#ffffff', side: '#f4f4f4', panel: '#ffffff', panel2: '#f6f6f6', border: '#d4d4d4',
    text: '#0a0a0a', muted: '#4a4a4a', accent: '#e11d2a', accent2: '#111111',
  }), 'flat'),
  premium(theme('porcelain', 'Porcelain Soft', false, {
    bg: '#f3f1ee', side: '#f7f5f2', panel: '#fbfaf8', panel2: '#f2efea', border: '#e4dfd7',
    text: '#2b2724', muted: '#6e665e', accent: '#0f766e', accent2: '#b45309',
  }), 'soft'),
  premium(theme('editorial', 'Paper Editorial', false, {
    bg: '#fbf8f1', side: '#f5f0e4', panel: '#fffdf8', panel2: '#f7f1e3', border: '#e2d8c3',
    text: '#1f1a12', muted: '#5d5444', accent: '#9a3412', accent2: '#1e3a8a',
  }), 'editorial'),
  premium(theme('peach', 'Peach Mesh', false, {
    bg: '#fff6f0', side: '#fff9f5', panel: '#ffffff', panel2: '#fff3ea', border: '#f5dccb',
    text: '#3b1d10', muted: '#7d5543', accent: '#ea580c', accent2: '#db2777',
  }), 'mesh', 'radial-gradient(800px 600px at 0% 0%, rgba(251,146,60,.30), transparent 60%), radial-gradient(800px 600px at 100% 30%, rgba(219,39,119,.20), transparent 60%), radial-gradient(700px 500px at 40% 100%, rgba(250,204,21,.22), transparent 60%), #fff6f0'),
];

function premium(t: Theme, structure: Structure, appBg?: string): Theme {
  return { ...t, structure, premium: true, vars: { ...t.vars, ...(appBg ? { '--app-bg': appBg } : {}) } };
}

/** Monta o tema personalizado a partir das escolhas do usuário (as demais cores são derivadas). */
export function customTheme(c: CustomTheme): Theme {
  const mix = (a: string, b: string, p: number) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
  const th = theme('custom', 'Personalizado', c.dark, {
    bg: c.bg, side: mix(c.bg, c.dark ? '#000' : '#fff', 70), panel: c.panel, panel2: mix(c.panel, c.text, 94), border: mix(c.panel, c.text, 82),
    text: c.text, muted: mix(c.text, c.bg, 62), accent: c.accent, accent2: c.accent2,
  });
  th.vars['--radius'] = c.radius + 'px';
  th.vars['--radius-sm'] = Math.max(4, c.radius - 4) + 'px';
  if (c.structure === 'glass' || c.structure === 'mesh')
    th.vars['--app-bg'] = `radial-gradient(900px 600px at 10% 5%, ${mix(c.accent, 'transparent', 30)}, transparent 60%), radial-gradient(800px 600px at 95% 95%, ${mix(c.accent2, 'transparent', 26)}, transparent 60%), ${c.bg}`;
  return { ...th, structure: c.structure, premium: true };
}

export function getTheme(id: string): Theme {
  if (id === 'custom') return customTheme({ ...DEFAULT_CUSTOM, ...(usePrefs.getState().customTheme || {}) });
  if (id === 'system-dark' || id === 'system') {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
    return dark ? THEMES[0] : THEMES.find((t) => t.id === 'snow')!;
  }
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: string) {
  const t = getTheme(id);
  const root = document.documentElement;
  ['--app-bg', '--radius', '--radius-sm'].forEach((k) => root.style.removeProperty(k));
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = t.dark ? 'dark' : 'light';
  root.dataset.structure = t.structure || 'classic';
  root.style.colorScheme = t.dark ? 'dark' : 'light';
  (window as any).GcpNative?.setLightBars?.(!t.dark); // ícones da barra de status no Android
}

export const COVER_GRADIENTS = [
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#0ea5e9,#8b5cf6)',
  'linear-gradient(135deg,#10b981,#06b6d4)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#1e293b,#6366f1)',
  'linear-gradient(135deg,#f472b6,#fde68a)',
  'linear-gradient(135deg,#22d3ee,#a3e635)',
  'linear-gradient(120deg,#0f172a,#334155 60%,#64748b)',
  'radial-gradient(circle at 20% 30%,#a78bfa,transparent 50%),radial-gradient(circle at 80% 70%,#f472b6,transparent 50%),#1e1b4b',
  'radial-gradient(circle at 30% 70%,#34d399,transparent 55%),radial-gradient(circle at 75% 25%,#60a5fa,transparent 50%),#0c4a6e',
  'linear-gradient(135deg,#fde68a,#fca5a5,#c4b5fd)',
  'linear-gradient(160deg,#111827,#7c3aed 55%,#f472b6)',
];

export function coverCss(cover: string | null): string | undefined {
  if (!cover) return undefined;
  if (cover.startsWith('g:')) return COVER_GRADIENTS[+cover.slice(2) % COVER_GRADIENTS.length];
  return `center / cover no-repeat url("${cover}")`;
}

/** Paletas de gráficos. "GCP" segue a ordem categórica validada para daltonismo. */
export const CHART_PALETTES: { id: string; name: string; light: string[]; dark: string[] }[] = [
  {
    id: 'gcp',
    name: 'GCP (acessível)',
    light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
  },
  {
    id: 'violet',
    name: 'Violeta',
    light: ['#7c3aed', '#db2777', '#0891b2', '#f59e0b', '#10b981', '#6366f1', '#f43f5e', '#84cc16'],
    dark: ['#a78bfa', '#f472b6', '#22d3ee', '#fbbf24', '#34d399', '#818cf8', '#fb7185', '#a3e635'],
  },
  {
    id: 'ocean',
    name: 'Oceano',
    light: ['#1d4ed8', '#0891b2', '#0d9488', '#4f46e5', '#0284c7', '#059669', '#7c3aed', '#64748b'],
    dark: ['#60a5fa', '#22d3ee', '#2dd4bf', '#818cf8', '#38bdf8', '#34d399', '#a78bfa', '#94a3b8'],
  },
  {
    id: 'sunset',
    name: 'Pôr do sol',
    light: ['#ea580c', '#e11d48', '#ca8a04', '#c026d3', '#dc2626', '#d97706', '#9333ea', '#be123c'],
    dark: ['#fb923c', '#fb7185', '#facc15', '#e879f9', '#f87171', '#fbbf24', '#c084fc', '#fda4af'],
  },
  {
    id: 'forest',
    name: 'Floresta',
    light: ['#15803d', '#65a30d', '#0f766e', '#a16207', '#166534', '#4d7c0f', '#115e59', '#854d0e'],
    dark: ['#4ade80', '#a3e635', '#2dd4bf', '#facc15', '#86efac', '#bef264', '#5eead4', '#fde047'],
  },
  {
    id: 'mono',
    name: 'Monocromático',
    light: ['#312e81', '#4338ca', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#1e1b4b', '#3730a3'],
    dark: ['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#e0e7ff', '#4338ca', '#eef2ff'],
  },
];

export const TAG_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'red'];
