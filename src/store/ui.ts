import { create } from 'zustand';

export type Route =
  | { name: 'home' }
  | { name: 'page'; id: string }
  | { name: 'templates' }
  | { name: 'graph' }
  | { name: 'calendar'; date?: string; mode?: 'month' | 'week' | 'day' }
  | { name: 'boards' }
  | { name: 'presentations' }
  | { name: 'trash' }
  | { name: 'archive' }
  | { name: 'journal' }
  | { name: 'tasks' }
  | { name: 'settings'; tab?: string }
  | { name: 'support' }
  | { name: 'about' };

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

interface UiState {
  route: Route;
  history: Route[];
  future: Route[];
  palette: boolean;
  aiPanel: boolean;
  pendingRow: { pageId: string; rowId: string } | null; // abrir este cartão ao chegar na base
  aiContext: string[]; // páginas ligadas à conversa da IA
  mobileNav: boolean;
  toasts: Toast[];
  presentNow: string | null;
  go(r: Route): void;
  back(): void;
  forward(): void;
  set(p: Partial<Pick<UiState, 'palette' | 'aiPanel' | 'mobileNav' | 'presentNow' | 'pendingRow' | 'aiContext'>>): void;
  toast(text: string, kind?: Toast['kind']): void;
  dismiss(id: number): void;
}

let tid = 1;

function pushHistory() {
  try {
    window.history.pushState({ gcp: true }, '');
  } catch {
    /* ignora */
  }
}

function internalBack() {
  const s = useUi.getState();
  const h = s.history;
  if (!h.length) return;
  useUi.setState({ route: h[h.length - 1], history: h.slice(0, -1), future: [s.route, ...s.future], mobileNav: false });
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const s = useUi.getState();
    // Primeiro fecha painéis abertos; depois navega para a tela anterior.
    if (s.palette || s.aiPanel || s.mobileNav) {
      useUi.setState({ palette: false, aiPanel: false, mobileNav: false });
      if (s.history.length) pushHistory();
      return;
    }
    internalBack();
  });
}

export const useUi = create<UiState>((set, get) => ({
  route: { name: 'home' },
  history: [],
  future: [],
  palette: false,
  aiPanel: false,
  mobileNav: false,
  toasts: [],
  presentNow: null,
  pendingRow: null,
  aiContext: [],
  go(r) {
    const cur = get().route;
    if (JSON.stringify(cur) === JSON.stringify(r)) return set({ mobileNav: false });
    set({ route: r, history: [...get().history.slice(-50), cur], future: [], mobileNav: false });
    pushHistory();
  },
  back() {
    if (!get().history.length) return;
    // Mantém o histórico do sistema em sincronia (botão/gesto "voltar" do Android).
    if (window.history.state?.gcp) window.history.back();
    else internalBack();
  },
  forward() {
    const f = get().future;
    if (!f.length) return;
    set({ route: f[0], future: f.slice(1), history: [...get().history, get().route] });
  },
  set: (p) => set(p),
  toast(text, kind = 'info') {
    const id = tid++;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3200);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = (text: string, kind?: Toast['kind']) => useUi.getState().toast(text, kind);
