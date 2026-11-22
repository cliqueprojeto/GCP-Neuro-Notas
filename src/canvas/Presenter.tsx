import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, LayoutList, X } from 'lucide-react';
import type { CanvasNode } from '../lib/types';
import { useT } from '../i18n';

/**
 * Controles do modo apresentação: cada moldura do Quadro é um slide
 * (como no AFFiNE). Teclado: → / espaço / PageDown avançam, ← volta, Esc sai.
 * No celular, deslize para os lados.
 */
export function Presenter({ frames, index, setIndex, onClose, onReorder }: {
  frames: CanvasNode[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
  onReorder: (ids: string[]) => void;
}) {
  const t = useT();
  const [list, setList] = useState(false);
  const [idle, setIdle] = useState(false);
  const idleT = useRef<ReturnType<typeof setTimeout>>();
  const total = Math.max(1, frames.length);
  const next = () => setIndex(Math.min(total - 1, index + 1));
  const prev = () => setIndex(Math.max(0, index - 1));

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) (e.preventDefault(), next());
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) (e.preventDefault(), prev());
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(total - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });

  useEffect(() => {
    let sx = 0, sy = 0;
    const s = (e: TouchEvent) => ((sx = e.touches[0].clientX), (sy = e.touches[0].clientY));
    const end = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
    };
    const move = () => {
      setIdle(false);
      if (idleT.current) clearTimeout(idleT.current);
      idleT.current = setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener('touchstart', s, { passive: true });
    window.addEventListener('touchend', end);
    window.addEventListener('mousemove', move);
    move();
    return () => {
      window.removeEventListener('touchstart', s);
      window.removeEventListener('touchend', end);
      window.removeEventListener('mousemove', move);
      if (idleT.current) clearTimeout(idleT.current);
    };
  });

  const move = (i: number, d: -1 | 1) => {
    const ids = frames.map((f) => f.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onReorder(ids);
    if (index === i) setIndex(j);
  };

  return (
    <div className={'presenter' + (idle && !list ? ' idle' : '')}>
      <div className="presenter-click prev" onClick={prev} />
      <div className="presenter-click next" onClick={next} />
      {!frames.length && <div className="presenter-tip">{t('present.noFrames')}</div>}
      <div className="presenter-bar">
        <button className="icon-btn" onClick={prev} disabled={index <= 0} aria-label={t('present.prev')}><ChevronLeft size={20} /></button>
        <span className="presenter-count">
          <b>{frames[index]?.text || t('present.slide')}</b>
          <small>{index + 1} / {total}</small>
        </span>
        <button className="icon-btn" onClick={next} disabled={index >= total - 1} aria-label={t('present.next')}><ChevronRight size={20} /></button>
        <span className="presenter-sep" />
        {frames.length > 1 && <button className={'icon-btn' + (list ? ' on' : '')} onClick={() => setList(!list)} title={t('present.slides')}><LayoutList size={18} /></button>}
        <button className="icon-btn" onClick={onClose} title={t('present.exit')}><X size={19} /></button>
      </div>
      <div className="presenter-progress"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      {list && (
        <div className="presenter-list">
          <div className="section-label">{t('present.slides')}</div>
          {frames.map((f, i) => (
            <div key={f.id} className={'presenter-item' + (i === index ? ' on' : '')}>
              <button className="grow" onClick={() => setIndex(i)}><span className="pnum">{i + 1}</span> {f.text || `${t('present.slide')} ${i + 1}`}</button>
              <button className="icon-btn xs" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
              <button className="icon-btn xs" disabled={i === frames.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
            </div>
          ))}
          <p className="muted small">{t('present.reorderHint')}</p>
        </div>
      )}
    </div>
  );
}
