/**
 * Cartões do Quadro: indicadores do que há dentro, cores (sólidas, premium e personalizadas),
 * fundo do quadro e modelos de cartão que servem para qualquer base (copiar ou mover entre listas e quadros).
 */
import { useMemo, useState } from 'react';
import { AlignLeft, CheckSquare, Clock, ImagePlus, MessageSquare, Paperclip, X } from 'lucide-react';
import { useT, useLang, LOCALES } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { CustomColors } from '../components/ColorPicker';
import { pickImages } from '../lib/platform';
import { uid } from '../lib/crypto';
import { makeProperty, newOption, recompute, titleProp } from './logic';
import { dueProp } from '../lib/alerts';
import type { CardTemplate, CardTplField, DatabaseData, Page, Property, Row } from '../lib/types';

/* ------------------------------------------------------------ cores */

export const CARD_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b', '#0f172a'];
export const CARD_GRADIENTS: { name: string; css: string }[] = [
  { name: 'Aurora', css: 'linear-gradient(135deg, #0ea5e9, #8b5cf6 55%, #ec4899)' },
  { name: 'Pôr do sol', css: 'linear-gradient(135deg, #f97316, #ef4444 50%, #db2777)' },
  { name: 'Floresta', css: 'linear-gradient(135deg, #16a34a, #0d9488)' },
  { name: 'Oceano', css: 'linear-gradient(135deg, #1d4ed8, #06b6d4)' },
  { name: 'Ouro', css: 'linear-gradient(135deg, #ca8a04, #f59e0b 50%, #fde68a)' },
  { name: 'Ametista', css: 'linear-gradient(135deg, #6d28d9, #a855f7 60%, #f0abfc)' },
  { name: 'Grafite', css: 'linear-gradient(135deg, #0f172a, #334155 60%, #64748b)' },
  { name: 'Coral', css: 'linear-gradient(135deg, #fb7185, #fdba74)' },
];

export function cardPaint(color?: string): string | undefined {
  if (!color) return undefined;
  if (color.startsWith('g:')) return CARD_GRADIENTS[+color.slice(2) % CARD_GRADIENTS.length]?.css;
  return color;
}

/** Estilo do cartão conforme a cor escolhida (faixa no topo ou cartão colorido). */
export function cardStyle(r: Row): { className: string; style?: React.CSSProperties } {
  const paint = cardPaint(r.color);
  if (!paint) return { className: '' };
  const solid = r.color!.startsWith('#') ? r.color! : '#8b5cf6';
  if (r.colorStyle === 'fill') return { className: ' card-fill' + (r.color!.startsWith('g:') ? ' grad' : ''), style: { ['--card-paint' as string]: paint, ['--card-solid' as string]: solid } };
  return { className: ' card-bar', style: { ['--card-paint' as string]: paint } };
}

export function CardColorPicker({ row, patch }: { row: Row; patch: (p: Partial<Row>) => void }) {
  const t = useT();
  return (
    <div className="card-color-pick">
      <div className="cb-row">
        <span className="cb-label">{t('card.colorStyle')}</span>
        <div className="seg sm">
          <button className={(row.colorStyle || 'bar') === 'bar' ? 'on' : ''} onClick={() => patch({ colorStyle: 'bar' })}>{t('card.style.bar')}</button>
          <button className={row.colorStyle === 'fill' ? 'on' : ''} onClick={() => patch({ colorStyle: 'fill' })}>{t('card.style.fill')}</button>
        </div>
      </div>
      <div className="cb-label">{t('card.colors')}</div>
      <div className="color-row wrap">
        <button className={'color-dot sm none' + (!row.color ? ' on' : '')} title={t('card.noColor')} onClick={() => patch({ color: undefined })}>×</button>
        {CARD_COLORS.map((c) => <button key={c} className={'color-dot sm' + (row.color === c ? ' on' : '')} style={{ background: c }} onClick={() => patch({ color: c })} />)}
        <CustomColors small value={row.color} onPick={(c) => patch({ color: c })} />
      </div>
      <div className="cb-label">{t('card.premium')}</div>
      <div className="grad-grid">
        {CARD_GRADIENTS.map((g, i) => (
          <button key={g.name} className={'grad-tile' + (row.color === 'g:' + i ? ' on' : '')} style={{ background: g.css }} onClick={() => patch({ color: 'g:' + i })}><span>{g.name}</span></button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ fundo do quadro */

export const BOARD_SOLIDS: { name: string; css: string }[] = [
  { name: 'Clássico', css: 'linear-gradient(180deg, #0284c7, #075985)' },
  { name: 'Laranja', css: 'linear-gradient(180deg, #d97706, #92400e)' },
  { name: 'Verde', css: 'linear-gradient(180deg, #16a34a, #166534)' },
  { name: 'Vermelho', css: 'linear-gradient(180deg, #dc2626, #7f1d1d)' },
  { name: 'Roxo', css: 'linear-gradient(180deg, #9333ea, #581c87)' },
  { name: 'Cinza', css: 'linear-gradient(180deg, #64748b, #1e293b)' },
];
export const BOARD_ABSTRACT: { name: string; css: string }[] = [
  { name: 'Aurora Cultural', css: 'radial-gradient(at 15% 20%, #22d3ee 0, transparent 50%), radial-gradient(at 80% 30%, #a855f7 0, transparent 50%), radial-gradient(at 50% 90%, #22c55e 0, transparent 55%), #0f172a' },
  { name: 'Palco Noturno', css: 'radial-gradient(at 25% 15%, #f59e0b 0, transparent 35%), radial-gradient(at 75% 80%, #db2777 0, transparent 50%), linear-gradient(135deg, #1e1b4b, #4c1d95)' },
  { name: 'Mar de Ideias', css: 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 55%, #eab308 100%)' },
  { name: 'Lavanda', css: 'linear-gradient(135deg, #c4b5fd, #f0abfc 60%, #fde68a)' },
  { name: 'Brasa', css: 'linear-gradient(135deg, #7f1d1d, #ea580c 55%, #fbbf24)' },
  { name: 'Neblina', css: 'linear-gradient(135deg, #e2e8f0, #cbd5e1 50%, #94a3b8)' },
];

export function boardBgCss(bg?: string): string | undefined {
  if (!bg) return undefined;
  if (bg.startsWith('c:')) return BOARD_SOLIDS[+bg.slice(2)]?.css;
  if (bg.startsWith('g:')) return BOARD_ABSTRACT[+bg.slice(2)]?.css;
  if (bg.startsWith('#')) return bg;
  return `center / cover no-repeat url("${bg}")`;
}

export function BoardBgPicker({ value, onChange }: { value?: string; onChange: (bg: string | undefined) => void }) {
  const t = useT();
  const tile = (key: string, g: { name: string; css: string }) => (
    <button key={key} className={'bg-tile' + (value === key ? ' on' : '')} style={{ background: g.css }} onClick={() => onChange(key)}><span>{g.name}</span></button>
  );
  return (
    <div className="board-bg-pick">
      <div className="bg-upload">
        <span className="bg-up-prev" style={value && !/^(c|g):|^#/.test(value) ? { background: boardBgCss(value) } : undefined} />
        <div>
          <b>{t('board.bg.image')}</b>
          <p className="muted small">{t('board.bg.imageHint')}</p>
          <button className="btn primary sm" onClick={async () => { const [src] = await pickImages(false, 1920); if (src) onChange(src); }}><ImagePlus size={14} /> {t('board.bg.upload')}</button>
        </div>
      </div>
      <div className="cb-label">{t('board.bg.solid')}</div>
      <div className="bg-grid">{BOARD_SOLIDS.map((g, i) => tile('c:' + i, g))}</div>
      <div className="cb-label">{t('board.bg.abstract')}</div>
      <div className="bg-grid">{BOARD_ABSTRACT.map((g, i) => tile('g:' + i, g))}</div>
      <div className="cb-label">{t('board.bg.custom')}</div>
      <div className="color-row wrap"><CustomColors small value={value?.startsWith('#') ? value : undefined} onPick={(c) => onChange(c)} /></div>
      <button className="btn ghost sm" onClick={() => onChange(undefined)}><X size={13} /> {t('board.bg.reset')}</button>
    </div>
  );
}

/* ------------------------------------------------------------ indicadores */

const isDoneLabel = (s: string) => /conclu|feito|done|finaliz|entregue|terminad|complet/i.test(s);

/** Ícones do que há dentro do cartão: descrição, comentários, subtarefas, anexos e prazo. */
export function CardIndicators({ db, r, group }: { db: DatabaseData; r: Row; group?: Property }) {
  const t = useT();
  const lang = useLang();
  const due = dueProp(db);
  const lists = db.properties.filter((p) => p.type === 'checklist');
  let done = 0, total = 0;
  for (const p of lists) for (const c of (r.cells[p.id] || []) as { done: boolean }[]) (total++, c?.done && done++);
  const files = db.properties.filter((p) => p.type === 'files').reduce((n, p) => n + ((r.cells[p.id] as unknown[]) || []).length, 0);
  const comments = r.comments?.length || 0;
  const dueVal: string = (due && r.cells[due.id]) || '';
  const status = group && (group.options || []).find((o) => o.id === r.cells[group.id]);
  const finished = !!status && isDoneLabel(status.label);
  if (!r.notes && !comments && !total && !files && !dueVal) return null;
  let tone = '', tag = '';
  if (dueVal) {
    const today = new Date().toISOString().slice(0, 10);
    const d = dueVal.slice(0, 10);
    if (finished) (tone = 'ok'), (tag = t('card.due.done'));
    else if (d < today) (tone = 'late'), (tag = t('card.due.late'));
    else if (d === today) (tone = 'today'), (tag = t('card.due.today'));
  }
  const fmt = dueVal ? new Date(dueVal.slice(0, 10) + 'T12:00').toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'short' }) : '';
  return (
    <div className="card-ind">
      <div className="card-ind-row">
        {r.notes && <span title={t('work.description')}><AlignLeft size={13} /></span>}
        {comments > 0 && <span title={t('work.comments')}><MessageSquare size={13} /> {comments}</span>}
        {total > 0 && <span className={'ind-chip' + (done === total ? ' ok' : '')} title={t('work.q.sub')}><CheckSquare size={13} /> {done}/{total}</span>}
        {files > 0 && <span title={t('work.q.files')}><Paperclip size={13} /> {files}</span>}
      </div>
      {dueVal && (
        <span className={'card-due ' + tone} title={due?.name}><Clock size={12} /> {fmt}{tag && <b>{tag}</b>}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ modelos de cartão */

const LABEL_TYPES = ['select', 'status', 'multi'];

/** Guarda o cartão como modelo (os campos vão pelo nome, para servir em outras bases). */
export function saveCardTemplate(db: DatabaseData, r: Row, name: string): CardTemplate {
  const tp = titleProp(db);
  const tpl: CardTemplate = { id: uid('ct'), name, color: r.color, colorStyle: r.colorStyle, notes: r.notes, fields: rowFields(db, r).filter((f) => f.name !== tp.name || f.type !== 'title'), comments: r.comments ? structuredClone(r.comments) : undefined, createdAt: Date.now() };
  useVault.getState().updateSettings((s) => ((s.cardTemplates = [tpl, ...(s.cardTemplates || [])]), s));
  return tpl;
}

export interface CopyKeep { checklists: boolean; labels: boolean; comments: boolean; files: boolean; notes: boolean }

/** Converte campos (por nome) para a base de destino, criando o que faltar. */
function mapFields(dest: DatabaseData, fields: CardTplField[], keep: CopyKeep): Record<string, any> {
  const cells: Record<string, any> = {};
  const tp = titleProp(dest);
  for (const f of fields) {
    if (f.type === 'checklist' && !keep.checklists) continue;
    if (LABEL_TYPES.includes(f.type) && !keep.labels) continue;
    if (f.type === 'files' && !keep.files) continue;
    let p: Property | undefined = f.type === 'title' ? tp : dest.properties.find((x) => x.name === f.name && (x.type === f.type || (LABEL_TYPES.includes(x.type) && LABEL_TYPES.includes(f.type))));
    if (!p) {
      p = makeProperty(f.type, f.name);
      if (p.type === 'status') p.options = [];
      dest.properties.push(p);
    }
    const opt = (label: string) => {
      p!.options ||= [];
      let o = p!.options.find((x) => x.label === label);
      if (!o) (o = newOption(label, p!.options)), p!.options.push(o);
      return o.id;
    };
    if (p.type === 'select' || p.type === 'status') cells[p.id] = Array.isArray(f.value) ? (f.value[0] ? opt(f.value[0]) : '') : f.value ? opt(f.value) : '';
    else if (p.type === 'multi') cells[p.id] = (Array.isArray(f.value) ? f.value : [f.value]).filter(Boolean).map(opt);
    else if (p.type === 'checklist') cells[p.id] = (f.value as any[]).map((c) => ({ ...c, id: uid('ck') }));
    else cells[p.id] = structuredClone(f.value);
  }
  return cells;
}

function rowFields(db: DatabaseData, r: Row): CardTplField[] {
  const out: CardTplField[] = [];
  for (const p of db.properties) {
    const v = r.cells[p.id];
    if (v == null || v === '' || (Array.isArray(v) && !v.length) || p.type === 'created' || p.type === 'formula') continue;
    if (p.type === 'select' || p.type === 'status') out.push({ name: p.name, type: p.type, value: p.options?.find((o) => o.id === v)?.label ?? '' });
    else if (p.type === 'multi') out.push({ name: p.name, type: p.type, value: (v as string[]).map((id) => p.options?.find((o) => o.id === id)?.label).filter(Boolean) });
    else out.push({ name: p.name, type: p.type, value: structuredClone(v) });
  }
  return out;
}

/** Bases de dados disponíveis como destino, com as listas (colunas do Quadro) de cada uma. */
export function useBoardTargets() {
  const pages = useVault((s) => s.pages);
  return useMemo(() => livePages(pages).filter((p) => p.type === 'database' && p.db), [pages]);
}
export function listsOf(db: DatabaseData): { prop?: Property; options: { id: string; label: string }[] } {
  const v = db.views.find((x) => x.id === db.activeView && x.type === 'board') || db.views.find((x) => x.type === 'board');
  const prop = db.properties.find((p) => p.id === v?.groupBy) || db.properties.find((p) => p.type === 'status') || db.properties.find((p) => p.type === 'select');
  return { prop, options: (prop?.options || []).map((o) => ({ id: o.id, label: o.label })) };
}

/**
 * Cria um cartão na base de destino a partir de campos (de um cartão ou de um modelo).
 * listId: opção da coluna; position: 1 = topo da lista.
 */
export function createCardIn(destPage: Page, src: { name: string; fields: CardTplField[]; notes?: string; comments?: Row['comments']; color?: string; colorStyle?: Row['colorStyle'] }, opts: { listId?: string; position?: number; keep: CopyKeep }): Row {
  const db: DatabaseData = structuredClone(destPage.db!);
  const cells = mapFields(db, src.fields.filter((f) => f.type !== 'title'), opts.keep);
  cells[titleProp(db).id] = src.name;
  const { prop } = listsOf(db);
  if (prop && opts.listId !== undefined) cells[prop.id] = opts.listId;
  const now = Date.now();
  const row: Row = { id: uid('r'), cells, createdAt: now, updatedAt: now, color: src.color, colorStyle: src.colorStyle };
  if (opts.keep.notes && src.notes) row.notes = src.notes;
  if (opts.keep.comments && src.comments?.length) row.comments = structuredClone(src.comments);
  // posição dentro da lista escolhida
  const inList = prop ? db.rows.filter((r) => (r.cells[prop.id] || '') === (opts.listId || '')) : db.rows;
  const before = inList[(opts.position || 1) - 1];
  const at = before ? db.rows.indexOf(before) : prop && inList.length ? db.rows.indexOf(inList[inList.length - 1]) + 1 : db.rows.length;
  db.rows.splice(at, 0, row);
  useVault.getState().updatePage(destPage.id, { db: recompute(db) });
  return row;
}

export function cardSource(db: DatabaseData, r: Row) {
  const tp = titleProp(db);
  return { name: String(r.cells[tp.id] || ''), fields: rowFields(db, r), notes: r.notes, comments: r.comments, color: r.color, colorStyle: r.colorStyle };
}

/** Painel "Copiar ou mover cartão" (também usado para criar a partir de modelo). */
export function CopyCardPanel({ initialName, counts, defaultPageId, onDone, mode: initialMode, allowMove, source }: {
  initialName: string;
  counts: { checklists: number; labels: number; comments: number; files: number; notes: boolean };
  defaultPageId: string;
  onDone: (result: { page: Page; row: Row; moved: boolean }) => void;
  mode?: 'copy' | 'move';
  allowMove?: boolean;
  source: ReturnType<typeof cardSource>;
}) {
  const t = useT();
  const targets = useBoardTargets();
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<'copy' | 'move'>(initialMode || 'copy');
  const [keep, setKeep] = useState<CopyKeep>({ checklists: true, labels: true, comments: true, files: true, notes: true });
  const [pageId, setPageId] = useState(defaultPageId);
  const page = targets.find((p) => p.id === pageId) || targets[0];
  const lists = page ? listsOf(page.db!) : { options: [] as { id: string; label: string }[] };
  const [listId, setListId] = useState<string>('');
  const list = lists.options.find((o) => o.id === listId) ? listId : lists.options[0]?.id ?? '';
  const inList = page && lists.prop ? page.db!.rows.filter((r) => (r.cells[lists.prop!.id] || '') === list).length : page?.db?.rows.length || 0;
  const [pos, setPos] = useState(1);
  const go = () => {
    if (!page) return;
    const row = createCardIn(page, { ...source, name: name.trim() || source.name }, { listId: lists.prop ? list : undefined, position: Math.min(pos, inList + 1), keep });
    onDone({ page, row, moved: mode === 'move' });
  };
  const ck = (k: keyof CopyKeep, label: string, n: number | boolean) =>
    (typeof n === 'number' ? n > 0 : n) && (
      <label className="check small"><input type="checkbox" checked={keep[k]} onChange={(e) => setKeep({ ...keep, [k]: e.target.checked })} /> {label}{typeof n === 'number' ? ` (${n})` : ''}</label>
    );
  return (
    <div className="copy-card">
      {allowMove && (
        <div className="seg sm full">
          <button className={mode === 'copy' ? 'on' : ''} onClick={() => setMode('copy')}>{t('card.copy')}</button>
          <button className={mode === 'move' ? 'on' : ''} onClick={() => setMode('move')}>{t('card.move')}</button>
        </div>
      )}
      <label className="cb-label">{t('card.name')}</label>
      <textarea className="input" rows={2} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="cb-label">{t('card.keep')}</div>
      {ck('checklists', t('card.keep.checklists'), counts.checklists)}
      {ck('labels', t('card.keep.labels'), counts.labels)}
      {ck('comments', t('card.keep.comments'), counts.comments)}
      {ck('files', t('card.keep.files'), counts.files)}
      {ck('notes', t('card.keep.notes'), counts.notes)}
      <div className="cb-label">{mode === 'move' ? t('card.moveTo') : t('card.copyTo')}</div>
      <label className="small muted">{t('card.board')}</label>
      <select className="input" value={page?.id || ''} onChange={(e) => (setPageId(e.target.value), setListId(''), setPos(1))}>
        {targets.map((p) => <option key={p.id} value={p.id}>{p.title || t('page.untitled')}</option>)}
      </select>
      <div className="copy-grid">
        <div>
          <label className="small muted">{t('card.list')}</label>
          <select className="input" value={list} onChange={(e) => (setListId(e.target.value), setPos(1))} disabled={!lists.options.length}>
            {lists.options.length ? lists.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>) : <option>—</option>}
          </select>
        </div>
        <div>
          <label className="small muted">{t('card.position')}</label>
          <select className="input" value={pos} onChange={(e) => setPos(+e.target.value)}>
            {Array.from({ length: inList + 1 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
      </div>
      <button className="btn primary full" disabled={!page} onClick={go}>{mode === 'move' ? t('card.doMove') : t('card.doCopy')}</button>
    </div>
  );
}

export function countsOf(db: DatabaseData, r: Row) {
  let checklists = 0, labels = 0, files = 0;
  for (const p of db.properties) {
    const v = r.cells[p.id];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (p.type === 'checklist') checklists++;
    else if (LABEL_TYPES.includes(p.type)) labels++;
    else if (p.type === 'files') files += (v as unknown[]).length;
  }
  return { checklists, labels, files, comments: r.comments?.length || 0, notes: !!r.notes };
}
