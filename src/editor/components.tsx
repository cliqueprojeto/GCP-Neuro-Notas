/**
 * Componentes estilo site: botões e cartões com links para páginas, notas,
 * e-mail ou endereços externos. Também usados no Quadro (elemento "botão").
 */
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useRef, useState } from 'react';
import { icons, ArrowDown, ArrowUp, ExternalLink, FileText, Globe, LayoutGrid, Link2, Mail, MousePointerClick, Plus, Settings2, Trash2, X, Eye } from 'lucide-react';
import { useT, type TKey } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi, toast } from '../store/ui';
import { openUrl } from '../lib/platform';
import { uid } from '../lib/crypto';
import { normalize } from '../lib/doc';
import { PageIcon, Popover, Select } from '../components/ui';
import { IconPicker } from '../components/IconPicker';

export interface LinkTarget {
  type: 'none' | 'page' | 'url' | 'email';
  target: string;
}

export const BRAND_COLORS = ['#7c3aed', '#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#0f172a', '#ffffff'];

/** Segue um link interno ou externo. */
export function followLink(l?: LinkTarget | null) {
  if (!l || l.type === 'none' || !l.target) return false;
  if (l.type === 'page') {
    const p = useVault.getState().pages[l.target];
    if (!p || p.deletedAt) return toast('⚠ ' + (p ? p.title : ''), 'error'), true;
    useUi.getState().go({ name: 'page', id: p.id });
  } else if (l.type === 'email') void openUrl('mailto:' + l.target);
  else void openUrl(/^(https?:|mailto:|tel:)/.test(l.target) ? l.target : 'https://' + l.target);
  return true;
}

export function linkLabel(l?: LinkTarget | null): string {
  if (!l || l.type === 'none' || !l.target) return '';
  if (l.type === 'page') return useVault.getState().pages[l.target]?.title || '…';
  return l.target;
}

/** Ícone a partir de "lucide:Nome:#cor", emoji ou vazio. */
export function CompIcon({ icon, size = 16, color }: { icon?: string; size?: number; color?: string }) {
  if (!icon) return null;
  if (icon.startsWith('lucide:')) {
    const [, name] = icon.split(':');
    const C = (icons as any)[name];
    return C ? <C size={size} color={color} /> : null;
  }
  if (icon.startsWith('data:')) return <img src={icon} alt="" style={{ width: size, height: size }} />;
  return <span style={{ fontSize: size * 0.95, lineHeight: 1 }}>{icon}</span>;
}

/** Escolha do destino do link: página/nota, endereço da web ou e-mail. */
export function LinkPicker({ value, onChange }: { value: LinkTarget; onChange: (l: LinkTarget) => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const pages = useVault((s) => s.pages);
  const list = livePages(pages).filter((p) => normalize(p.title || '').includes(normalize(q))).slice(0, 8);
  const types: LinkTarget['type'][] = ['page', 'url', 'email', 'none'];
  return (
    <div className="link-picker">
      <div className="seg sm">
        {types.map((ty) => (
          <button key={ty} className={value.type === ty ? 'on' : ''} onClick={() => onChange({ type: ty, target: ty === value.type ? value.target : '' })}>
            {ty === 'page' ? <FileText size={12} /> : ty === 'url' ? <Globe size={12} /> : ty === 'email' ? <Mail size={12} /> : <X size={12} />} {t(`comp.link.${ty}` as TKey)}
          </button>
        ))}
      </div>
      {value.type === 'page' && (
        <>
          <input className="input" placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="link-pages">
            {list.map((p) => (
              <button key={p.id} className={'menu-item' + (value.target === p.id ? ' active' : '')} onClick={() => onChange({ type: 'page', target: p.id })}>
                <PageIcon icon={p.icon} size={14} /> <span className="ellipsis">{p.title || t('page.untitled')}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {value.type === 'url' && <input className="input" placeholder="https://…" value={value.target} onChange={(e) => onChange({ type: 'url', target: e.target.value.trim() })} />}
      {value.type === 'email' && <input className="input" type="email" placeholder="nome@email.com" value={value.target} onChange={(e) => onChange({ type: 'email', target: e.target.value.trim() })} />}
    </div>
  );
}

// ------------------------------------------------------------------ botões

export interface ButtonItem {
  id: string;
  label: string;
  icon?: string;
  link: LinkTarget;
  variant: 'solid' | 'gradient' | 'soft' | 'outline' | 'ghost' | 'glass';
  shape: 'pill' | 'rounded' | 'square';
  size: 'sm' | 'md' | 'lg';
  color: string;
  anim?: 'none' | 'pulse' | 'shine' | 'bounce' | 'glow';
  full?: boolean;
}

export const newButton = (label = ''): ButtonItem => ({ id: uid('b'), label, link: { type: 'none', target: '' }, variant: 'gradient', shape: 'pill', size: 'md', color: '#7c3aed', anim: 'none' });

export function ButtonView({ b, onClick, editing }: { b: ButtonItem; onClick?: () => void; editing?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      className={`gbtn v-${b.variant} s-${b.shape} z-${b.size} a-${b.anim || 'none'}` + (b.full ? ' full' : '')}
      style={{ ['--c' as any]: b.color }}
      title={linkLabel(b.link)}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) return onClick();
        if (!followLink(b.link) && editing) toast(t('comp.noLink'), 'info');
      }}
    >
      {b.icon && <CompIcon icon={b.icon} size={b.size === 'lg' ? 20 : b.size === 'sm' ? 14 : 17} />}
      {b.label && <span>{b.label}</span>}
      {b.link.type === 'url' && <ExternalLink size={12} className="gbtn-ext" />}
    </button>
  );
}

function ButtonEditor({ b, onChange, onRemove, onMove }: { b: ButtonItem; onChange: (b: ButtonItem) => void; onRemove: () => void; onMove: (d: -1 | 1) => void }) {
  const t = useT();
  const [iconOpen, setIconOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="comp-editor">
      <div className="row">
        <button ref={ref} className="icon-btn boxed" title={t('comp.icon')} onClick={() => setIconOpen(!iconOpen)}>{b.icon ? <CompIcon icon={b.icon} /> : <Plus size={15} />}</button>
        <input className="input" placeholder={t('comp.label')} value={b.label} onChange={(e) => onChange({ ...b, label: e.target.value })} />
        <button className="icon-btn" onClick={() => onMove(-1)}><ArrowUp size={14} /></button>
        <button className="icon-btn" onClick={() => onMove(1)}><ArrowDown size={14} /></button>
        <button className="icon-btn danger" onClick={onRemove}><Trash2 size={14} /></button>
      </div>
      <Popover anchor={ref.current} open={iconOpen} onClose={() => setIconOpen(false)}>
        <div style={{ width: 330 }}><IconPicker onSelect={(i) => (onChange({ ...b, icon: i }), setIconOpen(false))} onRemove={() => (onChange({ ...b, icon: undefined }), setIconOpen(false))} /></div>
      </Popover>
      <div className="comp-grid">
        <Select value={b.variant} options={(['gradient', 'solid', 'soft', 'outline', 'ghost', 'glass'] as const).map((v) => ({ value: v, label: t(`comp.variant.${v}` as TKey) }))} onChange={(variant) => onChange({ ...b, variant })} />
        <Select value={b.shape} options={(['pill', 'rounded', 'square'] as const).map((v) => ({ value: v, label: t(`comp.shape.${v}` as TKey) }))} onChange={(shape) => onChange({ ...b, shape })} />
        <Select value={b.size} options={(['sm', 'md', 'lg'] as const).map((v) => ({ value: v, label: t(`comp.size.${v}` as TKey) }))} onChange={(size) => onChange({ ...b, size })} />
        <Select value={b.anim || 'none'} options={(['none', 'pulse', 'shine', 'bounce', 'glow'] as const).map((v) => ({ value: v, label: t(`comp.anim.${v}` as TKey) }))} onChange={(anim) => onChange({ ...b, anim })} />
      </div>
      <div className="color-row">
        {BRAND_COLORS.map((c) => <button key={c} className={'color-dot sm' + (b.color === c ? ' on' : '')} style={{ background: c }} onClick={() => onChange({ ...b, color: c })} />)}
        <input type="color" className="color-input" value={b.color} onChange={(e) => onChange({ ...b, color: e.target.value })} />
        <label className="check small"><input type="checkbox" checked={!!b.full} onChange={(e) => onChange({ ...b, full: e.target.checked })} /> {t('comp.full')}</label>
      </div>
      <div className="field-label"><Link2 size={12} /> {t('comp.linkTo')}</div>
      <LinkPicker value={b.link} onChange={(link) => onChange({ ...b, link })} />
    </div>
  );
}

export function ButtonsBlockView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const t = useT();
  const a = node.attrs as { items: ButtonItem[]; align: 'left' | 'center' | 'right' | 'stretch' };
  const [editing, setEditing] = useState(!a.items.length);
  const items = a.items.length ? a.items : [];
  const set = (items: ButtonItem[]) => updateAttributes({ items });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    set(n);
  };
  return (
    <NodeViewWrapper className={'comp-block' + (selected ? ' is-selected' : '') + (editing ? ' editing' : '')} data-type="buttons">
      {editor.isEditable && (
        <div className="comp-tools" contentEditable={false}>
          <span className="block-badge"><MousePointerClick size={13} /> {t('comp.buttons')}</span>
          <div className="seg sm">
            {(['left', 'center', 'right', 'stretch'] as const).map((al) => <button key={al} className={a.align === al ? 'on' : ''} onClick={() => updateAttributes({ align: al })}>{t(`comp.align.${al}` as TKey)}</button>)}
          </div>
          <button className="icon-btn sm" onClick={() => setEditing(!editing)} title={t('common.edit')}>{editing ? <Eye size={15} /> : <Settings2 size={15} />}</button>
        </div>
      )}
      <div className={`comp-buttons al-${a.align || 'left'}`} contentEditable={false}>
        {items.map((b) => <ButtonView key={b.id} b={b} editing={editor.isEditable} />)}
        {!items.length && <span className="muted small">{t('comp.emptyButtons')}</span>}
      </div>
      {editing && editor.isEditable && (
        <div className="comp-editors" contentEditable={false}>
          {items.map((b, i) => (
            <ButtonEditor key={b.id} b={b} onChange={(nb) => set(items.map((x) => (x.id === b.id ? nb : x)))} onRemove={() => set(items.filter((x) => x.id !== b.id))} onMove={(d) => move(i, d)} />
          ))}
          <div className="row">
            <button className="btn ghost sm" onClick={() => set([...items, newButton(t('comp.newButton'))])}><Plus size={14} /> {t('comp.addButton')}</button>
            <div className="grow" />
            <button className="btn primary sm" onClick={() => setEditing(false)}>{t('common.done')}</button>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ----------------------------------------------------------------- cartões

export interface CardItem {
  id: string;
  title: string;
  text: string;
  icon?: string;
  image?: string;
  color: string;
  link: LinkTarget;
  cta?: string;
}

const newCard = (title = ''): CardItem => ({ id: uid('k'), title, text: '', icon: 'lucide:Sparkles:#ffffff', color: '#7c3aed', link: { type: 'none', target: '' } });

export function CardsBlockView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const t = useT();
  const a = node.attrs as { items: CardItem[]; columns: number; style: 'glass' | 'solid' | 'outline' | 'gradient'; hover: 'lift' | 'tilt' | 'glow' | 'none' };
  const [editing, setEditing] = useState(!a.items.length);
  const [iconFor, setIconFor] = useState<string | null>(null);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  const items = a.items || [];
  const set = (items: CardItem[]) => updateAttributes({ items });
  const patch = (id: string, p: Partial<CardItem>) => set(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <NodeViewWrapper className={'comp-block' + (selected ? ' is-selected' : '') + (editing ? ' editing' : '')} data-type="cards">
      {editor.isEditable && (
        <div className="comp-tools" contentEditable={false}>
          <span className="block-badge"><LayoutGrid size={13} /> {t('comp.cards')}</span>
          <div className="seg sm">{[1, 2, 3, 4].map((c) => <button key={c} className={a.columns === c ? 'on' : ''} onClick={() => updateAttributes({ columns: c })}>{c}</button>)}</div>
          <Select value={a.style} options={(['glass', 'solid', 'outline', 'gradient'] as const).map((v) => ({ value: v, label: t(`comp.cardStyle.${v}` as TKey) }))} onChange={(style) => updateAttributes({ style })} />
          <Select value={a.hover} options={(['lift', 'tilt', 'glow', 'none'] as const).map((v) => ({ value: v, label: t(`comp.hover.${v}` as TKey) }))} onChange={(hover) => updateAttributes({ hover })} />
          <button className="icon-btn sm" onClick={() => setEditing(!editing)} title={t('common.edit')}>{editing ? <Eye size={15} /> : <Settings2 size={15} />}</button>
        </div>
      )}
      <div className={`comp-cards st-${a.style} hv-${a.hover}`} contentEditable={false} style={{ gridTemplateColumns: `repeat(${a.columns || 3}, minmax(0, 1fr))` }}>
        {items.map((c, i) => (
          <div
            key={c.id}
            role={c.link.type !== 'none' ? 'link' : undefined}
            className={'comp-card' + (c.link.type !== 'none' && c.link.target ? ' linked' : '')}
            style={{ ['--c' as any]: c.color, animationDelay: `${i * 60}ms` }}
            onClick={() => !editing && followLink(c.link)}
          >
            {c.image && <div className="comp-card-img" style={{ backgroundImage: `url(${c.image})` }} />}
            {editing ? (
              <>
                <button ref={(el) => { if (iconFor === c.id) iconRef.current = el; }} className="comp-card-icon" onClick={(e) => { iconRef.current = e.currentTarget; setIconFor(c.id); }}>
                  <CompIcon icon={c.icon} size={22} color="#fff" />
                </button>
                <input className="comp-card-title-in" placeholder={t('comp.cardTitle')} value={c.title} onChange={(e) => patch(c.id, { title: e.target.value })} />
                <textarea className="comp-card-text-in" rows={2} placeholder={t('comp.cardText')} value={c.text} onChange={(e) => patch(c.id, { text: e.target.value })} />
                <input className="comp-card-cta-in" placeholder={t('comp.cta')} value={c.cta || ''} onChange={(e) => patch(c.id, { cta: e.target.value })} />
                <div className="color-row">
                  {BRAND_COLORS.slice(0, 10).map((col) => <button key={col} className={'color-dot sm' + (c.color === col ? ' on' : '')} style={{ background: col }} onClick={() => patch(c.id, { color: col })} />)}
                </div>
                <LinkPicker value={c.link} onChange={(link) => patch(c.id, { link })} />
                <div className="row">
                  <button className="icon-btn xs" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); }}><ArrowUp size={13} /></button>
                  <button className="icon-btn xs" disabled={i === items.length - 1} onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n); }}><ArrowDown size={13} /></button>
                  <div className="grow" />
                  <button className="icon-btn xs danger" onClick={() => set(items.filter((x) => x.id !== c.id))}><Trash2 size={13} /></button>
                </div>
              </>
            ) : (
              <>
                {c.icon && <span className="comp-card-icon"><CompIcon icon={c.icon} size={22} color="#fff" /></span>}
                <b className="comp-card-title">{c.title || t('comp.cardTitle')}</b>
                {c.text && <p className="comp-card-text">{c.text}</p>}
                {(c.cta || (c.link.type !== 'none' && c.link.target)) && (
                  <span className="comp-card-cta">{c.cta || linkLabel(c.link)} →</span>
                )}
              </>
            )}
          </div>
        ))}
        {editing && <button className="comp-card add" onClick={() => set([...items, newCard(t('comp.cardTitle'))])}><Plus size={20} /> {t('comp.addCard')}</button>}
      </div>
      <Popover anchor={iconRef.current} open={!!iconFor} onClose={() => setIconFor(null)}>
        <div style={{ width: 330 }}><IconPicker onSelect={(ic) => (patch(iconFor!, { icon: ic.startsWith('lucide:') ? ic.replace(/:[^:]+$/, ':#ffffff') : ic }), setIconFor(null))} onRemove={() => (patch(iconFor!, { icon: undefined }), setIconFor(null))} /></div>
      </Popover>
      {editing && editor.isEditable && (
        <div className="row" contentEditable={false} style={{ marginTop: 10 }}>
          <div className="grow" />
          <button className="btn primary sm" onClick={() => setEditing(false)}>{t('common.done')}</button>
        </div>
      )}
    </NodeViewWrapper>
  );
}
