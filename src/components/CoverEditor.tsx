import { useEffect, useRef, useState } from 'react';
import { Check, Move, RotateCcw } from 'lucide-react';
import { useT } from '../i18n';

const ASPECTS: { id: string; label: string; r: number | null }[] = [
  { id: '5:1', label: '5 : 1', r: 5 },
  { id: '4:1', label: '4 : 1', r: 4 },
  { id: '3:1', label: '3 : 1', r: 3 },
  { id: '16:9', label: '16 : 9', r: 16 / 9 },
  { id: 'orig', label: 'Original', r: null },
];
const OUT_W = 2400;

/**
 * Ajusta a capa antes de salvar: proporção, zoom e posição (arrastando a imagem).
 * Salva já recortada em JPEG, leve para sincronizar.
 */
export function CoverEditor({ src, onSave, onCancel }: { src: string; onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const t = useT();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState('5:1');
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  const ratio = (img && (ASPECTS.find((a) => a.id === aspect)?.r ?? img.naturalWidth / img.naturalHeight)) || 5;
  const outH = Math.round(OUT_W / ratio);
  // Escala que cobre o quadro inteiro, vezes o zoom escolhido.
  const s = img ? Math.max(OUT_W / img.naturalWidth, outH / img.naturalHeight) * zoom : 1;
  const sizePct = img ? ((img.naturalWidth * s) / OUT_W) * 100 : 100;

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !img || !frame.current) return;
    const fw = frame.current.clientWidth, fh = frame.current.clientHeight;
    const dispW = (img.naturalWidth * s * fw) / OUT_W, dispH = (img.naturalHeight * s * fh) / outH;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    const nx = fw - dispW !== 0 ? clamp(drag.current.px + (e.clientX - drag.current.x) / (fw - dispW)) : 0.5;
    const ny = fh - dispH !== 0 ? clamp(drag.current.py + (e.clientY - drag.current.y) / (fh - dispH)) : 0.5;
    setPos({ x: nx, y: ny });
  };
  const save = () => {
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = OUT_W;
    c.height = outH;
    const ctx = c.getContext('2d')!;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (OUT_W - w) * pos.x, (outH - h) * pos.y, w, h);
    onSave(c.toDataURL('image/jpeg', 0.88));
  };

  return (
    <div className="cover-editor">
      <div
        ref={frame}
        className="ce-frame"
        style={{ aspectRatio: String(ratio), backgroundImage: `url("${src}")`, backgroundSize: `${sizePct}% auto`, backgroundPosition: `${pos.x * 100}% ${pos.y * 100}%` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
      >
        <span className="ce-hint"><Move size={13} /> {t('cover.drag')}</span>
      </div>
      <div className="ce-row">
        <span className="cb-label">{t('cover.ratio')}</span>
        <div className="seg sm">
          {ASPECTS.map((a) => (
            <button key={a.id} className={aspect === a.id ? 'on' : ''} onClick={() => (setAspect(a.id), setPos({ x: 0.5, y: 0.5 }))}>{a.id === 'orig' ? t('cover.original') : a.label}</button>
          ))}
        </div>
      </div>
      <div className="ce-row">
        <span className="cb-label">{t('cover.zoom')}</span>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        <b className="cb-val">{Math.round(zoom * 100)}%</b>
        <button className="icon-btn xs" title={t('cover.reset')} onClick={() => (setZoom(1), setPos({ x: 0.5, y: 0.5 }))}><RotateCcw size={13} /></button>
      </div>
      <p className="muted small">{t('cover.tip')}</p>
      <div className="row end">
        <button className="btn ghost" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!img} onClick={save}><Check size={15} /> {t('cover.apply')}</button>
      </div>
    </div>
  );
}
