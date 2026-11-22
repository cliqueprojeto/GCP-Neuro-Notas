import { useEffect, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { ArrowDownUp, Bike, Car, Download, ExternalLink, Footprints, MapPin, Navigation, Paperclip, Search, Trash2, X } from 'lucide-react';
import type { FileRef, GeoPoint } from '../lib/types';
import { useT, useLang } from '../i18n';
import { toast } from '../store/ui';
import { GeoMap } from '../components/GeoMap';
import { downloadFile, fileKind, fmtSize, openFile, pickFiles, toFileRef } from '../lib/files';
import { fmtDistance, fmtDuration, geocode, osmLink, route, type RouteProfile, type RouteResult } from '../lib/geo';
import { openUrl } from '../lib/platform';
import { LOCALES } from '../i18n';

/** Bloco "Anexo": arquivos com ícone contextual, abrir, baixar, renomear e arrastar novos arquivos. */
export function AttachmentView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useT();
  const files = (node.attrs.files || []) as FileRef[];
  const editable = editor.isEditable;
  const [over, setOver] = useState(false);
  const add = async (list: File[]) => {
    if (!list.length) return;
    try {
      const refs = await Promise.all(list.map(toFileRef));
      updateAttributes({ files: [...files, ...refs] });
    } catch (e) {
      toast(String((e as Error).message), 'error');
    }
  };
  useEffect(() => {
    // recém-inserido sem arquivos: abre o seletor
    if (editable && !files.length && node.attrs.autoPick) {
      updateAttributes({ autoPick: false });
      void pickFiles(true).then(add);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <NodeViewWrapper className={'attach-block' + (selected ? ' sel' : '') + (over ? ' over' : '')} contentEditable={false}
      onDragOver={(e: React.DragEvent) => { if (editable && e.dataTransfer.types.includes('Files')) (e.preventDefault(), e.stopPropagation(), setOver(true)); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: React.DragEvent) => { if (!editable || !e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); setOver(false); void add(Array.from(e.dataTransfer.files)); }}>
      {files.map((f) => {
        const k = fileKind(f);
        const I = k.icon;
        return (
          <div key={f.id} className="attach-item" style={{ ['--fk' as any]: k.color }}>
            <button className="attach-ic" onClick={() => openFile(f)} title={t('files.open')}>
              {f.type.startsWith('image/') ? <img src={f.data} alt="" /> : <><I size={22} /><span>{k.label}</span></>}
            </button>
            <div className="attach-meta" onClick={() => openFile(f)}>
              <b className="ellipsis">{f.name}</b>
              <small className="muted">{fmtSize(f.size)}</small>
            </div>
            <button className="icon-btn xs" onClick={() => void downloadFile(f)} title={t('files.download')}><Download size={14} /></button>
            {editable && <button className="icon-btn xs" onClick={() => updateAttributes({ files: files.filter((x) => x.id !== f.id) })} title={t('common.remove')}><X size={14} /></button>}
          </div>
        );
      })}
      {editable && (
        <div className="attach-actions">
          <button className="btn ghost sm" onClick={async () => add(await pickFiles(true))}><Paperclip size={14} /> {files.length ? t('files.addMore') : t('files.attach')}</button>
          <span className="muted small">{t('files.dropHint')}</span>
          <span className="grow" />
          <button className="icon-btn xs" onClick={deleteNode} title={t('common.delete')}><Trash2 size={14} /></button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

const PROFILES: { id: RouteProfile; icon: any }[] = [{ id: 'car', icon: Car }, { id: 'bike', icon: Bike }, { id: 'foot', icon: Footprints }];

function PlaceInput({ label, tag, value, onPick, color }: { label: string; tag: string; value: GeoPoint | null; onPick: (g: GeoPoint | null) => void; color: string }) {
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState(value?.label || '');
  const [res, setRes] = useState<GeoPoint[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setQ(value?.label || ''), [value?.label]);
  const go = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await geocode(q, lang);
      if (r.length === 1) (onPick(r[0]), setRes([]));
      else setRes(r);
      if (!r.length) toast(t('geo.notFound'), 'info');
    } catch {
      toast(t('geo.offline'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="place-in">
      <span className="place-tag" style={{ background: color }}>{tag}</span>
      <input className="input" placeholder={label} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), go())} />
      <button className="icon-btn sm" onClick={go} disabled={busy} title={t('common.search')}><Search size={15} /></button>
      {value && <button className="icon-btn sm" onClick={() => (onPick(null), setQ(''))}><X size={14} /></button>}
      {res.length > 1 && (
        <div className="place-results">
          {res.map((r, i) => <button key={i} className="menu-item" onClick={() => (onPick(r), setRes([]))}><MapPin size={14} /> <span className="grow">{r.label}</span></button>)}
        </div>
      )}
    </div>
  );
}

/** Bloco "Mapa": OpenStreetMap com ponto A, ponto B e o trajeto (carro, bicicleta ou a pé). */
export function MapBlockView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useT();
  const lang = useLang();
  const a = node.attrs.a as GeoPoint | null, b = node.attrs.b as GeoPoint | null;
  const profile = (node.attrs.profile || 'car') as RouteProfile;
  const editable = editor.isEditable;
  const [r, setR] = useState<RouteResult | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setR(null); setErr('');
    if (!a || !b) return;
    let alive = true;
    route(a, b, profile).then((x) => alive && setR(x)).catch(() => alive && setErr(t('geo.noRoute')));
    return () => { alive = false; };
  }, [a?.lat, a?.lon, b?.lat, b?.lon, profile]); // eslint-disable-line react-hooks/exhaustive-deps
  const markers = [
    ...(a ? [{ id: 'a', lat: a.lat, lon: a.lon, label: a.label, color: '#22c55e', tag: 'A' }] : []),
    ...(b ? [{ id: 'b', lat: b.lat, lon: b.lon, label: b.label, color: '#ef4444', tag: 'B' }] : []),
  ];
  return (
    <NodeViewWrapper className={'map-block' + (selected ? ' sel' : '')} contentEditable={false}>
      {editable && (
        <div className="map-form">
          <div className="map-places">
            <PlaceInput label={t('geo.from')} tag="A" color="#22c55e" value={a} onPick={(g) => updateAttributes({ a: g })} />
            <button className="icon-btn sm swap" title={t('geo.swap')} onClick={() => updateAttributes({ a: b, b: a })}><ArrowDownUp size={15} /></button>
            <PlaceInput label={t('geo.to')} tag="B" color="#ef4444" value={b} onPick={(g) => updateAttributes({ b: g })} />
          </div>
          <div className="seg sm">
            {PROFILES.map((p) => { const I = p.icon; return <button key={p.id} className={profile === p.id ? 'on' : ''} onClick={() => updateAttributes({ profile: p.id })} title={t(`geo.${p.id}` as any)}><I size={15} /> <span className="hide-xs">{t(`geo.${p.id}` as any)}</span></button>; })}
          </div>
        </div>
      )}
      <GeoMap markers={markers} route={r?.coords || null} height={node.attrs.height || 340} />
      <div className="map-info">
        {r ? (
          <>
            <span className="map-stat"><Navigation size={14} /> <b>{fmtDistance(r.distance, LOCALES[lang])}</b></span>
            <span className="map-stat">⏱ <b>{fmtDuration(r.duration)}</b></span>
          </>
        ) : err ? <span className="muted small">{err}</span> : !a && !b ? <span className="muted small">{t('geo.blockHint')}</span> : null}
        <span className="grow" />
        {a && <button className="btn ghost xs" onClick={() => openUrl(osmLink(a, b || undefined, profile))}><ExternalLink size={13} /> {t('geo.openMap')}</button>}
        {editable && <button className="icon-btn xs" onClick={deleteNode} title={t('common.delete')}><Trash2 size={14} /></button>}
        <span className="muted small">© OpenStreetMap</span>
      </div>
    </NodeViewWrapper>
  );
}
