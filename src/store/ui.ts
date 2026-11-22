import { create } from 'zustand';

export type Route =
  | { name: 'home' }
  | { name: 'page'; id: string }
  | { name: 'templates' }
  | { name: 'graph' }
  | { name: 'trash' }
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
  mobileNav: boolean;
  toasts: Toast[];
  go(r: Route): void;
  back(): void;
  forward(): void;
  set(p: Partial<Pick<UiState, 'palette' | 'aiPanel' | 'mobileNav'>>): void;
  toast(text: string, kind?: Toast['kind']): void;
  dismiss(id: number): void;
}

let tid = 1;

export const useUi = create<UiState>((set, get) => ({
  route: { name: 'home' },
  history: [],
  future: [],
  palette: false,
  aiPanel: false,
  mobileNav: false,
  toasts: [],
  go(r) {
    const cur = get().route;
    if (JSON.stringify(cur) === JSON.stringify(r)) return;
    set({ route: r, history: [...get().history.slice(-50), cur], future: [], mobileNav: false });
  },
  back() {
    const h = get().history;
    if (!h.length) return;
    set({ route: h[h.length - 1], history: h.slice(0, -1), future: [get().route, ...get().future] });
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
