import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CircleDot, Columns3, GitFork, Grid2x2, IndentDecrease, IndentIncrease, LayoutList, ListTree, Network, Plus, RefreshCw, Shapes, Text as TextIcon, Triangle, Workflow, X } from 'lucide-react';
import { Modal } from '../components/ui';
import { useT } from '../i18n';
import { DIAGRAMS, DIAG_CATS, PALETTES, buildDiagram, sampleText, type DiagCat, type DiagOut, type DiagTemplate } from './diagrams';

const CAT_ICON: Record<DiagCat, JSX.Element> = {
  list: <LayoutList size={15} />, process: <Workflow size={15} />, cycle: <RefreshCw size={15} />, hierarchy: <GitFork size={15} />,
  mind: <Network size={15} />, relation: <CircleDot size={15} />, matrix: <Grid2x2 size={15} />, pyramid: <Triangle size={15} />, other: <Shapes size={15} />,
};

/** Miniatura vetorial do diagrama gerado (mesmo motor do quadro). */
export function MiniDiagram({ out, w = 168, h = 104 }: { out: DiagOut; w?: number; h?: number }) {
  const ns = out.nodes.filter((n) => n.kind !== 'frame');
  if (!ns.length) return <svg width={w} height={h} />;
  const minX = Math.min(...ns.map((n) => n.x)), minY = Math.min(...ns.map((n) => n.y));
  const maxX = Math.max(...ns.map((n) => n.x + n.w)), maxY = Math.max(...ns.map((n) => n.y + n.h));
  const pad = 14, s = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
  const ox = (w - (maxX - minX) * s) / 2 - minX * s, oy = (h - (maxY - minY) * s) / 2 - minY * s;
  const byId = new Map(ns.map((n) => [n.id, n]));
  return (
    <svg width={w} height={h} className="mini-diagram">
      {out.edges.map((e) => {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) return null;
        return <line key={e.id} x1={ox + (a.x + a.w / 2) * s} y1={oy + (a.y + a.h / 2) * s} x2={ox + (b.x + b.w / 2) * s} y2={oy + (b.y + b.h / 2) * s} stroke={e.color || '#94a3b8'} strokeWidth={Math.max(0.8, (e.width || 2) * s * 0.9)} strokeDasharray={e.dash === 'dashed' ? '3 2' : undefined} />;
      })}
      {ns.map((n) => {
        const x = ox + n.x * s, y = oy + n.y * s, ww = n.w * s, hh = n.h * s;
        const fill = n.color, op = n.fill === 'glass' ? 0.55 : 1;
        if (n.shape === 'ellipse') return <ellipse key={n.id} cx={x + ww / 2} cy={y + hh / 2} rx={ww / 2} ry={hh / 2} fill={fill} opacity={op} />;
        if (n.shape === 'poly' && n.poly) return <polygon key={n.id} points={n.poly.split(' ').map((p) => { const [px, py] = p.split(',').map(Number); return `${x + (px / 100) * ww},${y + (py / 100) * hh}`; }).join(' ')} fill={fill} />;
        return <rect key={n.id} x={x} y={y} width={ww} height={hh} rx={n.corner === 'pill' ? hh / 2 : Math.min(3, hh / 4)} fill={fill} opacity={op} />;
      })}
    </svg>
  );
}


interface ORow { id: number; text: string; level: number }
let rid = 1;
const toRows = (text: string): ORow[] => {
  const rows = text.split('\n').map((l) => {
    const m = l.match(/^(\s*)([-*•]\s*)?(.*)$/)!;
    return { id: rid++, text: m[3], level: Math.floor(m[1].replace(/\t/g, '  ').length / 2) };
  });
  return rows.length ? rows : [{ id: rid++, text: '', level: 0 }];
};
const fromRows = (rows: ORow[]) => rows.map((r) => '  '.repeat(r.level) + r.text).join('\n');

/** Editor em tópicos: cada item é um campo com cor do ramo; Enter cria, Tab recua, Shift+Tab avança, ↑↓ navegam. */
function OutlineEditor({ text, onChange, tree, palette, central }: { text: string; onChange: (t: string) => void; tree: boolean; palette: string[]; central: boolean }) {
  const t = useT();
  const [rows, setRows] = useState<ORow[]>(() => toRows(text));
  const last = useRef(text);
  const refs = useRef(new Map<number, HTMLInputElement>());
  const focusId = useRef<number | null>(null);
  useEffect(() => {
    if (text !== last.current) (setRows(toRows(text)), (last.current = text));
  }, [text]);
  useEffect(() => {
    if (focusId.current != null) { const el = refs.current.get(focusId.current); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); focusId.current = null; }
  });
  const commit = (next: ORow[]) => {
    setRows(next);
    const s2 = fromRows(next);
    last.current = s2;
    onChange(s2);
  };
  const maxLvl = tree ? 4 : 0;
  // cor de cada linha = cor do ramo de 1º nível (ou do item, em listas)
  let branch = -1, top = -1;
  const colors = rows.map((r, i) => {
    if (r.level === 0) { top++; if (!tree || !central) branch = top; }
    if (tree && central && r.level === 1) branch++;
    return i === 0 && tree && central ? palette[0] : palette[(Math.max(0, branch) + (tree && central ? 1 : 0)) % palette.length];
  });
  const upd = (i: number, p: Partial<ORow>) => commit(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const key = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    const r = rows[i];
    if (e.key === 'Enter') {
      e.preventDefault();
      const n = { id: rid++, text: '', level: r.level || (tree && central && i === 0 ? 1 : 0) };
      focusId.current = n.id;
      commit([...rows.slice(0, i + 1), n, ...rows.slice(i + 1)]);
    } else if (e.key === 'Tab' && tree) {
      e.preventDefault();
      const prev = i > 0 ? rows[i - 1].level : 0;
      upd(i, { level: e.shiftKey ? Math.max(0, r.level - 1) : Math.min(maxLvl, prev + 1, r.level + 1) });
      focusId.current = r.id;
    } else if (e.key === 'Backspace' && !r.text && rows.length > 1) {
      e.preventDefault();
      focusId.current = rows[Math.max(0, i - 1)].id;
      commit(rows.filter((_, k) => k !== i));
    } else if (e.key === 'ArrowUp' && (e.altKey || e.metaKey) && i > 0) {
      e.preventDefault(); const n = [...rows]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; focusId.current = r.id; commit(n);
    } else if (e.key === 'ArrowDown' && (e.altKey || e.metaKey) && i < rows.length - 1) {
      e.preventDefault(); const n = [...rows]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; focusId.current = r.id; commit(n);
    } else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); refs.current.get(rows[i - 1].id)?.focus(); }
    else if (e.key === 'ArrowDown' && i < rows.length - 1) { e.preventDefault(); refs.current.get(rows[i + 1].id)?.focus(); }
  };
  return (
    <div className="outline-ed">
      {rows.map((r, i) => {
        const isCenter = i === 0 && tree && central && r.level === 0;
        return (
          <div key={r.id} className={'ol-row lvl-' + r.level + (isCenter ? ' center' : '')} style={{ ['--oc' as any]: colors[i], paddingLeft: 6 + r.level * 20 }}>
            {r.level > 0 && <span className="ol-guide" style={{ left: r.level * 20 - 6 }} />}
            <span className={'ol-dot' + (r.level === 0 ? ' big' : '')} />
            <input ref={(el) => { if (el) refs.current.set(r.id, el); else refs.current.delete(r.id); }} className="ol-input" value={r.text}
              placeholder={isCenter ? t('diag.ph.center') : r.level === 0 ? t('diag.ph.item') : r.level === 1 ? t('diag.ph.branch') : t('diag.ph.idea')}
              onChange={(e) => upd(i, { text: e.target.value })} onKeyDown={(e) => key(e, i)} />
            <span className="ol-tools">
              {tree && <button tabIndex={-1} onClick={() => upd(i, { level: Math.max(0, r.level - 1) })} disabled={!r.level} title="Shift+Tab"><IndentDecrease size={13} /></button>}
              {tree && <button tabIndex={-1} onClick={() => upd(i, { level: Math.min(maxLvl, (i ? rows[i - 1].level : 0) + 1, r.level + 1) })} disabled={!i} title="Tab"><IndentIncrease size={13} /></button>}
              <button tabIndex={-1} onClick={() => { if (!i) return; const n = [...rows]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; commit(n); }} disabled={!i}><ArrowUp size={13} /></button>
              <button tabIndex={-1} onClick={() => { if (i === rows.length - 1) return; const n = [...rows]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; commit(n); }} disabled={i === rows.length - 1}><ArrowDown size={13} /></button>
              <button tabIndex={-1} onClick={() => rows.length > 1 && commit(rows.filter((_, k) => k !== i))} disabled={rows.length < 2}><X size={13} /></button>
            </span>
          </div>
        );
      })}
      <div className="ol-add">
        <button className="btn ghost xs" onClick={() => { const lvl = tree && central ? 1 : 0; const n = { id: rid++, text: '', level: lvl }; focusId.current = n.id; commit([...rows, n]); }}><Plus size={13} /> {tree && central ? t('diag.addBranch') : t('diag.addItem')}</button>
        {tree && <button className="btn ghost xs" onClick={() => { const lvl = Math.min(maxLvl, (rows[rows.length - 1]?.level || 0) + 1); const n = { id: rid++, text: '', level: lvl }; focusId.current = n.id; commit([...rows, n]); }}><IndentIncrease size={13} /> {t('diag.addSub')}</button>}
        <span className="muted small grow ol-keys">{tree ? t('diag.keysTree') : t('diag.keys')}</span>
      </div>
    </div>
  );
}

export function DiagramGallery({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (out: DiagOut) => void }) {
  const t = useT();
  const L = (k: string) => t(k as any);
  const [cat, setCat] = useState<DiagCat | 'all'>('all');
  const [tpl, setTpl] = useState<DiagTemplate>(DIAGRAMS.find((d) => d.id === 'mind-map')!);
  const [count, setCount] = useState(tpl.def);
  const [text, setText] = useState(() => sampleText(tpl, tpl.def, L));
  const [dirty, setDirty] = useState(false);
  const [palette, setPalette] = useState('vivid');
  const [style, setStyle] = useState<'square' | 'rounded' | 'pill'>('rounded');
  const [frame, setFrame] = useState(false);
  const [editMode, setEditMode] = useState<'outline' | 'text'>('outline');

  const choose = (d: DiagTemplate) => {
    setTpl(d);
    setCount(d.def);
    if (!dirty || d.tree !== tpl.tree) (setText(sampleText(d, d.def, L)), setDirty(false));
  };
  const list = DIAGRAMS.filter((d) => cat === 'all' || d.cat === cat);
  const thumbs = useMemo(() => new Map(DIAGRAMS.map((d) => [d.id, buildDiagram(d, sampleText(d, d.def, L), palette, 0, 0, { style })])), [palette, style]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = useMemo(() => buildDiagram(tpl, text, palette, 0, 0, { style }), [tpl, text, palette, style]);

  return (
    <Modal open={open} onClose={onClose} width={1080} className="diag-modal" title={<><Columns3 size={18} /> {t('diag.title')}</>}
      footer={<>
        <span className="muted small grow">{t('diag.footerHint')}</span>
        <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" onClick={() => (onInsert(buildDiagram(tpl, text, palette, 0, 0, { style, frame: frame ? (text.split('\n')[0] || '').trim() : undefined })), onClose())}>{t('diag.insert')}</button>
      </>}>
      <div className="diag-layout">
        <nav className="diag-cats">
          <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}><Shapes size={15} /> {t('diag.cat.all')}</button>
          {DIAG_CATS.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{CAT_ICON[c]} {t(`diag.cat.${c}` as any)}</button>)}
        </nav>
        <div className="diag-grid">
          {list.map((d) => (
            <button key={d.id} className={'diag-card' + (tpl.id === d.id ? ' on' : '')} onClick={() => choose(d)} onDoubleClick={() => { choose(d); }}>
              <MiniDiagram out={thumbs.get(d.id)!} />
              <b>{t(`diag.t.${d.id}` as any)}</b>
            </button>
          ))}
        </div>
        <aside className="diag-side">
          <div className="diag-preview"><MiniDiagram out={preview} w={300} h={190} /></div>
          <div className="diag-name"><b>{t(`diag.t.${tpl.id}` as any)}</b><small className="muted">{t(`diag.d.${tpl.id}` as any)}</small></div>
          <div className="diag-items-head">
            <label className="field-label">{t('diag.items')}</label>
            <div className="seg xs">
              <button className={editMode === 'outline' ? 'on' : ''} onClick={() => setEditMode('outline')} title={t('diag.mode.outline')}><ListTree size={13} /> {t('diag.mode.outline')}</button>
              <button className={editMode === 'text' ? 'on' : ''} onClick={() => setEditMode('text')} title={t('diag.mode.text')}><TextIcon size={13} /> {t('diag.mode.text')}</button>
            </div>
          </div>
          {editMode === 'outline'
            ? <OutlineEditor text={text} onChange={(v) => (setText(v), setDirty(true))} tree={!!tpl.tree} palette={PALETTES[palette]} central={['mind-map', 'mind-bubbles', 'cycle-hub', 'cycle-radial', 'converge', 'diverge', 'fishbone', 'org-chart', 'tree-horizontal'].includes(tpl.id)} />
            : <textarea className="input diag-text" rows={8} value={text} onChange={(e) => (setText(e.target.value), setDirty(true))} spellCheck={false} placeholder={t('diag.pastePh')} />}
          {tpl.min !== tpl.max && (
            <div className="ps-row">
              <span>{t('diag.count')}</span>
              <input type="range" min={tpl.min} max={tpl.max} value={count} onChange={(e) => { const c = +e.target.value; setCount(c); if (!dirty) setText(sampleText(tpl, c, L)); }} />
              <b>{count}</b>
            </div>
          )}
          <label className="field-label">{t('diag.palette')}</label>
          <div className="diag-pals">
            {Object.entries(PALETTES).map(([k, cols]) => (
              <button key={k} className={'diag-pal' + (palette === k ? ' on' : '')} onClick={() => setPalette(k)} title={t(`diag.pal.${k}` as any)}>
                {cols.slice(0, 5).map((c) => <span key={c} style={{ background: c }} />)}
              </button>
            ))}
          </div>
          <div className="seg sm">
            {(['square', 'rounded', 'pill'] as const).map((s) => <button key={s} className={style === s ? 'on' : ''} onClick={() => setStyle(s)}>{t(`diag.style.${s}` as any)}</button>)}
          </div>
          <label className="check small"><input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} /> {t('diag.inFrame')}</label>
        </aside>
      </div>
    </Modal>
  );
}
