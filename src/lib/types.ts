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
  presentation?: boolean; // aparece em Apresentações
  presFolders?: string[]; // pastas de apresentações (pode estar em várias)
  chat?: { messages: { role: 'user' | 'assistant'; content: string; sources?: string[] }[]; provider?: string; contextId?: string };
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
  | 'created'
  | 'currency'
  | 'formula'
  | 'conditional'
  | 'cpf'
  | 'cnpj'
  | 'cep'
  | 'files'
  | 'location';

export type CondOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'contains' | 'empty' | 'notEmpty';

/** Regra de fórmula condicional: SE [campo] [op] [valor] ENTÃO [resultado]. */
export interface CondRule {
  id: string;
  prop: string;
  op: CondOp;
  value?: string;
  value2?: string; // fim do intervalo (op "between")
  result: string; // texto, número ou fórmula começando com "="
  color?: string;
}

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
  currency?: string; // código ISO (BRL, USD, EUR…); vazio = detectado pelo sistema
  locale?: string; // formato regional; vazio = do sistema
  decimals?: number;
  formula?: string; // expressão com {Campo}
  resultFormat?: 'auto' | 'number' | 'currency' | 'percent' | 'text' | 'date';
  rules?: CondRule[];
  elseResult?: string;
  phoneFormat?: 'br' | 'intl';
}

export interface Row {
  id: string;
  cells: Record<string, any>;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type FilterOp = 'in' | 'contains' | 'eq' | 'neq' | 'gt' | 'lt' | 'empty' | 'notEmpty' | 'checked' | 'unchecked' | 'before' | 'after';

export interface Filter {
  id: string;
  prop: string;
  op: FilterOp;
  value?: any;
}

export type ViewType = 'table' | 'board' | 'gallery' | 'calendar' | 'list' | 'gantt' | 'timeline' | 'map' | 'files';

export interface View {
  id: string;
  name: string;
  type: ViewType;
  groupBy?: string;
  dateProp?: string;
  endProp?: string; // Gantt: data de término
  locProp?: string; // Mapa: campo de local
  filesProp?: string; // Anexos: campo de arquivos
  scale?: 'day' | 'week' | 'month'; // Gantt
  sort?: { prop: string; dir: 'asc' | 'desc' } | null;
  filters: Filter[];
  hidden?: string[];
  calcs?: Record<string, CalcKind>; // cálculo do rodapé por coluna
  hiddenTab?: boolean; // visão oculta da barra de abas
}

export type CalcKind =
  | 'none' | 'sum' | 'avg' | 'median' | 'min' | 'max' | 'range'
  | 'count' | 'filled' | 'empty' | 'unique' | 'pctFilled' | 'pctEmpty'
  | 'checked' | 'unchecked' | 'pctChecked' | 'earliest' | 'latest';

export interface FileRef { id: string; name: string; type: string; size: number; data: string; addedAt: number }
export interface GeoPoint { label: string; lat: number; lon: number }

export interface DatabaseData {
  properties: Property[];
  rows: Row[];
  views: View[];
  activeView: string;
  defaultView?: string; // visão aberta ao entrar na base
}

/** Modelo criado pelo usuário (estrutura de tabela ou documento). */
export interface UserTemplate {
  id: string;
  kind: 'database' | 'page' | 'canvas' | 'report';
  name: string;
  description: string;
  icon: string; // "lucide:Nome:#cor" ou emoji
  color: string;
  page: Partial<Page>; // estrutura salva (bases sem linhas, se assim escolhido)
  withRows?: boolean;
  createdAt: number;
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
  ai: { providers: AiProvider[]; activeProvider?: string; language?: 'auto' | string; brain: boolean; saveChats?: boolean };
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
  templates?: UserTemplate[];
  notion?: { token: string; lastSync?: number; links?: Record<string, string> };
  presFolders?: PresFolder[];
}

export interface PresFolder { id: string; name: string; icon: string; color: string }

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
  kind: 'note' | 'page' | 'image' | 'shape' | 'text' | 'frame' | 'draw' | 'button' | 'chart';
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  pageId?: string;
  src?: string;
  color: string;
  shape?: 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'poly';
  poly?: string; // pontos do polígono (0–100) quando shape = 'poly'
  corner?: 'square' | 'rounded' | 'pill';
  points?: number[]; // traço livre (x,y relativos ao nó)
  stroke?: number;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  textColor?: string; // cor do texto em formas/notas
  font?: string;
  link?: { type: 'none' | 'page' | 'url' | 'email'; target: string };
  anim?: 'none' | 'fade' | 'slide-up' | 'slide-left' | 'zoom' | 'pop' | 'spin' | 'pulse' | 'float' | 'wiggle';
  animDur?: number; // duração do efeito (s)
  animDelay?: number; // atraso de entrada (s); vazio = automático em ordem
  slides?: string[]; // ids das molduras (slides) em que o elemento aparece; vazio = pela posição
  slideTr?: 'fly' | 'smooth' | 'fade' | 'none'; // (moldura) transição ao chegar neste slide
  slideDur?: number; // (moldura) duração da transição (s)
  hideTitle?: boolean; // (moldura) não mostrar o título na apresentação
  button?: { variant: string; shape: string; size: string; icon?: string };
  chart?: { reportId: string; widgetId: string };
  fill?: 'solid' | 'gradient' | 'glass';
  opacity?: number;
}

export type Side = 't' | 'r' | 'b' | 'l';

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  fromSide?: Side;
  toSide?: Side;
  arrow?: 'end' | 'both' | 'none';
  label?: string;
  style?: 'straight' | 'elbow' | 'curve';
  color?: string;
  dash?: EdgeDash;
  width?: number;
}

export type EdgeDash = 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'zigzag' | 'wave' | 'double' | 'glow';
export interface CanvasBg {
  theme?: string;
  pattern?: 'dots' | 'grid' | 'lines' | 'none';
  image?: string;
  fit?: 'cover' | 'contain' | 'tile';
  dim?: number;
  imageDark?: boolean;
  focusX?: number;
  focusY?: number;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  view: { x: number; y: number; zoom: number };
  bg?: CanvasBg;
  present?: { transition: 'fly' | 'smooth' | 'fade' | 'slide' | 'none'; duration: number; timer?: { mode: 'off' | 'up' | 'down'; minutes: number } };
}
