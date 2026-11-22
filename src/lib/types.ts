export type PageType = 'page' | 'database' | 'report' | 'canvas';

export interface Page {
  id: string;
  type: PageType;
  title: string;
  icon: string; // emoji, ou "lucide:Nome:#cor"
  cover: string | null; // "g:3" (gradiente) ou data URL
  parentId: string | null;
  order: number;
  favorite: boolean;
  tags: string[];
  content: any; // documento do editor (JSON)
  db?: DatabaseData;
  report?: ReportData;
  canvas?: CanvasData;
  font?: 'sans' | 'serif' | 'mono';
  fullWidth?: boolean;
  journalDate?: string;
  mode?: 'doc' | 'edgeless';
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  purged?: boolean;
}

export type PropType =
  | 'title'
  | 'text'
  | 'number'
  | 'select'
  | 'multi'
  | 'status'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'password'
  | 'rating'
  | 'progress'
  | 'created';

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface Property {
  id: string;
  name: string;
  type: PropType;
  options?: SelectOption[];
  format?: 'number' | 'currency' | 'percent';
  width?: number;
}

export interface Row {
  id: string;
  cells: Record<string, any>;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type FilterOp = 'contains' | 'eq' | 'neq' | 'gt' | 'lt' | 'empty' | 'notEmpty' | 'checked' | 'unchecked' | 'before' | 'after';

export interface Filter {
  id: string;
  prop: string;
  op: FilterOp;
  value?: any;
}

export type ViewType = 'table' | 'board' | 'gallery' | 'calendar' | 'list';

export interface View {
  id: string;
  name: string;
  type: ViewType;
  groupBy?: string;
  dateProp?: string;
  sort?: { prop: string; dir: 'asc' | 'desc' } | null;
  filters: Filter[];
  hidden?: string[];
}

export interface DatabaseData {
  properties: Property[];
  rows: Row[];
  views: View[];
  activeView: string;
}

export type ChartType = 'bar' | 'hbar' | 'stacked' | 'line' | 'area' | 'pie' | 'donut' | 'kpi' | 'table' | 'radar';
export type Agg = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface Widget {
  id: string;
  title: string;
  type: ChartType;
  source: string; // id da base de dados
  groupBy: string; // id da propriedade
  seriesBy?: string; // segunda dimensão (empilhado / várias linhas)
  measure: string; // "count" ou id de propriedade numérica
  agg: Agg;
  filters: Filter[];
  dateBucket?: 'day' | 'week' | 'month' | 'year';
  sort: 'value-desc' | 'value-asc' | 'label';
  limit?: number;
  span: 1 | 2 | 3;
  palette?: string;
  colors?: string[];
  showLegend?: boolean;
  showLabels?: boolean;
}

export interface ReportData {
  widgets: Widget[];
  palette: string;
  customColors?: string[];
}

export interface Snapshot {
  id: string;
  pageId: string;
  at: number;
  title: string;
  content: any;
  db?: DatabaseData;
}

export type AiProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'groq'
  | 'deepseek'
  | 'xai'
  | 'openrouter'
  | 'ollama'
  | 'custom';

export interface AiProvider {
  id: string;
  kind: AiProviderId;
  name: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  models?: string[];
  autoModel?: boolean;
  checkedAt?: number;
}

export interface CloudAccount {
  provider: 'gdrive' | 'onedrive';
  email?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  connectedAt: number;
}

export type UpdateFrequency = 'startup' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'never';

export interface VaultSettings {
  ai: { providers: AiProvider[]; activeProvider?: string; language?: 'auto' | string; brain: boolean };
  cloud: {
    accounts: CloudAccount[];
    googleClientId?: string;
    googleClientSecret?: string;
    microsoftClientId?: string;
    autoBackup: 'off' | 'daily' | 'weekly' | 'on-close';
    keep: number;
    lastBackup?: number;
    lastSync?: number;
  };
  security: { autoLockMinutes: number; lockOnMinimize: boolean };
  editor: { font: 'sans' | 'serif' | 'mono'; width: 'normal' | 'wide'; spellcheck: boolean; fontSize: number };
  snapshots: { enabled: boolean; keep: number };
  chartPalettes: { id: string; name: string; colors: string[] }[];
}

export const DEFAULT_SETTINGS: VaultSettings = {
  ai: { providers: [], brain: true },
  cloud: { accounts: [], autoBackup: 'daily', keep: 10 },
  security: { autoLockMinutes: 15, lockOnMinimize: false },
  editor: { font: 'sans', width: 'normal', spellcheck: true, fontSize: 16 },
  snapshots: { enabled: true, keep: 25 },
  chartPalettes: [],
};

export interface CanvasNode {
  id: string;
  kind: 'note' | 'page' | 'image' | 'shape' | 'text' | 'frame' | 'draw';
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  pageId?: string;
  src?: string;
  color: string;
  shape?: 'rect' | 'ellipse' | 'diamond' | 'triangle';
  points?: number[]; // traço livre (x,y relativos ao nó)
  stroke?: number;
  fontSize?: number;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style?: 'straight' | 'elbow' | 'curve';
  color?: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  view: { x: number; y: number; zoom: number };
}
