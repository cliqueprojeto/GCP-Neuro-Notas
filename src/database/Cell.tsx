import { useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, ExternalLink, KeyRound, Plus, Star, X } from 'lucide-react';
import type { Property, Row } from '../lib/types';
import { useT, useLang, LOCALES } from '../i18n';
import { Popover } from '../components/ui';
import { cellValue, formatNumber, newOption } from './logic';
import { copyText, openUrl } from '../lib/platform';
import { generatePassword } from '../lib/crypto';
import { toast } from '../store/ui';
import { formatDate } from '../lib/doc';

export function OptionPill({ label, color }: { label: string; color: string }) {
  return <span className={`pill c-${color}`}>{label}</span>;
}

interface CellProps {
  prop: Property;
  row: Row;
  onChange: (v: any) => void;
  onPropChange: (p: Property) => void;
  readOnly?: boolean;
  compact?: boolean;
}

/** Célula editável de uma base de dados (tabela, cartões e formulário de registro). */
export function Cell({ prop, row, onChange, onPropChange, readOnly, compact }: CellProps) {
  const t = useT();
  const lang = useLang();
  const v = cellValue(prop, row);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  switch (prop.type) {
    case 'checkbox':
      return (
        <button className={'cell-check' + (v ? ' on' : '')} onClick={() => !readOnly && onChange(!v)} aria-checked={!!v} role="checkbox">
          {v && <Check size={13} />}
        </button>
      );
    case 'rating':
      return (
        <div className="stars sm">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={n <= (v || 0) ? 'on' : ''} onClick={() => !readOnly && onChange(n === v ? 0 : n)}>
              <Star size={14} fill={n <= (v || 0) ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
      );
    case 'progress':
      return (
        <div className="cell-progress">
          <div className="bar"><span style={{ width: `${Math.min(100, Math.max(0, Number(v) || 0))}%` }} /></div>
          {!compact && (
            <input className="cell-input num" type="number" min={0} max={100} value={v ?? ''} readOnly={readOnly} onChange={(e) => onChange(e.target.value === '' ? '' : Math.min(100, +e.target.value))} />
          )}
        </div>
      );
    case 'created':
      return <span className="cell-text muted">{formatDate(row.createdAt, LOCALES[lang], { dateStyle: 'short', timeStyle: 'short' })}</span>;
    case 'number':
      return compact || readOnly ? (
        <span className="cell-text num">{formatNumber(v, prop.format, LOCALES[lang])}</span>
      ) : (
        <input className="cell-input num" type="number" value={v ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : +e.target.value)} />
      );
    case 'date':
      return compact || readOnly ? (
        <span className="cell-text">{v ? formatDate(v, LOCALES[lang]) : ''}</span>
      ) : (
        <input className="cell-input" type="date" value={v || ''} onChange={(e) => onChange(e.target.value)} />
      );
    case 'password':
      return (
        <div className="cell-pass">
          {readOnly || compact ? (
            <span className="cell-text mono">{v ? (show ? v : '••••••••') : ''}</span>
          ) : (
            <input className="cell-input mono" type={show ? 'text' : 'password'} value={v || ''} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" />
          )}
          {v && <button className="icon-btn xs" title={show ? t('db.hide') : t('db.show')} onClick={() => setShow(!show)}>{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>}
          {v && <button className="icon-btn xs" title={t('common.copy')} onClick={() => copyText(v).then(() => toast(t('db.passwordCopied'), 'success'))}><Copy size={13} /></button>}
          {!readOnly && !compact && <button className="icon-btn xs" title={t('db.generate')} onClick={() => onChange(generatePassword(20))}><KeyRound size={13} /></button>}
        </div>
      );
    case 'url':
    case 'email':
    case 'phone': {
      const href = !v ? '' : prop.type === 'email' ? `mailto:${v}` : prop.type === 'phone' ? `tel:${v}` : /^https?:/.test(v) ? v : `https://${v}`;
      return (
        <div className="cell-link">
          {compact || readOnly ? (
            <span className="cell-text link">{v}</span>
          ) : (
            <input className="cell-input" type={prop.type === 'email' ? 'email' : 'text'} value={v || ''} onChange={(e) => onChange(e.target.value)} />
          )}
          {v && prop.type !== 'phone' && (
            <button className="icon-btn xs" onClick={(e) => (e.stopPropagation(), openUrl(href))}><ExternalLink size={13} /></button>
          )}
          {v && <button className="icon-btn xs" onClick={(e) => (e.stopPropagation(), copyText(v).then(() => toast(t('common.copied'), 'success')))}><Copy size={13} /></button>}
        </div>
      );
    }
    case 'select':
    case 'status':
    case 'multi': {
      const multi = prop.type === 'multi';
      const selected: string[] = multi ? (Array.isArray(v) ? v : []) : v ? [v] : [];
      const opts = prop.options || [];
      return (
        <>
          <div ref={anchor} className="cell-pills" onClick={() => !readOnly && setOpen(true)}>
            {selected.map((id) => {
              const o = opts.find((x) => x.id === id);
              return o ? <OptionPill key={id} label={o.label} color={o.color} /> : null;
            })}
            {!selected.length && !compact && <span className="cell-placeholder">—</span>}
          </div>
          <Popover anchor={anchor.current} open={open} onClose={() => setOpen(false)}>
            <OptionEditor
              prop={prop}
              selected={selected}
              onToggle={(id) => {
                if (multi) onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
                else {
                  onChange(selected[0] === id ? '' : id);
                  setOpen(false);
                }
              }}
              onPropChange={onPropChange}
            />
          </Popover>
        </>
      );
    }
    default:
      return compact || readOnly ? (
        <span className="cell-text">{v}</span>
      ) : (
        <input className={'cell-input' + (prop.type === 'title' ? ' strong' : '')} value={v || ''} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

function OptionEditor({ prop, selected, onToggle, onPropChange }: { prop: Property; selected: string[]; onToggle: (id: string) => void; onPropChange: (p: Property) => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const opts = prop.options || [];
  const list = opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const create = () => {
    if (!q.trim()) return;
    const o = newOption(q.trim(), opts);
    onPropChange({ ...prop, options: [...opts, o] });
    onToggle(o.id);
    setQ('');
  };
  return (
    <div className="option-editor">
      <input className="input" autoFocus placeholder={t('db.searchOrCreate')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (list[0] && list[0].label.toLowerCase() === q.toLowerCase() ? onToggle(list[0].id) : create())} />
      <div className="option-list">
        {list.map((o) => (
          <div key={o.id} className="option-row">
            <button className="option-pick" onClick={() => onToggle(o.id)}>
              <OptionPill label={o.label} color={o.color} />
              {selected.includes(o.id) && <Check size={14} />}
            </button>
            <button className="icon-btn xs" onClick={() => onPropChange({ ...prop, options: opts.filter((x) => x.id !== o.id) })}><X size={12} /></button>
          </div>
        ))}
        {q.trim() && !list.some((o) => o.label.toLowerCase() === q.toLowerCase()) && (
          <button className="menu-item" onClick={create}><Plus size={14} /> {t('db.createOption', { v: q.trim() })}</button>
        )}
      </div>
    </div>
  );
}
