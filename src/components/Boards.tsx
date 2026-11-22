import { PenTool, Plus, Presentation } from 'lucide-react';
import { useT, useLang, LOCALES } from '../i18n';
import { useVault, livePages, breadcrumb } from '../store/vault';
import { useUi } from '../store/ui';
import { relativeTime } from '../lib/doc';
import { PageIcon, Empty } from './ui';
import type { Page } from '../lib/types';

/** Miniatura vetorial do quadro (molduras, notas, formas, conectores). */
export function BoardThumb({ page }: { page: Page }) {
  const c = page.canvas;
  if (!c || !c.nodes.length) return <div className="board-thumb empty"><PenTool size={28} /></div>;
  const minX = Math.min(...c.nodes.map((n) => n.x)), minY = Math.min(...c.nodes.map((n) => n.y));
  const maxX = Math.max(...c.nodes.map((n) => n.x + n.w)), maxY = Math.max(...c.nodes.map((n) => n.y + n.h));
  const pad = 30;
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  const center = (id: string) => {
    const n = c.nodes.find((x) => x.id === id);
    return n ? { x: n.x + n.w / 2, y: n.y + n.h / 2 } : null;
  };
  return (
    <svg className="board-thumb" viewBox={vb} preserveAspectRatio="xMidYMid meet">
      {c.edges.map((e) => {
        const a = center(e.from), b = center(e.to);
        return a && b ? <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.color || '#94a3b8'} strokeWidth={4} /> : null;
      })}
      {c.nodes.map((n) => {
        if (n.kind === 'frame') return <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} rx={8} fill="none" stroke="#94a3b8" strokeWidth={4} strokeDasharray="12 8" />;
        if (n.kind === 'draw') return <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} fill="none" stroke={n.color} strokeWidth={3} opacity={0.5} />;
        if (n.kind === 'shape' && n.shape === 'ellipse') return <ellipse key={n.id} cx={n.x + n.w / 2} cy={n.y + n.h / 2} rx={n.w / 2} ry={n.h / 2} fill={n.color} />;
        if (n.kind === 'text') { const fh = Math.min(n.h, (n.fontSize || 16) * 0.9); return <rect key={n.id} x={n.x} y={n.y + (n.h - fh) / 2} width={Math.min(n.w, (n.text || '').length * (n.fontSize || 16) * 0.55)} height={fh} rx={fh / 4} fill={n.color || '#94a3b8'} opacity={0.7} />; }
        if (n.kind === 'shape' && n.shape === 'poly' && n.poly) return <polygon key={n.id} points={n.poly.split(' ').map((q) => { const [px, py] = q.split(',').map(Number); return `${n.x + (px / 100) * n.w},${n.y + (py / 100) * n.h}`; }).join(' ')} fill={n.color} />;
        const fill = n.kind === 'page' ? '#ffffff' : n.kind === 'image' ? '#cbd5e1' : n.color;
        return <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} rx={n.kind === 'note' ? 4 : 12} fill={fill} stroke={n.kind === 'page' ? '#c4b5fd' : 'none'} strokeWidth={3} />;
      })}
    </svg>
  );
}

/** Todos os quadros (modo edgeless) em um só lugar. */
export function Boards() {
  const t = useT();
  const lang = useLang();
  const pages = useVault((s) => s.pages);
  const create = useVault((s) => s.createPage);
  const go = useUi((s) => s.go);
  const list = livePages(pages)
    .filter((p) => p.type === 'canvas' || p.mode === 'edgeless' || (p.canvas?.nodes.length ?? 0) > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const newBoard = () => {
    const p = create({ type: 'canvas', title: '' });
    go({ name: 'page', id: p.id });
  };
  return (
    <div className="page-shell">
      <div className="page-hero compact">
        <div className="eyebrow"><PenTool size={13} /> {t('nav.boards')}</div>
        <h1>{t('boards.title')}</h1>
        <p className="muted">{t('boards.subtitle')}</p>
      </div>
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={newBoard}><Plus size={16} /> {t('boards.new')}</button>
        <span className="muted small"><Presentation size={13} /> {t('boards.presentHint')}</span>
      </div>
      {!list.length ? (
        <Empty icon={<PenTool size={30} />} title={t('boards.empty')} text={t('boards.emptyText')} action={<button className="btn primary" onClick={newBoard}><Plus size={16} /> {t('boards.new')}</button>} />
      ) : (
        <div className="boards-grid">
          {list.map((p) => {
            const crumbs = breadcrumb(pages, p.id).slice(0, -1);
            const frames = p.canvas?.nodes.filter((n) => n.kind === 'frame').length || 0;
            return (
              <button key={p.id} className="board-card" onClick={() => go({ name: 'page', id: p.id })}>
                <BoardThumb page={p} />
                <div className="board-card-body">
                  <b><PageIcon icon={p.icon} size={15} /> {p.title || t('page.untitled')}</b>
                  <small className="muted ellipsis">
                    {crumbs.length ? crumbs.map((c) => c.title || '…').join(' / ') + ' · ' : ''}
                    {t('boards.meta', { n: p.canvas?.nodes.length || 0, f: frames })} · {relativeTime(p.updatedAt, LOCALES[lang])}
                  </small>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
