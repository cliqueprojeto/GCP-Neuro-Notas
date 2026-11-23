export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  vars: Record<string, string>;
}

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
];

export function getTheme(id: string): Theme {
  if (id === 'system-dark' || id === 'system') {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
    return dark ? THEMES[0] : THEMES.find((t) => t.id === 'snow')!;
  }
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: string) {
  const t = getTheme(id);
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = t.dark ? 'dark' : 'light';
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
