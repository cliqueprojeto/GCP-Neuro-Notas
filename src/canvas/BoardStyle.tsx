import { ImagePlus, Trash2 } from 'lucide-react';
import type { CanvasBg, CanvasEdge, EdgeDash } from '../lib/types';
import { useT } from '../i18n';
import { pickImages } from '../lib/platform';
import { BG_PATTERNS, BG_THEMES, EDGE_DASHES, EDGE_WIDTHS, dashArray, wigglePath } from './backgrounds';

/** Brilho médio da imagem (0–1), para escolher tinta clara ou escura sobre ela. */
async function luminance(src: string): Promise<number> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 24; c.height = 24;
      const g = c.getContext('2d');
      if (!g) return res(0.5);
      g.drawImage(img, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      res(sum / (d.length / 4));
    };
    img.onerror = () => res(0.5);
    img.src = src;
  });
}

export function BgPanel({ bg, onChange }: { bg?: CanvasBg; onChange: (bg: CanvasBg) => void }) {
  const t = useT();
  const cur = bg || {};
  const set = (p: Partial<CanvasBg>) => onChange({ ...cur, ...p });
  const pickImage = async () => {
    const [src] = await pickImages(false, 2400);
    if (!src) return;
    const l = await luminance(src);
    set({ image: src, imageDark: l < 0.55, dim: l < 0.55 ? 0.2 : 0.15, fit: cur.fit || 'cover' });
  };
  return (
    <div className="bg-panel">
      <div className="section-label">{t('canvas.bg.theme')}</div>
      <div className="bg-themes">
        {BG_THEMES.map((th) => (
          <button key={th.id} className={'bg-swatch' + ((cur.theme || 'default') === th.id && !cur.image ? ' on' : '')} onClick={() => set({ theme: th.id, image: undefined })} title={t(`canvas.bg.${th.id}` as any)}>
            <span className={'bg-sw' + (th.dark ? ' dark' : '')} style={{ background: th.layer || th.base || 'var(--bg)' }}>Aa</span>
            <small>{t(`canvas.bg.${th.id}` as any)}</small>
          </button>
        ))}
      </div>
      <div className="section-label">{t('canvas.bg.pattern')}</div>
      <div className="seg sm">
        {BG_PATTERNS.map((p) => <button key={p} className={(cur.pattern || 'dots') === p ? 'on' : ''} onClick={() => set({ pattern: p })}>{t(`canvas.bg.p.${p}` as any)}</button>)}
      </div>
      <div className="section-label">{t('canvas.bg.image')}</div>
      {cur.image ? (
        <>
          <div className="bg-img-prev" style={{ backgroundImage: `url("${cur.image}")`, backgroundPosition: `${cur.focusX ?? 50}% ${cur.focusY ?? 50}%` }}
            onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); set({ focusX: Math.round(((e.clientX - r.left) / r.width) * 100), focusY: Math.round(((e.clientY - r.top) / r.height) * 100) }); }}
            title={t('canvas.bg.focusHint')}>
            <span className="bg-focus" style={{ left: `${cur.focusX ?? 50}%`, top: `${cur.focusY ?? 50}%` }} />
          </div>
          <div className="seg sm">
            {(['cover', 'contain', 'tile'] as const).map((f) => <button key={f} className={(cur.fit || 'cover') === f ? 'on' : ''} onClick={() => set({ fit: f })}>{t(`canvas.bg.fit.${f}` as any)}</button>)}
          </div>
          <div className="ps-row">
            <span>{t('canvas.bg.dim')}</span>
            <input type="range" min={0} max={0.85} step={0.05} value={cur.dim ?? 0.25} onChange={(e) => set({ dim: +e.target.value })} />
            <b>{Math.round((cur.dim ?? 0.25) * 100)}%</b>
          </div>
          <div className="seg sm">
            <button className={cur.imageDark !== false ? 'on' : ''} onClick={() => set({ imageDark: true })}>{t('canvas.bg.inkLight')}</button>
            <button className={cur.imageDark === false ? 'on' : ''} onClick={() => set({ imageDark: false })}>{t('canvas.bg.inkDark')}</button>
          </div>
          <div className="row gap-sm" style={{ marginTop: 6 }}>
            <button className="btn ghost xs" onClick={pickImage}><ImagePlus size={13} /> {t('canvas.bg.change')}</button>
            <button className="btn ghost xs danger" onClick={() => set({ image: undefined })}><Trash2 size={13} /> {t('common.remove')}</button>
          </div>
          <p className="muted small">{t('canvas.bg.smartHint')}</p>
        </>
      ) : (
        <button className="btn ghost sm" onClick={pickImage}><ImagePlus size={14} /> {t('canvas.bg.pick')}</button>
      )}
    </div>
  );
}

export function EdgeDashPreview({ dash, width, w = 46 }: { dash: EdgeDash; width: number; w?: number }) {
  const d = `M3 9 L${w - 3} 9`;
  const sw = Math.min(width, 5);
  const path = dash === 'zigzag' || dash === 'wave' ? wigglePath(d, dash, Math.min(width, 3) * 0.6) : d;
  return (
    <svg width={w} height={18} className={'edge-prev d-' + dash} style={{ ['--ew' as any]: `${sw}px` }}>
      {dash === 'double' ? (
        <><path d={d} stroke="currentColor" strokeWidth={sw + 3} fill="none" /><path d={d} stroke="var(--panel)" strokeWidth={Math.max(1, sw - 0.5)} fill="none" /></>
      ) : (
        <path d={path} stroke="currentColor" strokeWidth={sw} fill="none" strokeDasharray={dashArray(dash, sw)} strokeLinecap={dash === 'dotted' || dash === 'dashdot' ? 'round' : undefined}
          style={dash === 'glow' ? { filter: 'drop-shadow(0 0 3px var(--accent))' } : undefined} />
      )}
    </svg>
  );
}

export function EdgeStylePanel({ edge, onChange }: { edge: CanvasEdge; onChange: (p: Partial<CanvasEdge>) => void }) {
  const t = useT();
  const w = edge.width || 2;
  return (
    <div className="edge-style-panel">
      <div className="section-label">{t('canvas.edgeStyle')}</div>
      <div className="edge-dash-grid">
        {EDGE_DASHES.map((d) => (
          <button key={d} className={'edge-dash-opt' + ((edge.dash || 'solid') === d ? ' on' : '')} onClick={() => onChange({ dash: d === 'solid' ? undefined : d })}>
            <EdgeDashPreview dash={d} width={w} w={64} />
            <small>{t(`canvas.dash.${d}` as any)}</small>
          </button>
        ))}
      </div>
      <div className="section-label">{t('canvas.edgeWidth')}</div>
      <div className="seg sm">
        {EDGE_WIDTHS.map((x) => <button key={x} className={w === x ? 'on' : ''} onClick={() => onChange({ width: x === 2 ? undefined : x })}><span className="ew-dot" style={{ height: x, width: 18 }} /></button>)}
      </div>
    </div>
  );
}
