/**
 * Mídia premium no editor: imagens e vídeos do YouTube com tamanho, alinhamento,
 * legenda e redimensionamento pela borda; bloco de áudio/vídeo gravado na hora
 * (microfone ou câmera) ou enviado do computador/celular.
 */
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Camera, ExternalLink, Mic, Pause, Play, RefreshCw, Square, Trash2, Upload, Video } from 'lucide-react';
import { useT } from '../i18n';
import { openUrl, fileToDataUrl } from '../lib/platform';
import { toast } from '../store/ui';
import { Modal } from '../components/ui';

export type Size = 's' | 'm' | 'l' | 'full';
export type Align = 'left' | 'center' | 'right';
const PCT: Record<Size, number> = { s: 33, m: 55, l: 78, full: 100 };

/** Barra flutuante de tamanho e alinhamento (aparece ao passar o mouse ou selecionar). */
function MediaBar({ size, align, width, onSize, onAlign, extra, onDelete }: {
  size?: Size; align: Align; width?: number; onSize: (s: Size) => void; onAlign: (a: Align) => void; extra?: React.ReactNode; onDelete: () => void;
}) {
  const t = useT();
  return (
    <div className="media-bar" contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
      {(['s', 'm', 'l', 'full'] as Size[]).map((s) => (
        <button key={s} className={size === s && !width ? 'on' : ''} title={t(`media.size.${s}` as any)} onClick={() => onSize(s)}>{s === 'full' ? '↔' : s.toUpperCase()}</button>
      ))}
      {width ? <span className="media-pct">{Math.round(width)}%</span> : null}
      <span className="media-sep" />
      <button className={align === 'left' ? 'on' : ''} onClick={() => onAlign('left')}><AlignLeft size={14} /></button>
      <button className={align === 'center' ? 'on' : ''} onClick={() => onAlign('center')}><AlignCenter size={14} /></button>
      <button className={align === 'right' ? 'on' : ''} onClick={() => onAlign('right')}><AlignRight size={14} /></button>
      {extra && <span className="media-sep" />}
      {extra}
      <span className="media-sep" />
      <button className="danger" title={t('common.delete')} onClick={onDelete}><Trash2 size={14} /></button>
    </div>
  );
}

/** Puxador no canto: arrasta para mudar a largura em % da página. */
function ResizeHandle({ box, onWidth }: { box: React.RefObject<HTMLDivElement>; onWidth: (pct: number) => void }) {
  return (
    <span
      className="media-resize"
      contentEditable={false}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const el = box.current;
        const parent = el?.parentElement;
        if (!el || !parent) return;
        const pw = parent.getBoundingClientRect().width;
        const sx = e.clientX, w0 = el.getBoundingClientRect().width;
        const move = (ev: PointerEvent) => onWidth(Math.max(15, Math.min(100, ((w0 + (ev.clientX - sx)) / pw) * 100)));
        const up = () => (window.removeEventListener('pointermove', move), window.removeEventListener('pointerup', up));
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    />
  );
}

const widthOf = (a: any) => (a.width ? Number(a.width) : PCT[(a.size as Size) || 'full']);

// ------------------------------------------------------------------ imagem

export function ImageView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useT();
  const a = node.attrs as { src: string; alt?: string; title?: string; size?: Size; align?: Align; width?: number; caption?: string; rounded?: boolean; shadow?: boolean };
  const box = useRef<HTMLDivElement>(null);
  const align = a.align || 'center';
  return (
    <NodeViewWrapper className={`media-node al-${align}` + (selected ? ' is-selected' : '')} data-type="image-block">
      <div ref={box} className="media-box" style={{ width: `${widthOf(a)}%` }}>
        <img src={a.src} alt={a.alt || ''} className={'media-img' + (a.shadow !== false ? ' shadow' : '') + (a.rounded !== false ? ' rounded' : '')} draggable={false} />
        {editor.isEditable && (
          <>
            <MediaBar
              size={a.size || 'full'} align={align} width={a.width}
              onSize={(size) => updateAttributes({ size, width: null })}
              onAlign={(al) => updateAttributes({ align: al })}
              onDelete={deleteNode}
              extra={<button className={a.shadow !== false ? 'on' : ''} title={t('media.shadow')} onClick={() => updateAttributes({ shadow: a.shadow === false })}>◐</button>}
            />
            <ResizeHandle box={box} onWidth={(w) => updateAttributes({ width: Math.round(w) })} />
          </>
        )}
        {editor.isEditable ? (
          <input className="media-caption" placeholder={t('media.caption')} value={a.caption || ''} onChange={(e) => updateAttributes({ caption: e.target.value })} />
        ) : a.caption ? <div className="media-caption ro">{a.caption}</div> : null}
      </div>
    </NodeViewWrapper>
  );
}

// ----------------------------------------------------------------- YouTube

export function youtubeId(url: string): string | null {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(url) ? url : null;
}

export function YoutubeView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useT();
  const a = node.attrs as { src: string; size?: Size; align?: Align; width?: number; caption?: string; start?: number };
  const id = youtubeId(a.src);
  const box = useRef<HTMLDivElement>(null);
  const align = a.align || 'center';
  return (
    <NodeViewWrapper className={`media-node al-${align}` + (selected ? ' is-selected' : '')} data-type="youtube-block">
      <div ref={box} className="media-box" style={{ width: `${widthOf(a)}%` }}>
        <div className="media-video">
          {id ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1${a.start ? `&start=${a.start}` : ''}`}
              title="YouTube"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="media-broken">{t('media.badVideo')}</div>
          )}
          {editor.isEditable && <div className="media-shield" />}
        </div>
        {editor.isEditable && (
          <>
            <MediaBar
              size={a.size || 'full'} align={align} width={a.width}
              onSize={(size) => updateAttributes({ size, width: null })}
              onAlign={(al) => updateAttributes({ align: al })}
              onDelete={deleteNode}
              extra={<button title={t('media.openYoutube')} onClick={() => openUrl(`https://www.youtube.com/watch?v=${id}`)}><ExternalLink size={14} /></button>}
            />
            <ResizeHandle box={box} onWidth={(w) => updateAttributes({ width: Math.round(w) })} />
          </>
        )}
        {editor.isEditable ? (
          <input className="media-caption" placeholder={t('media.caption')} value={a.caption || ''} onChange={(e) => updateAttributes({ caption: e.target.value })} />
        ) : a.caption ? <div className="media-caption ro">{a.caption}</div> : null}
      </div>
    </NodeViewWrapper>
  );
}

/** Janela de incorporar vídeo: cola o link e vê a prévia antes de inserir. */
export function EmbedVideoModal({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (src: string, size: Size) => void }) {
  const t = useT();
  const [url, setUrl] = useState('');
  const [size, setSize] = useState<Size>('l');
  const id = youtubeId(url.trim());
  useEffect(() => void (open && setUrl('')), [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title={<><Play size={18} className="yt-red" /> {t('media.youtubeTitle')}</>}
      footer={
        <>
          <div className="seg sm">
            {(['m', 'l', 'full'] as Size[]).map((s) => <button key={s} className={size === s ? 'on' : ''} onClick={() => setSize(s)}>{t(`media.size.${s}` as any)}</button>)}
          </div>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={!id} onClick={() => (onInsert(`https://www.youtube.com/watch?v=${id}`, size), onClose())}>{t('media.insert')}</button>
        </>
      }
    >
      <input className="input" autoFocus placeholder="https://www.youtube.com/watch?v=…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && id && (onInsert(`https://www.youtube.com/watch?v=${id}`, size), onClose())} />
      <div className={'yt-preview' + (id ? ' ok' : '')}>
        {id ? (
          <>
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" />
            <span className="yt-play"><Play size={26} fill="#fff" /></span>
          </>
        ) : (
          <span className="muted small">{url ? t('media.badVideo') : t('media.youtubeHint')}</span>
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------- áudio e vídeo gravados

const MAX_SECONDS = { audio: 30 * 60, video: 5 * 60 };

function pickMime(kind: 'audio' | 'video') {
  const opts = kind === 'audio' ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'] : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return opts.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) || '';
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function MediaRecView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useT();
  const a = node.attrs as { kind: 'audio' | 'video'; src: string; size?: Size; align?: Align; width?: number; caption?: string; duration?: number };
  const [rec, setRec] = useState<{ stream: MediaStream; recorder: MediaRecorder; start: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const live = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const align = a.align || 'center';
  const kind = a.kind || 'audio';

  useEffect(() => () => rec?.stream.getTracks().forEach((tr) => tr.stop()), [rec]);
  useEffect(() => {
    if (!rec) return;
    const id = setInterval(() => {
      const s = (Date.now() - rec.start) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS[kind]) rec.recorder.state !== 'inactive' && rec.recorder.stop();
    }, 250);
    return () => clearInterval(id);
  }, [rec, kind]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(kind === 'audio' ? { audio: { echoCancellation: true, noiseSuppression: true } } : { audio: true, video: { width: { ideal: 854 }, height: { ideal: 480 }, facingMode: 'user' } });
      const mime = pickMime(kind);
      const recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 64000, ...(kind === 'video' ? { videoBitsPerSecond: 650000 } : {}) });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const t0 = Date.now();
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || mime || (kind === 'audio' ? 'audio/webm' : 'video/webm') });
        setRec(null);
        setPaused(false);
        if (!blob.size) return;
        updateAttributes({ src: await blobToDataUrl(blob), duration: Math.round((Date.now() - t0) / 1000) });
      };
      recorder.start(1000);
      setRec({ stream, recorder, start: t0 });
      setElapsed(0);
      if (kind === 'video') requestAnimationFrame(() => live.current && ((live.current.srcObject = stream), void live.current.play()));
    } catch (e) {
      const name = (e as Error).name;
      toast(name === 'NotAllowedError' ? t('media.denied') : name === 'NotFoundError' ? t('media.noDevice') : t('media.recError') + ' ' + String((e as Error).message || e), 'error');
    }
  };
  const stop = () => rec?.recorder.state !== 'inactive' && rec?.recorder.stop();
  const togglePause = () => {
    if (!rec) return;
    if (rec.recorder.state === 'recording') (rec.recorder.pause(), setPaused(true));
    else if (rec.recorder.state === 'paused') (rec.recorder.resume(), setPaused(false));
  };
  const upload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'audio' ? 'audio/*' : 'video/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > (kind === 'audio' ? 25 : 60) * 1024 * 1024) return toast(t('media.tooBig'), 'error');
      updateAttributes({ src: await fileToDataUrl(f) });
    };
    input.click();
  };

  return (
    <NodeViewWrapper className={`media-node al-${align}` + (selected ? ' is-selected' : '')} data-type="media-rec">
      <div ref={box} className={'media-box rec-' + kind} style={{ width: `${kind === 'audio' && !a.width && !a.size ? 100 : widthOf(a)}%` }}>
        {rec ? (
          <div className="rec-live" contentEditable={false}>
            {kind === 'video' && <video ref={live} muted playsInline className="rec-preview" />}
            <div className="rec-row">
              <span className={'rec-dot' + (paused ? ' paused' : '')} />
              <b>{paused ? t('media.paused') : t('media.recording')}</b>
              <span className="rec-time">{fmt(elapsed)} / {fmt(MAX_SECONDS[kind])}</span>
              <div className="grow" />
              <button className="btn ghost sm" onClick={togglePause}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
              <button className="btn danger-solid sm" onClick={stop}><Square size={13} fill="currentColor" /> {t('media.stop')}</button>
            </div>
            {kind === 'audio' && <div className="rec-wave">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 7) * 0.09}s` }} />)}</div>}
          </div>
        ) : a.src ? (
          kind === 'audio' ? (
            <div className="audio-card" contentEditable={false}>
              <span className="audio-ic"><Mic size={18} /></span>
              <audio controls src={a.src} preload="metadata" />
            </div>
          ) : (
            <video className="media-player" controls playsInline src={a.src} preload="metadata" />
          )
        ) : (
          <div className="rec-empty" contentEditable={false}>
            <span className={'rec-ic ' + kind}>{kind === 'audio' ? <Mic size={22} /> : <Video size={22} />}</span>
            <div className="grow">
              <b>{kind === 'audio' ? t('media.audio') : t('media.video')}</b>
              <small className="muted block">{kind === 'audio' ? t('media.audioHint') : t('media.videoHint')}</small>
            </div>
            {editor.isEditable && (
              <>
                <button className="btn primary sm" onClick={start}>{kind === 'audio' ? <Mic size={14} /> : <Camera size={14} />} {t('media.record')}</button>
                <button className="btn ghost sm" onClick={upload}><Upload size={14} /> {t('media.upload')}</button>
              </>
            )}
          </div>
        )}
        {editor.isEditable && !rec && (
          <>
            <MediaBar
              size={a.size || (kind === 'audio' ? 'full' : 'l')} align={align} width={a.width}
              onSize={(size) => updateAttributes({ size, width: null })}
              onAlign={(al) => updateAttributes({ align: al })}
              onDelete={deleteNode}
              extra={a.src ? <button title={t('media.redo')} onClick={() => updateAttributes({ src: '' })}><RefreshCw size={14} /></button> : null}
            />
            {kind === 'video' && a.src && <ResizeHandle box={box} onWidth={(w) => updateAttributes({ width: Math.round(w) })} />}
          </>
        )}
        {a.src && (editor.isEditable ? (
          <input className="media-caption" placeholder={t('media.caption')} value={a.caption || ''} onChange={(e) => updateAttributes({ caption: e.target.value })} />
        ) : a.caption ? <div className="media-caption ro">{a.caption}</div> : null)}
      </div>
    </NodeViewWrapper>
  );
}
