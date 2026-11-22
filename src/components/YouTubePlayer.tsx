import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { isMobile, isTauri } from '../lib/platform';

let portPromise: Promise<number> | null = null;
/** No computador, o player passa pela página local do app (127.0.0.1), que envia a origem exigida pelo YouTube. */
function playerPort(): Promise<number> {
  if (!isTauri || isMobile) return Promise.resolve(0);
  if (!portPromise) portPromise = invoke<number>('player_port').catch(() => 0);
  return portPromise;
}

export function youtubeSrc(id: string, port: number, start = 0, autoplay = true) {
  if (port) return `http://127.0.0.1:${port}/yt/${id}?${autoplay ? 'autoplay=1&' : ''}${start ? `start=${start}` : ''}`;
  const origin = typeof location !== 'undefined' && /^https?:/.test(location.protocol) ? `&origin=${encodeURIComponent(location.origin)}&widget_referrer=${encodeURIComponent(location.origin)}` : '';
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${autoplay ? '&autoplay=1' : ''}${start ? `&start=${start}` : ''}${origin}`;
}

const titles = new Map<string, string>();

/** Capa do vídeo (miniatura em alta, título e botão de play) que vira o player oficial ao tocar. */
export function YouTubePlayer({ id, start = 0, className = '', compact = false, isolate = false, active = true, onPlay }: { id: string; start?: number; className?: string; compact?: boolean; isolate?: boolean; active?: boolean; onPlay?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [port, setPort] = useState(0);
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
  const [title, setTitle] = useState(titles.get(id) || '');
  useEffect(() => { void playerPort().then(setPort); }, []);
  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  useEffect(() => {
    setPlaying(false);
    setThumb(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
    if (titles.has(id)) return setTitle(titles.get(id)!);
    let alive = true;
    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.title && alive) (titles.set(id, j.title), setTitle(j.title)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [id]);
  if (playing)
    return (
      <div className={'yt-player playing ' + className} onPointerDown={(e) => isolate && e.stopPropagation()}>
        <iframe
          src={youtubeSrc(id, port, start, true)}
          title={title || 'YouTube'}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
          allowFullScreen
        />
      </div>
    );
  return (
    <div className={'yt-player ' + (compact ? 'compact ' : '') + className}>
      <img src={thumb} alt={title} draggable={false}
        onLoad={(e) => { if ((e.currentTarget as HTMLImageElement).naturalWidth <= 120 && thumb.includes('maxres')) setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`); }}
        onError={() => thumb.includes('maxres') && setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)} />
      <div className="yt-shade" />
      {title && <div className="yt-title"><span className="yt-logo">▶</span><span>{title}</span></div>}
      <button className="yt-play" aria-label="Play" onPointerDown={(e) => isolate && e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setPlaying(true); onPlay?.(); }}>
        <svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.5 7.7c-.8-2.9-3-5.2-5.9-6C55.3.2 34 .2 34 .2S12.7.2 7.4 1.7c-2.9.8-5.1 3.1-5.9 6C0 13 0 24 0 24s0 11 1.5 16.3c.8 2.9 3 5.2 5.9 6C12.7 47.8 34 47.8 34 47.8s21.3 0 26.6-1.5c2.9-.8 5.1-3.1 5.9-6C68 35 68 24 68 24s0-11-1.5-16.3z" fill="#f00" /><path d="M45 24 27 14v20z" fill="#fff" /></svg>
      </button>
    </div>
  );
}

const ytIdOf = (src: string) => (src.match(/(?:embed\/|v=|youtu\.be\/)([\w-]{11})/) || [])[1] || null;
const attrJson = (el: Element, name: string) => {
  const v = el.getAttribute('data-' + name);
  if (v == null) return null;
  try { return JSON.parse(v); } catch { return v; }
};

/**
 * Transforma, num HTML já exportado (páginas na apresentação ou incorporadas no quadro),
 * vídeos do YouTube em player com capa e gravações de áudio/vídeo em players nativos.
 */
export function hydrateMedia(root: HTMLElement | null): () => void {
  if (!root) return () => undefined;
  const roots: Root[] = [];
  root.querySelectorAll('[data-youtube-video]').forEach((el) => {
    const iframe = el.querySelector('iframe');
    const id = ytIdOf(iframe?.getAttribute('src') || '');
    if (!id) return;
    const host = document.createElement('div');
    host.className = 'media-video hydrated';
    el.replaceWith(host);
    const r = createRoot(host);
    r.render(<YouTubePlayer id={id} isolate />);
    roots.push(r);
  });
  root.querySelectorAll('[data-type="mediaRec"]').forEach((el) => {
    const kind = attrJson(el, 'kind') || 'audio';
    const src = attrJson(el, 'src');
    if (!src || typeof src !== 'string') return;
    const m = document.createElement(kind === 'video' ? 'video' : 'audio');
    m.src = src;
    m.controls = true;
    m.preload = 'metadata';
    m.className = kind === 'video' ? 'media-player hydrated' : 'hydrated-audio';
    if (m instanceof HTMLVideoElement) m.playsInline = true;
    m.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.replaceWith(m);
  });
  return () => roots.forEach((r) => setTimeout(() => r.unmount(), 0));
}

/** HTML exportado com vídeos e áudios já tocáveis. */
export function HtmlWithMedia({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => hydrateMedia(ref.current), [html]);
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
