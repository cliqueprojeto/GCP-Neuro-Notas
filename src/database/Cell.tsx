import { useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, ExternalLink, KeyRound, Plus, Star, X } from 'lucide-react';
import type { Property, Row } from '../lib/types';
import { useT, useLang, LOCALES } from '../i18n';
import { Popover } from '../components/ui';
import { cellText, cellValue, conditionalColor, formatNumber, maskFor, newOption } from './logic';
import { CURRENCIES, currencyDigits, currencyFromTyping, formatCurrency, isComplete, systemCurrency, validCnpj, validCpf } from './masks';
import { copyText, openUrl } from '../lib/platform';
import { generatePassword } from '../lib/crypto';
import { toast } from '../store/ui';
import { formatDate } from '../lib/doc';
import type { FileRef, GeoPoint } from '../lib/types';
import { fileKind, fmtSize, openFile, pickFiles, toFileRef } from '../lib/files';
import { geocode, osmLink } from '../lib/geo';
import { MapPin, Paperclip, Search as SearchIcon } from 'lucide-react';
import { DateInput } from '../components/DateInput';
import { ChecklistCell, ItemsCell, LongTextCell, TimerCell } from './workCells';

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
    case 'progress': {
      const pct = Math.min(100, Math.max(0, Number(v) || 0));
      return (
        <div className="cell-progress">
          <div className={'pslider' + (readOnly || compact ? ' ro' : '')} style={{ ['--v' as any]: pct + '%' }}>
            <div className="pslider-track"><span className={'pslider-fill' + (pct >= 100 ? ' done' : '')} /></div>
            {!readOnly && !compact && (
              <input type="range" min={0} max={100} step={5} value={pct} aria-label={prop.name} onChange={(e) => onChange(+e.target.value)} />
            )}
          </div>
          <span className="pslider-val">{pct}%</span>
        </div>
      );
    }
    case 'currency':
      return compact || readOnly ? (
        <span className="cell-text num">{formatCurrency(v, prop.currency, prop.locale, prop.decimals)}</span>
      ) : (
        <CurrencyInput prop={prop} value={v} onChange={onChange} />
      );
    case 'formula':
    case 'conditional': {
      const txt = cellText(prop, v, LOCALES[lang]);
      const color = prop.type === 'conditional' ? conditionalColor(prop, row) : undefined;
      const err = typeof v === 'string' && v.startsWith('#');
      return (
        <span className={'cell-text formula-val' + (err ? ' err' : '') + (typeof v === 'number' ? ' num' : '')} title={err ? t('db.formula.error') : prop.formula || ''}>
          {color ? <OptionPill label={txt} color={color} /> : txt}
        </span>
      );
    }
    case 'cpf':
    case 'cnpj':
    case 'cep': {
      const bad = !!v && (prop.type === 'cpf' ? isComplete('cpf', v) && !validCpf(v) : prop.type === 'cnpj' ? isComplete('cnpj', v) && !validCnpj(v) : false);
      return compact || readOnly ? (
        <span className={'cell-text mono' + (bad ? ' invalid' : '')}>{v}</span>
      ) : (
        <div className="cell-link">
          <input
            className={'cell-input mono' + (bad ? ' invalid' : '')}
            inputMode="numeric"
            value={v || ''}
            placeholder={prop.type === 'cpf' ? '000.000.000-00' : prop.type === 'cnpj' ? '00.000.000/0000-00' : '00000-000'}
            title={bad ? t('db.invalidDoc') : ''}
            onChange={(e) => onChange(maskFor(prop, e.target.value))}
          />
          {v && <button className="icon-btn xs" onClick={(e) => (e.stopPropagation(), copyText(v).then(() => toast(t('common.copied'), 'success')))}><Copy size={13} /></button>}
        </div>
      );
    }
    case 'longtext':
      return <LongTextCell value={v || ''} onChange={onChange} readOnly={readOnly} compact={compact} />;
    case 'items':
      return <ItemsCell prop={prop} value={Array.isArray(v) ? v : []} onChange={onChange} readOnly={readOnly} compact={compact} />;
    case 'checklist':
      return <ChecklistCell value={Array.isArray(v) ? v : []} onChange={onChange} readOnly={readOnly} compact={compact} />;
    case 'timer':
      return <TimerCell prop={prop} row={row} value={v} onChange={onChange} readOnly={readOnly} compact={compact} />;
    case 'files':
      return <FilesCell value={Array.isArray(v) ? v : []} onChange={onChange} readOnly={readOnly} compact={compact} />;
    case 'location':
      return <LocationCell value={v && typeof v === 'object' ? v : null} onChange={onChange} readOnly={readOnly} />;
    case 'created':
      return <span className="cell-text muted">{formatDate(row.createdAt, LOCALES[lang], { dateStyle: 'short', timeStyle: 'short' })}</span>;
    case 'number':
      return compact || readOnly ? (
        <span className="cell-text num">{formatNumber(v, prop.format, LOCALES[lang], prop)}</span>
      ) : (
        <input className="cell-input num" type="number" value={v ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : +e.target.value)} />
      );
    case 'date':
      return compact || readOnly ? (
        <span className="cell-text">{v ? formatDate(v, LOCALES[lang]) : ''}</span>
      ) : (
        <span className="cell-date"><DateInput value={v || ''} onChange={onChange} /></span>
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
            <input
              className="cell-input"
              type={prop.type === 'email' ? 'email' : prop.type === 'phone' ? 'tel' : 'text'}
              inputMode={prop.type === 'phone' ? 'tel' : undefined}
              placeholder={prop.type === 'phone' ? (prop.phoneFormat === 'intl' ? '+00 000 000 0000' : '(00) 00000-0000') : undefined}
              value={v || ''}
              onChange={(e) => onChange(prop.type === 'phone' ? maskFor(prop, e.target.value) : e.target.value)}
            />
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

/** Campo de moeda com máscara: os dígitos entram pela direita (1 → 0,01 → 0,12 → 1,23). */
function CurrencyInput({ prop, value, onChange }: { prop: Property; value: any; onChange: (v: any) => void }) {
  const sys = systemCurrency();
  const code = prop.currency || sys.code;
  const loc = prop.locale || (prop.currency ? CURRENCIES.find((c) => c.code === prop.currency)?.locale : sys.locale) || sys.locale;
  const dec = prop.decimals ?? currencyDigits(code, loc);
  const shown = value === '' || value == null ? '' : formatCurrency(value, code, loc, dec);
  return (
    <input
      className="cell-input num"
      inputMode="decimal"
      value={shown}
      placeholder={formatCurrency(0, code, loc, dec)}
      onChange={(e) => {
        let txt = e.target.value;
        const dOld = shown.replace(/\D/g, ''), dNew = txt.replace(/\D/g, '');
        // Apagou só o símbolo (ex.: "1,23 €"): apaga o último dígito.
        if (txt.length < shown.length && dOld === dNew) txt = dNew.slice(0, -1);
        onChange(currencyFromTyping(txt, dec));
      }}
      onFocus={(e) => requestAnimationFrame(() => e.target.setSelectionRange(e.target.value.length, e.target.value.length))}
    />
  );
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

/** Campo "Arquivos": anexos com ícone contextual; clique abre, ✕ remove, clipe anexa. */
export function FilesCell({ value, onChange, readOnly, compact }: { value: FileRef[]; onChange: (v: FileRef[]) => void; readOnly?: boolean; compact?: boolean }) {
  const t = useT();
  const add = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const files = await pickFiles(true);
    if (!files.length) return;
    try {
      const refs = await Promise.all(files.map(toFileRef));
      onChange([...value, ...refs]);
    } catch (err) {
      toast(String((err as Error).message), 'error');
    }
  };
  return (
    <div className={'files-cell' + (compact ? ' compact' : '')}>
      {value.map((f) => {
        const k = fileKind(f);
        const I = k.icon;
        return (
          <span key={f.id} className="file-chip" title={`${f.name} · ${fmtSize(f.size)}`} onClick={(e) => (e.stopPropagation(), openFile(f))}>
            {f.type.startsWith('image/') ? <img src={f.data} alt="" /> : <I size={13} style={{ color: k.color }} />}
            <span className="fc-name">{f.name}</span>
            {!readOnly && !compact && <button className="fc-x" onClick={(e) => (e.stopPropagation(), onChange(value.filter((x) => x.id !== f.id)))}><X size={11} /></button>}
          </span>
        );
      })}
      {!readOnly && <button className="icon-btn xs fc-add" onClick={add} title={t('files.attach')}><Paperclip size={13} /></button>}
    </div>
  );
}

/** Campo "Local": busca o endereço no OpenStreetMap e guarda as coordenadas. */
export function LocationCell({ value, onChange, readOnly }: { value: GeoPoint | null; onChange: (v: GeoPoint | null) => void; readOnly?: boolean }) {
  const t = useT();
  const lang = useLang();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<GeoPoint[]>([]);
  const [err, setErr] = useState('');
  const search = async () => {
    setBusy(true); setErr('');
    try { setRes(await geocode(q, lang)); } catch { setErr(t('geo.offline')); } finally { setBusy(false); }
  };
  return (
    <div className="loc-cell">
      <button ref={ref} className="loc-btn" disabled={readOnly && !value} onClick={(e) => { e.stopPropagation(); if (readOnly && value) openUrl(osmLink(value)); else (setOpen(true), setQ(value?.label || '')); }}>
        <MapPin size={13} /> <span className="ellipsis">{value ? value.label.split(',').slice(0, 2).join(',') : readOnly ? '' : t('geo.pick')}</span>
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)}>
        <div className="loc-pop" onClick={(e) => e.stopPropagation()}>
          <div className="row gap-sm">
            <input className="input" autoFocus placeholder={t('geo.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
            <button className="btn primary sm" onClick={search} disabled={busy}><SearchIcon size={14} /></button>
          </div>
          {err && <p className="small" style={{ color: 'var(--danger, #ef4444)' }}>{err}</p>}
          <div className="loc-results">
            {res.map((r, i) => (
              <button key={i} className="menu-item" onClick={() => (onChange(r), setOpen(false))}><MapPin size={14} /> <span className="grow">{r.label}</span></button>
            ))}
            {!busy && !res.length && <p className="muted small">{t('geo.hint')}</p>}
          </div>
          {value && (
            <div className="row gap-sm">
              <button className="btn ghost xs" onClick={() => openUrl(osmLink(value))}><ExternalLink size={13} /> {t('geo.openMap')}</button>
              <button className="btn ghost xs danger" onClick={() => (onChange(null), setOpen(false))}><X size={13} /> {t('common.remove')}</button>
            </div>
          )}
        </div>
      </Popover>
    </div>
  );
}
