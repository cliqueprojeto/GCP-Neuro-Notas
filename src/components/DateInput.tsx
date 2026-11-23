import { useEffect, useRef, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { useLang, LOCALES } from '../i18n';
import { isoToLocal, localToIso, maskDate } from '../lib/dates';

/**
 * Campo de data sempre no padrão do idioma do app (PT: DD/MM/AAAA),
 * independente do idioma do sistema operacional. O calendário nativo abre pelo ícone.
 */
export function DateInput({ value, onChange, className = '', disabled, placeholder, withTime }: {
  value: string; onChange: (iso: string) => void; className?: string; disabled?: boolean; placeholder?: string; withTime?: boolean;
}) {
  const lang = useLang();
  const loc = LOCALES[lang];
  const datePart = (value || '').slice(0, 10);
  const timePart = withTime ? (value || '').slice(11, 16) : '';
  const [text, setText] = useState(isoToLocal(datePart, loc));
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => setText(isoToLocal(datePart, loc)), [datePart, loc]);
  const ph = placeholder || (lang === 'en' ? 'MM/DD/YYYY' : lang === 'es' ? 'DD/MM/AAAA' : 'DD/MM/AAAA');
  const emit = (iso: string, time = timePart) => onChange(iso ? (withTime ? `${iso}T${time || '09:00'}` : iso) : '');
  const commit = () => {
    if (!text.trim()) return datePart && emit('');
    const iso = localToIso(text, loc);
    if (iso) { if (iso !== datePart) emit(iso); setText(isoToLocal(iso, loc)); }
    else setText(isoToLocal(datePart, loc));
  };
  return (
    <span className={'date-input ' + className} onClick={(e) => e.stopPropagation()}>
      <input
        className="date-text"
        value={text}
        disabled={disabled}
        inputMode="numeric"
        placeholder={ph}
        onChange={(e) => setText(maskDate(e.target.value, loc))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      {withTime && (
        <input className="date-time" type="time" value={timePart} disabled={disabled || !datePart} onChange={(e) => emit(datePart, e.target.value)} />
      )}
      <button type="button" className="date-btn" disabled={disabled} tabIndex={-1} onClick={() => { const el = pick.current as any; el?.showPicker ? el.showPicker() : el?.click(); }}>
        <CalendarDays size={14} />
      </button>
      {datePart && !disabled && <button type="button" className="date-btn clear" tabIndex={-1} onClick={() => emit('')}><X size={12} /></button>}
      <input ref={pick} className="date-native" type="date" tabIndex={-1} value={datePart} onChange={(e) => emit(e.target.value)} />
    </span>
  );
}
