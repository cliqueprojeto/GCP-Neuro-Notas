import { useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Paintbrush } from 'lucide-react';
import { useT } from '../i18n';
import { useVault } from '../store/vault';
import { toast, useUi } from '../store/ui';
import { PageIcon, Popover } from '../components/ui';
import { CustomColors } from '../components/ColorPicker';
import { coverCss } from '../lib/themes';
import { pageText } from '../lib/doc';

export const LINK_VARIANTS = ['chip', 'text', 'button', 'card'] as const;
export type LinkVariant = (typeof LINK_VARIANTS)[number];
const LINK_COLORS = ['#7c3aed', '#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#475569', '#0f172a'];

/** Link para outra página: etiqueta, texto, botão ou cartão com prévia (ícone, capa e começo do texto). */
export function PageLinkView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const t = useT();
  const { id, label, variant = 'chip', color, icon: showIcon = true } = node.attrs as { id: string; label: string; variant?: LinkVariant; color?: string | null; icon?: boolean };
  const page = useVault((v) => (id ? v.pages[id] : undefined));
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const broken = !page || !!page.deletedAt;
  const title = page?.title || label || '…';
  const editable = editor.isEditable;
  const style = color ? ({ ['--pl' as string]: color } as React.CSSProperties) : undefined;

  /** Aplica o mesmo visual a todos os links do bloco (coluna, célula, destaque…). */
  const applyAll = () => {
    if (typeof getPos !== 'function') return;
    const $pos = editor.state.doc.resolve(getPos());
    let depth = $pos.depth;
    for (let d = $pos.depth; d > 0; d--) {
      if (['column', 'tableCell', 'tableHeader', 'callout', 'blockquote', 'toggle'].includes($pos.node(d).type.name)) {
        depth = d;
        break;
      }
    }
    const from = $pos.start(depth), to = $pos.end(depth);
    const tr = editor.state.tr;
    editor.state.doc.nodesBetween(from, to, (n, pos) => {
      if (n.type.name === 'pageLink') tr.setNodeMarkup(pos, undefined, { ...n.attrs, variant, color, icon: showIcon });
    });
    editor.view.dispatch(tr);
    setOpen(false);
  };

  const snippet = variant === 'card' && page ? pageText(page).replace(/\s+/g, ' ').trim().replace(new RegExp('^' + (page.title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '').slice(0, 110) : '';
  const go = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.pl-style, .pl-panel, .popover')) return;
    e.preventDefault();
    if (page && !page.deletedAt) useUi.getState().go({ name: 'page', id: page.id });
    else toast(t('editor.brokenLink'), 'error');
  };
  return (
    <NodeViewWrapper
      as="span"
      className={`page-link pl-${variant}` + (color ? ' pl-colored' : '') + (broken ? ' broken' : '')}
      data-type="pageLink"
      data-id={id || undefined}
      data-label={label}
      style={style}
      contentEditable={false}
      onClick={go}
    >
      {variant === 'card' ? (
        <>
          <span className="pl-cover" style={page?.cover ? { background: coverCss(page.cover) } : undefined} />
          <span className="pl-body">
            <span className="pl-title">{showIcon && <PageIcon icon={page?.icon || '📄'} size={18} />}<span>{title}</span></span>
            {snippet && <span className="pl-snippet">{snippet}</span>}
          </span>
        </>
      ) : (
        <>
          {showIcon && variant !== 'chip' && <PageIcon icon={page?.icon || '📄'} size={variant === 'button' ? 16 : 14} />}
          {showIcon && variant === 'chip' && page?.icon ? <PageIcon icon={page.icon} size={13} /> : null}
          <span className="pl-label">{title}</span>
        </>
      )}
      {editable && (
        <button ref={ref} className="pl-style" title={t('plink.style')} onMouseDown={(e) => e.preventDefault()} onClick={(e) => (e.stopPropagation(), setOpen(!open))}>
          <Paintbrush size={11} />
        </button>
      )}
      {open && (
        <Popover anchor={ref.current} open onClose={() => setOpen(false)}>
          <div className="pl-panel" onMouseDown={(e) => (e.target as HTMLElement).tagName !== 'INPUT' && e.preventDefault()}>
            <div className="cb-label">{t('plink.look')}</div>
            <div className="pl-variants">
              {LINK_VARIANTS.map((v) => (
                <button key={v} className={'pl-variant' + (variant === v ? ' on' : '')} onClick={() => updateAttributes({ variant: v })}>
                  <span className={`page-link pl-${v} pl-demo`} style={style}>{v === 'card' ? <><span className="pl-cover" /><span className="pl-body"><span className="pl-title">Aa</span></span></> : 'Aa'}</span>
                  <small>{t(`plink.${v}` as any)}</small>
                </button>
              ))}
            </div>
            <div className="cb-label">{t('plink.color')}</div>
            <div className="color-row wrap">
              <button className={'color-dot sm none' + (!color ? ' on' : '')} title={t('plink.themeColor')} onClick={() => updateAttributes({ color: null })}>×</button>
              {LINK_COLORS.map((c) => <button key={c} className={'color-dot sm' + (color === c ? ' on' : '')} style={{ background: c }} onClick={() => updateAttributes({ color: c })} />)}
              <CustomColors small value={color || undefined} onPick={(c) => updateAttributes({ color: c })} />
            </div>
            <label className="switch-row small">
              <input type="checkbox" checked={showIcon} onChange={(e) => updateAttributes({ icon: e.target.checked })} /> {t('plink.showIcon')}
            </label>
            <button className="btn ghost sm" onClick={applyAll}>{t('plink.applyAll')}</button>
          </div>
        </Popover>
      )}
    </NodeViewWrapper>
  );
}
