import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronLeft, ChevronRight, LayoutList, Timer, X } from 'lucide-react';
import type { CanvasNode, Page } from '../lib/types';
import { useT } from '../i18n';
import { useVault } from '../store/vault';
import { pageToHtml } from '../lib/transfer';
import { cellText, cellValue, titleProp } from '../database/logic';
import { Chart } from '../reports/ReportView';
import { PageIcon } from '../components/ui';

export type DeckTransition = 'fly' | 'smooth' | 'fade' | 'slide' | 'none';
export interface DeckSettings { transition: DeckTransition; duration: number; timer?: { mode: 'off' | 'up' | 'down'; minutes: number } }

const fmtClock = (s: number) => `${s < 0 ? '−' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s) % 60)).padStart(2, '0')}`;

/**
 * Controles da apresentação: cada moldura é um slide (ou enquadramentos automáticos).
 * Teclado: → / espaço / PageDown avançam, ← volta, Esc sai. No celular, deslize.
 */
export function Presenter({ frames, auto, index, setIndex, onClose, onReorder, transition, duration, timer, onSettings, paused }: {
  frames: CanvasNode[];
  auto?: boolean;
  transition: DeckTransition;
  duration: number;
  timer?: DeckSettings['timer'];
  onSettings: (p: DeckSettings) => void;
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
  onReorder: (ids: string[]) => void;
  paused?: boolean;
}) {
  const t = useT();
  const [list, setList] = useState(false);
  const [idle, setIdle] = useState(false);
  const idleT = useRef<ReturnType<typeof setTimeout>>();
  const total = Math.max(1, frames.length);
  const next = () => setIndex(Math.min(total - 1, index + 1));
  const prev = () => setIndex(Math.max(0, index - 1));
  const tm = timer || { mode: 'off' as const, minutes: 10 };
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  useEffect(() => {
    if (tm.mode === 'off') return;
    const id = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 500);
    return () => clearInterval(id);
  }, [tm.mode]);
  const remaining = tm.minutes * 60 - elapsed;
  const clock = tm.mode === 'up' ? fmtClock(elapsed) : fmtClock(remaining);
  const clockCls = tm.mode === 'down' ? (remaining <= 0 ? ' over' : remaining <= 60 ? ' warn' : '') : '';

  useEffect(() => {
    if (paused) return;
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
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
      if (paused) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
    };
    const move = () => {
      setIdle(false);
      if (idleT.current) clearTimeout(idleT.current);
      idleT.current = setTimeout(() => setIdle(true), 2600);
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
  const cur = frames[index];
  const set = (p: Partial<DeckSettings>) => onSettings({ transition, duration, timer: tm, ...p });

  return (
    <div className={'presenter' + (idle && !list ? ' idle' : '')}>
      <div className="presenter-vignette" />
      {!paused && <div className="presenter-click prev" onClick={prev} />}
      {!paused && <div className="presenter-click next" onClick={next} />}
      {cur?.text && !cur.hideTitle && (
        <div key={cur.id + index} className="presenter-title"><span className="pt-num">{String(index + 1).padStart(2, '0')}</span><b>{cur.text}</b></div>
      )}
      {tm.mode !== 'off' && <div className={'presenter-timer' + clockCls}><Timer size={15} /> {clock}</div>}
      <div className="presenter-bar">
        <button className="icon-btn" onClick={prev} disabled={index <= 0} aria-label={t('present.prev')}><ChevronLeft size={20} /></button>
        <span className="presenter-count">
          <b>{cur?.text || t('present.slide')}</b>
          <small>{index + 1} / {total}</small>
        </span>
        <button className="icon-btn" onClick={next} disabled={index >= total - 1} aria-label={t('present.next')}><ChevronRight size={20} /></button>
        <span className="presenter-sep" />
        <button className={'icon-btn' + (list ? ' on' : '')} onClick={() => setList(!list)} title={t('present.slides')}><LayoutList size={18} /></button>
        <button className="icon-btn" onClick={onClose} title={t('present.exit')}><X size={19} /></button>
      </div>
      <div className="presenter-progress"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      <div className="presenter-dots">{frames.map((f, i) => <button key={f.id} className={i === index ? 'on' : i < index ? 'done' : ''} onClick={() => setIndex(i)} aria-label={String(i + 1)} />)}</div>
      {list && (
        <div className="presenter-list">
          <div className="section-label">{t('present.transition')}</div>
          <div className="seg sm wrap">
            {(['fly', 'smooth', 'fade', 'none'] as const).map((tr) => (
              <button key={tr} className={(transition === 'slide' ? 'smooth' : transition) === tr ? 'on' : ''} onClick={() => set({ transition: tr })}>{t(`present.tr.${tr}` as any)}</button>
            ))}
          </div>
          <div className="seg sm" style={{ marginTop: 6 }}>
            {[0.7, 1.1, 1.6, 2.4].map((d) => <button key={d} className={duration === d ? 'on' : ''} onClick={() => set({ duration: d })}>{d}s</button>)}
          </div>
          <div className="section-label"><Timer size={11} /> {t('present.timer')}</div>
          <div className="seg sm">
            {(['off', 'up', 'down'] as const).map((m) => <button key={m} className={tm.mode === m ? 'on' : ''} onClick={() => (set({ timer: { ...tm, mode: m } }), (startedAt.current = Date.now()), setElapsed(0))}>{t(`present.timer.${m}` as any)}</button>)}
          </div>
          {tm.mode === 'down' && (
            <div className="ps-row" style={{ marginTop: 6 }}>
              <span>{t('present.minutes')}</span>
              <input type="range" min={1} max={120} value={tm.minutes} onChange={(e) => set({ timer: { ...tm, minutes: +e.target.value } })} />
              <b>{tm.minutes} min</b>
            </div>
          )}
          {tm.mode !== 'off' && <button className="btn ghost xs" style={{ marginTop: 6 }} onClick={() => ((startedAt.current = Date.now()), setElapsed(0))}>↺ {t('present.timer.reset')}</button>}
          <div className="section-label">{t('present.slides')}</div>
          {auto && <p className="muted small">{t('present.autoNote')}</p>}
          {frames.map((f, i) => (
            <div key={f.id} className={'presenter-item' + (i === index ? ' on' : '')}>
              <button className="grow" onClick={() => setIndex(i)}><span className="pnum">{i + 1}</span> {f.text || `${t('present.slide')} ${i + 1}`}</button>
              {!auto && <button className="icon-btn xs" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></button>}
              {!auto && <button className="icon-btn xs" disabled={i === frames.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></button>}
            </div>
          ))}
          {!auto && <p className="muted small">{t('present.reorderHint')}</p>}
        </div>
      )}
    </div>
  );
}

/** Página aberta por um link durante a apresentação: tela limpa, só leitura, com botão de voltar. */
export function PresentPage({ page, onBack, onOpen }: { page: Page; onBack: () => void; onOpen: (id: string) => void }) {
  const t = useT();
  const pages = useVault((s) => s.pages);
  useEffect(() => {
    const k = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Backspace') && (e.preventDefault(), e.stopPropagation(), onBack());
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onBack]);
  const body = useMemo(() => {
    if (page.type === 'page') return <div className="prose" dangerouslySetInnerHTML={{ __html: pageToHtml(page) }} />;
    if (page.type === 'database' && page.db) {
      const props = page.db.properties.filter((p) => p.type !== 'password').slice(0, 10);
      const tp = titleProp(page.db);
      return (
        <div className="pp-table"><table className="print-table"><thead><tr>{props.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead>
          <tbody>{page.db.rows.slice(0, 200).map((r) => <tr key={r.id}>{props.map((p) => <td key={p.id} className={p.id === tp.id ? 'strong' : ''}>{cellText(p, cellValue(p, r))}</td>)}</tr>)}</tbody></table></div>
      );
    }
    if (page.type === 'report' && page.report) return <div className="pp-charts">{page.report.widgets.map((w) => <div key={w.id} className="pp-chart"><b>{w.title || pages[w.source]?.title}</b><Chart w={w} report={page.report!} height={240} /></div>)}</div>;
    return <p className="muted">{t('canvas.openToSee')}</p>;
  }, [page, pages]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="present-page" onClick={(e) => {
      const a = (e.target as HTMLElement).closest('[data-type="pageLink"]') as HTMLElement | null;
      if (a?.dataset.id) onOpen(a.dataset.id);
    }}>
      <button className="pp-back btn primary" onClick={onBack}><ArrowLeft size={16} /> {t('present.back')}</button>
      <article className="pp-sheet">
        <header className="pp-head"><PageIcon icon={page.icon} size={30} /><h1>{page.title || t('page.untitled')}</h1></header>
        {body}
      </article>
    </div>
  );
}

const ANIMS = ['none', 'fade', 'slide-up', 'slide-left', 'zoom', 'pop', 'spin', 'pulse', 'float', 'wiggle'] as const;

/** Configuração do elemento na apresentação: efeito, duração, atraso e em quais slides aparece. */
export function PresentSettings({ node, frames, onChange, onPreview }: { node: CanvasNode; frames: CanvasNode[]; onChange: (p: Partial<CanvasNode>) => void; onPreview: () => void }) {
  const t = useT();
  const anim = node.anim || 'none';
  const dur = node.animDur ?? 0.7;
  const slides = node.slides || [];
  const toggle = (id: string) => onChange({ slides: slides.includes(id) ? slides.filter((x) => x !== id) : [...slides, id] });
  if (node.kind === 'frame') {
    const tr = node.slideTr || '';
    return (
      <div className="present-settings">
        <div className="section-label">{t('present.slideTransition')}</div>
        <div className="seg sm wrap">
          <button className={!tr ? 'on' : ''} onClick={() => onChange({ slideTr: undefined })}>{t('present.deckDefault')}</button>
          {(['fly', 'smooth', 'fade', 'none'] as const).map((x) => <button key={x} className={tr === x ? 'on' : ''} onClick={() => onChange({ slideTr: x })}>{t(`present.tr.${x}` as any)}</button>)}
        </div>
        <div className="ps-row">
          <span>{t('present.duration')}</span>
          <input type="range" min={0.3} max={4} step={0.1} value={node.slideDur ?? 1.1} onChange={(e) => onChange({ slideDur: +e.target.value })} />
          <b>{(node.slideDur ?? 1.1).toFixed(1)}s</b>
        </div>
        <label className="check small"><input type="checkbox" checked={!node.hideTitle} onChange={(e) => onChange({ hideTitle: !e.target.checked })} /> {t('present.showTitle')}</label>
        <p className="muted small">{t('present.slideHint')}</p>
      </div>
    );
  }
  return (
    <div className="present-settings">
      <div className="section-label">{t('present.effect')}</div>
      <div className="anim-grid">
        {ANIMS.map((a) => (
          <button key={a} className={'anim-opt' + (anim === a ? ' on' : '')} onClick={() => onChange({ anim: a })}>
            <span className={'anim-demo d-' + a} />
            <small>{t(`canvas.anim.${a}` as any)}</small>
          </button>
        ))}
      </div>
      {anim !== 'none' && (
        <>
          <div className="ps-row">
            <span>{t('present.duration')}</span>
            <input type="range" min={0.2} max={4} step={0.1} value={dur} onChange={(e) => onChange({ animDur: +e.target.value })} />
            <b>{dur.toFixed(1)}s</b>
          </div>
          <div className="ps-row">
            <span>{t('present.delay')}</span>
            <input type="range" min={0} max={6} step={0.1} value={node.animDelay ?? 0} onChange={(e) => onChange({ animDelay: +e.target.value })} />
            <b>{node.animDelay == null ? t('present.auto') : `${node.animDelay.toFixed(1)}s`}</b>
            {node.animDelay != null && <button className="icon-btn xs" title={t('present.auto')} onClick={() => onChange({ animDelay: undefined })}>↺</button>}
          </div>
          <button className="btn ghost sm" onClick={onPreview}>▶ {t('present.preview')}</button>
        </>
      )}
      <div className="section-label">{t('present.showOn')}</div>
      {!frames.length ? (
        <p className="muted small">{t('present.noFramesShort')}</p>
      ) : (
        <div className="ps-slides">
          <label className={'ps-slide' + (!slides.length ? ' on' : '')}>
            <input type="radio" checked={!slides.length} onChange={() => onChange({ slides: [] })} />
            <span>{t('present.autoSlides')}</span>
          </label>
          {frames.map((f, i) => (
            <label key={f.id} className={'ps-slide' + (slides.includes(f.id) ? ' on' : '')}>
              <input type="checkbox" checked={slides.includes(f.id)} onChange={() => toggle(f.id)} />
              <span className="pnum">{i + 1}</span> <span className="ellipsis">{f.text || `${t('present.slide')} ${i + 1}`}</span>
            </label>
          ))}
          <p className="muted small">{t('present.showOnHint')}</p>
        </div>
      )}
    </div>
  );
}
