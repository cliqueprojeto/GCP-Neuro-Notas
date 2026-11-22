import { useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { AtSign, Check, Copy, Download, ImagePlus, Link2, MessageCircle, MessageSquare, Pencil, Phone, QrCode, Trash2, Type, UserSquare, Wallet, Wifi, X } from 'lucide-react';
import { useT } from '../i18n';
import { copyText, pickImages } from '../lib/platform';
import { toast } from '../store/ui';
import { DEFAULT_QR_STYLE, QR_CORNERS, QR_DOTS, QR_FIELDS, QR_KINDS, qrDownload, qrPayload, qrPng, renderQr, type QrFields, type QrKind, type QrStyle } from '../lib/qr';

const KIND_ICON: Record<QrKind, any> = { link: Link2, text: Type, email: AtSign, phone: Phone, sms: MessageSquare, whatsapp: MessageCircle, wifi: Wifi, pix: Wallet, vcard: UserSquare };
const PRESETS = ['#141414', '#4c1d95', '#1d4ed8', '#047857', '#b91c1c', '#c2410c', '#0f766e', '#be185d'];

export function QrView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const t = useT();
  const kind = (node.attrs.kind || 'link') as QrKind;
  const fields = (node.attrs.fields || {}) as QrFields;
  const style = { ...DEFAULT_QR_STYLE, ...(node.attrs.style || {}) } as QrStyle;
  const editable = editor.isEditable;
  const [open, setOpen] = useState(!!node.attrs.autoOpen);
  const box = useRef<HTMLDivElement>(null);
  const data = qrPayload(kind, fields);
  const empty = !data.replace(/^(mailto:|tel:|SMSTO::?|https:\/\/wa\.me\/)$/, '').trim() || data === 'https://';
  useEffect(() => { if (node.attrs.autoOpen) updateAttributes({ autoOpen: false }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (box.current) void renderQr(box.current, empty ? 'https://www.gestaoculturalpro.com.br' : data, style, node.attrs.size || 220);
    // PNG guardado no bloco: aparece em PDF, Word, HTML e impressão
    const tm = setTimeout(() => { if (!empty) void qrPng(data, style, 480).then((image) => image !== node.attrs.image && updateAttributes({ image })); }, 500);
    return () => clearTimeout(tm);
  }, [data, JSON.stringify(style), node.attrs.size]); // eslint-disable-line react-hooks/exhaustive-deps
  const setField = (k: string, v: string) => updateAttributes({ fields: { ...fields, [k]: v } });
  const setStyle = (p: Partial<QrStyle>) => updateAttributes({ style: { ...style, ...p } });
  const label = (k: string) => t(`qr.f.${k}` as any);
  const ph = (k: string) => t(`qr.ph.${k}` as any);
  return (
    <NodeViewWrapper className={'qr-block' + (selected ? ' sel' : '') + (open && editable ? ' editing' : '')} data-align={node.attrs.align || 'center'} contentEditable={false}>
      <div className="qr-main">
        <div className={'qr-card' + (empty ? ' empty' : '')} data-href={!empty && /^(https?:|mailto:|tel:)/.test(data) ? data : undefined} data-label={node.attrs.caption || undefined}>
          <div ref={box} className="qr-canvas" />
          {empty && <div className="qr-empty-tag">{t('qr.example')}</div>}
          <input className="qr-caption" placeholder={editable ? t('qr.captionPh') : ''} value={node.attrs.caption || ''} readOnly={!editable} onChange={(e) => updateAttributes({ caption: e.target.value })} />
          <div className="qr-actions">
            {editable && <button className="btn ghost xs" onClick={() => setOpen(!open)}><Pencil size={13} /> {open ? t('qr.close') : t('qr.edit')}</button>}
            <button className="icon-btn xs" title="PNG" disabled={empty} onClick={() => void qrDownload(data, style, 'png', node.attrs.caption || 'qrcode')}><Download size={13} /><small>PNG</small></button>
            <button className="icon-btn xs" title="SVG" disabled={empty} onClick={() => void qrDownload(data, style, 'svg', node.attrs.caption || 'qrcode')}><Download size={13} /><small>SVG</small></button>
            {editable && <button className="icon-btn xs" title={t('common.delete')} onClick={deleteNode}><Trash2 size={13} /></button>}
          </div>
        </div>
        {open && editable && (
          <div className="qr-editor">
            <div className="section-label"><QrCode size={12} /> {t('qr.type')}</div>
            <div className="qr-kinds">
              {QR_KINDS.map((k) => { const I = KIND_ICON[k]; return <button key={k} className={'qr-kind' + (k === kind ? ' on' : '')} onClick={() => updateAttributes({ kind: k })}><I size={14} /> {t(`qr.k.${k}` as any)}</button>; })}
            </div>
            <div className="qr-fields">
              {QR_FIELDS[kind].map((f) => (
                <label key={f.key} className={'qr-field' + (f.type === 'textarea' ? ' wide' : '') + (f.type === 'check' ? ' check' : '')}>
                  {f.type === 'check' ? (
                    <><input type="checkbox" checked={fields[f.key] === '1'} onChange={(e) => setField(f.key, e.target.checked ? '1' : '')} /> {label(f.key)}</>
                  ) : (
                    <>
                      <span>{label(f.key)}</span>
                      {f.type === 'textarea' ? <textarea className="input" rows={3} placeholder={ph(f.key)} value={fields[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} />
                        : f.type === 'select' ? <select className="input" value={fields[f.key] || f.options![0]} onChange={(e) => setField(f.key, e.target.value)}>{f.options!.map((o) => <option key={o} value={o}>{o === 'nopass' ? t('qr.nopass') : o}</option>)}</select>
                        : <input className="input" placeholder={ph(f.key)} value={fields[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} />}
                    </>
                  )}
                </label>
              ))}
            </div>
            <div className="qr-generated">
              <div className="row"><b className="small grow">{t('qr.generated')}</b><button className="btn ghost xs" disabled={empty} onClick={() => copyText(data).then(() => toast(t('common.copied'), 'success'))}><Copy size={12} /> {t('qr.copy')}</button></div>
              <pre>{empty ? '—' : data}</pre>
              <small className="muted">{t(`qr.hint.${kind}` as any)}</small>
            </div>
            <div className="qr-row2">
              <label className="qr-color"><span>{t('qr.fg')}</span><input type="color" value={style.fg} onChange={(e) => setStyle({ fg: e.target.value })} /><code>{style.fg}</code></label>
              <label className="qr-color"><span>{t('qr.bg')}</span><input type="color" value={style.bg} onChange={(e) => setStyle({ bg: e.target.value })} /><code>{style.bg}</code></label>
            </div>
            <div className="qr-presets">{PRESETS.map((c) => <button key={c} style={{ background: c }} className={style.fg === c ? 'on' : ''} onClick={() => setStyle({ fg: c })} />)}
              <label className="check small"><input type="checkbox" checked={!!style.gradient} onChange={(e) => setStyle({ gradient: e.target.checked })} /> {t('qr.gradient')}</label>
            </div>
            <div className="section-label">{t('qr.dots')}</div>
            <div className="qr-seg">{QR_DOTS.map((d) => <button key={d} className={style.dots === d ? 'on' : ''} onClick={() => setStyle({ dots: d })}>{t(`qr.d.${d}` as any)}</button>)}</div>
            <div className="section-label">{t('qr.corners')}</div>
            <div className="qr-seg">{QR_CORNERS.map((d) => <button key={d} className={style.corners === d ? 'on' : ''} onClick={() => setStyle({ corners: d })}>{t(`qr.c.${d}` as any)}</button>)}</div>
            <div className="section-label">{t('qr.logo')}</div>
            <div className="row gap-sm">
              <button className="btn ghost sm" onClick={async () => { const [src] = await pickImages(false, 400); if (src) setStyle({ logo: src }); }}><ImagePlus size={14} /> {style.logo ? t('qr.logoChange') : t('qr.logoPick')}</button>
              {style.logo && <><img src={style.logo} alt="" className="qr-logo-prev" /><button className="icon-btn xs" onClick={() => setStyle({ logo: undefined })}><X size={13} /></button></>}
              <span className="grow" />
              <div className="qr-seg sm">{[160, 220, 300].map((s) => <button key={s} className={(node.attrs.size || 220) === s ? 'on' : ''} onClick={() => updateAttributes({ size: s })}>{s === 160 ? 'P' : s === 220 ? 'M' : 'G'}</button>)}</div>
            </div>
            <button className="btn primary sm qr-done" onClick={() => setOpen(false)}><Check size={14} /> {t('qr.done')}</button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

const json = (name: string, def: any) => ({
  default: def,
  parseHTML: (el: HTMLElement) => { try { return JSON.parse(el.getAttribute('data-' + name) || 'null') ?? def; } catch { return def; } },
  renderHTML: (a: Record<string, any>) => ({ ['data-' + name]: JSON.stringify(a[name]) }),
});

export const QrBlock = Node.create({
  name: 'qrcode',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { kind: json('kind', 'link'), fields: json('fields', {}), style: json('style', {}), caption: json('caption', ''), size: json('size', 220), image: json('image', ''), align: json('align', 'center'), autoOpen: { default: false, rendered: false } };
  },
  parseHTML: () => [{ tag: 'div[data-type="qrcode"]' }],
  renderHTML: ({ HTMLAttributes, node }) => {
    const data = qrPayload(node.attrs.kind, node.attrs.fields || {});
    const href = /^(https?:|mailto:|tel:)/.test(data) ? data : undefined;
    const img = ['img', { src: node.attrs.image || '', alt: 'QR Code', width: String(node.attrs.size || 220), height: String(node.attrs.size || 220), class: 'qr-export-img' }];
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'qrcode', class: 'qr-export', style: 'text-align:center;margin:16px 0' }),
      href ? ['a', { href }, img] : img,
      ...(node.attrs.caption ? [['p', { class: 'qr-export-caption' }, node.attrs.caption]] : [])];
  },
  addNodeView: () => ReactNodeViewRenderer(QrView),
});
