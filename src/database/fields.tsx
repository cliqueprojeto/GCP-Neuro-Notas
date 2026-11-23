import { useMemo, useRef, useState } from 'react';
import {
  AtSign, Building2, Calculator, Calendar, CheckSquare, CircleDot, Clock, DollarSign, Fingerprint, Gauge, Hash, KeyRound, Link2, ListChecks,
  AlignLeft, ListTodo, ShoppingCart, Timer,
  MapPin, Map, Paperclip, Phone, Plus, Search, SigmaSquare, Star, Tags, Text, Trash2, Type, X,
} from 'lucide-react';
import type { CondOp, CondRule, DatabaseData, Property, PropType } from '../lib/types';
import { useT, useLang, type TKey } from '../i18n';
import { PROP_GROUPS, OPTION_COLORS, recompute } from './logic';
import { checkFormula, FUNCTION_HELP } from './formula';
import { CURRENCIES, systemCurrency } from './masks';
import { Select } from '../components/ui';
import { DateInput } from '../components/DateInput';
import { NeuroIcon } from '../components/NeuroIcon';
import { uid } from '../lib/crypto';
import { normalize } from '../lib/doc';

export const TYPE_META: Record<PropType, { icon: any; tone: string }> = {
  title: { icon: Type, tone: 'violet' },
  text: { icon: Text, tone: 'violet' },
  number: { icon: Hash, tone: 'green' },
  currency: { icon: DollarSign, tone: 'green' },
  formula: { icon: Calculator, tone: 'green' },
  conditional: { icon: SigmaSquare, tone: 'green' },
  rating: { icon: Star, tone: 'amber' },
  progress: { icon: Gauge, tone: 'green' },
  select: { icon: CircleDot, tone: 'orange' },
  multi: { icon: Tags, tone: 'orange' },
  status: { icon: ListChecks, tone: 'orange' },
  checkbox: { icon: CheckSquare, tone: 'orange' },
  date: { icon: Calendar, tone: 'orange' },
  phone: { icon: Phone, tone: 'blue' },
  email: { icon: AtSign, tone: 'blue' },
  cpf: { icon: Fingerprint, tone: 'blue' },
  cnpj: { icon: Building2, tone: 'blue' },
  cep: { icon: MapPin, tone: 'blue' },
  url: { icon: Link2, tone: 'blue' },
  password: { icon: KeyRound, tone: 'red' },
  created: { icon: Clock, tone: 'gray' },
  files: { icon: Paperclip, tone: 'teal' },
  location: { icon: Map, tone: 'teal' },
  longtext: { icon: AlignLeft, tone: 'violet' },
  items: { icon: ShoppingCart, tone: 'pink' },
  checklist: { icon: ListTodo, tone: 'pink' },
  timer: { icon: Timer, tone: 'red' },
  relation: { icon: NeuroIcon, tone: 'teal' },
};

export function TypeIcon({ type, size = 15 }: { type: PropType; size?: number }) {
  const m = TYPE_META[type] || TYPE_META.text;
  const I = m.icon;
  return (
    <span className={`type-ic tone-${m.tone}`} style={{ width: size + 9, height: size + 9 }}>
      <I size={size} />
    </span>
  );
}

/** Menu de tipos de campo com busca, grupos, ícones coloridos e descrição. */
export function TypeMenu({ onPick, current }: { onPick: (t: PropType) => void; current?: PropType }) {
  const t = useT();
  const [q, setQ] = useState('');
  const n = normalize(q);
  return (
    <div className="type-menu2">
      <div className="type-search">
        <Search size={15} />
        <input autoFocus placeholder={t('db.typeSearch')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="type-scroll">
        {PROP_GROUPS.map((g) => {
          const list = g.types.filter((ty) => !n || normalize(t(`db.type.${ty}` as TKey) + ' ' + t(`db.typeHint.${ty}` as TKey)).includes(n));
          if (!list.length) return null;
          return (
            <div key={g.key}>
              <div className="section-label">{t(`db.group.${g.key}` as TKey)}</div>
              <div className="type-grid">
                {list.map((ty) => (
                  <button key={ty} className={'type-opt' + (current === ty ? ' on' : '')} onClick={() => onPick(ty)}>
                    <TypeIcon type={ty} />
                    <span>
                      <b>{t(`db.type.${ty}` as TKey)}</b>
                      <small>{t(`db.typeHint.${ty}` as TKey)}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const COND_OPS: CondOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'contains', 'empty', 'notEmpty'];

/** Configurações específicas de cada tipo (moeda, fórmula, regras, máscara…). */
export function PropConfig({ prop, db, setProp }: { prop: Property; db: DatabaseData; setProp: (p: Property) => void }) {
  const t = useT();
  const lang = useLang();
  const sys = systemCurrency();
  const ta = useRef<HTMLTextAreaElement>(null);
  const others = db.properties.filter((p) => p.id !== prop.id);
  const err = prop.type === 'formula' ? checkFormula(prop.formula || '') : null;
  const preview = useMemo(() => {
    if (prop.type !== 'formula' && prop.type !== 'conditional') return '';
    const sample = recompute({ ...db, properties: db.properties.map((p) => (p.id === prop.id ? prop : p)), rows: db.rows.slice(0, 1) });
    const v = sample.rows[0]?.cells[prop.id];
    return v == null ? '' : String(v);
  }, [prop, db]);

  const insert = (txt: string) => {
    const el = ta.current;
    const f = prop.formula || '';
    if (!el) return setProp({ ...prop, formula: f + txt });
    const a = el.selectionStart ?? f.length, b = el.selectionEnd ?? f.length;
    setProp({ ...prop, formula: f.slice(0, a) + txt + f.slice(b) });
    requestAnimationFrame(() => (el.focus(), el.setSelectionRange(a + txt.length, a + txt.length)));
  };
  const setRule = (id: string, patch: Partial<CondRule>) => setProp({ ...prop, rules: (prop.rules || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const resultFormat = (
    <Select
      value={prop.resultFormat || 'auto'}
      options={(['auto', 'number', 'currency', 'percent', 'text', 'date'] as const).map((f) => ({ value: f, label: `${t('db.result')}: ${t(`db.rf.${f}` as TKey)}` }))}
      onChange={(resultFormat) => setProp({ ...prop, resultFormat: resultFormat as any })}
    />
  );
  const currencySel = (
    <Select
      value={prop.currency || ''}
      options={[{ value: '', label: `${t('db.currency.auto')} (${sys.code})` }, ...CURRENCIES.map((c) => ({ value: c.code + '|' + c.locale, label: `${c.country} · ${c.code}` }))].map((o) => ({ ...o, value: o.value }))}
      onChange={(v) => {
        if (!v) return setProp({ ...prop, currency: undefined, locale: undefined });
        const [code, locale] = v.split('|');
        setProp({ ...prop, currency: code, locale });
      }}
    />
  );

  switch (prop.type) {
    case 'items':
      return <div className="prop-config"><label className="section-label">{t('db.type.currency')}</label>{currencySel}</div>;
    case 'timer':
      return (
        <div className="prop-config">
          <label className="section-label">{t('work.countKind')}</label>
          <div className="seg2">
            <button className={prop.timerMode !== 'down' ? 'on' : ''} onClick={() => setProp({ ...prop, timerMode: 'up' })}><b>{t('work.up')}</b><small>{t('work.upHint')}</small></button>
            <button className={prop.timerMode === 'down' ? 'on' : ''} onClick={() => setProp({ ...prop, timerMode: 'down', timerMinutes: prop.timerMinutes || 60 })}><b>{t('work.down')}</b><small>{t('work.downHint')}</small></button>
          </div>
          {prop.timerMode === 'down' && (
            <div className="row gap-sm" style={{ marginTop: 8 }}>
              <label className="small muted">{t('work.minutes')}</label>
              <input className="input sm" type="number" min={1} style={{ width: 90 }} value={prop.timerUntil ? '' : prop.timerMinutes || ''} onChange={(e) => setProp({ ...prop, timerMinutes: Number(e.target.value) || 0, timerUntil: undefined })} />
              <label className="small muted">{t('work.orUntil')}</label>
              <DateInput withTime value={prop.timerUntil || ''} onChange={(v) => setProp({ ...prop, timerUntil: v || undefined })} />
            </div>
          )}
          <p className="muted small" style={{ marginTop: 8 }}>{t('work.timerNote')}</p>
        </div>
      );
    case 'currency':
      return (
        <>
          <div className="field-label">{t('db.currency.country')}</div>
          {currencySel}
          <Select
            value={String(prop.decimals ?? '')}
            options={[{ value: '', label: t('db.decimals.auto') }, ...[0, 1, 2, 3, 4].map((d) => ({ value: String(d), label: `${d} ${t('db.decimals')}` }))]}
            onChange={(d) => setProp({ ...prop, decimals: d === '' ? undefined : +d })}
          />
          <p className="muted small">{t('db.currency.hint')}</p>
        </>
      );
    case 'number':
      return (
        <Select
          value={prop.format || 'number'}
          options={[
            { value: 'number', label: t('db.format.number') },
            { value: 'currency', label: t('db.format.currency') },
            { value: 'percent', label: t('db.format.percent') },
          ]}
          onChange={(format) => setProp({ ...prop, format: format as any })}
        />
      );
    case 'phone':
      return (
        <div className="seg">
          <button className={prop.phoneFormat !== 'intl' ? 'on' : ''} onClick={() => setProp({ ...prop, phoneFormat: 'br' })}>🇧🇷 (00) 00000-0000</button>
          <button className={prop.phoneFormat === 'intl' ? 'on' : ''} onClick={() => setProp({ ...prop, phoneFormat: 'intl' })}>🌐 +00</button>
        </div>
      );
    case 'formula':
      return (
        <div className="formula-box">
          <div className="field-label">{t('db.formula')}</div>
          <textarea ref={ta} className={'input mono' + (err ? ' invalid' : '')} rows={3} placeholder="{Quant.} * {Valor unitário}" value={prop.formula || ''} onChange={(e) => setProp({ ...prop, formula: e.target.value })} spellCheck={false} />
          <div className={'formula-status small' + (err ? ' err' : '')}>{err ? `⚠ ${err}` : preview ? `= ${preview}` : t('db.formula.hint')}</div>
          <div className="field-label">{t('db.formula.fields')}</div>
          <div className="chips tight">
            {others.map((p) => (
              <button key={p.id} className="chip sm" onClick={() => insert(`{${p.name}}`)}><TypeIcon type={p.type} size={11} /> {p.name}</button>
            ))}
          </div>
          <div className="chips tight">
            {['+', '-', '*', '/', '&', '=', '>', '<'].map((o) => <button key={o} className="chip sm mono" onClick={() => insert(` ${o} `)}>{o}</button>)}
          </div>
          <details className="formula-help">
            <summary>{t('db.formula.functions')}</summary>
            {FUNCTION_HELP.map((f) => (
              <button key={f.fn} className="menu-item small" onClick={() => insert(f.fn.split('(')[0].split(' ')[0] + (f.fn.includes('(') ? '(' : ''))}>
                <code>{f.fn}</code> <span className="muted">{f[lang]}</span>
              </button>
            ))}
          </details>
          {resultFormat}
          {prop.resultFormat === 'currency' && currencySel}
        </div>
      );
    case 'conditional':
      return (
        <div className="formula-box">
          <div className="field-label">{t('db.cond.rules')}</div>
          {(prop.rules || []).map((r, i) => {
            const src = db.properties.find((p) => p.id === r.prop);
            const needs = !['empty', 'notEmpty'].includes(r.op);
            const opts = src && ['select', 'status', 'multi'].includes(src.type) ? src.options || [] : null;
            return (
              <div key={r.id} className="cond-rule">
                <div className="cond-line">
                  <b className="cond-k">{i === 0 ? t('db.cond.if') : t('db.cond.elseif')}</b>
                  <Select value={r.prop} options={others.filter((p) => p.type !== 'conditional').map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => setRule(r.id, { prop: v })} />
                  <Select value={r.op} options={COND_OPS.map((o) => ({ value: o, label: t(`db.cop.${o}` as TKey) }))} onChange={(v) => setRule(r.id, { op: v as CondOp })} />
                  <button className="icon-btn sm" onClick={() => setProp({ ...prop, rules: (prop.rules || []).filter((x) => x.id !== r.id) })}><X size={14} /></button>
                </div>
                {needs && (
                  <div className="cond-line">
                    {opts ? (
                      <Select value={r.value || ''} placeholder="—" options={opts.map((o) => ({ value: o.label, label: o.label }))} onChange={(v) => setRule(r.id, { value: v })} />
                    ) : (
                      <input className="input" placeholder={t('db.cond.value')} value={r.value || ''} onChange={(e) => setRule(r.id, { value: e.target.value })} />
                    )}
                    {r.op === 'between' && <><span className="muted small">{t('db.cond.and')}</span><input className="input" placeholder={t('db.cond.value')} value={r.value2 || ''} onChange={(e) => setRule(r.id, { value2: e.target.value })} /></>}
                  </div>
                )}
                <div className="cond-line">
                  <b className="cond-k">{t('db.cond.then')}</b>
                  <input className="input" placeholder={t('db.cond.result')} value={r.result} onChange={(e) => setRule(r.id, { result: e.target.value })} />
                  <div className="cond-colors">
                    {OPTION_COLORS.slice(2).map((c) => (
                      <button key={c} className={`pill-dot c-${c}` + (r.color === c ? ' on' : '')} onClick={() => setRule(r.id, { color: r.color === c ? undefined : c })} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <button className="btn ghost sm" onClick={() => setProp({ ...prop, rules: [...(prop.rules || []), { id: uid('k'), prop: others[0]?.id || '', op: 'eq', value: '', result: '' }] })}>
            <Plus size={14} /> {t('db.cond.add')}
          </button>
          <div className="cond-line">
            <b className="cond-k">{t('db.cond.else')}</b>
            <input className="input" placeholder={t('db.cond.result')} value={prop.elseResult || ''} onChange={(e) => setProp({ ...prop, elseResult: e.target.value })} />
          </div>
          <p className="muted small">{t('db.cond.hint')}</p>
          {preview && <div className="formula-status small">= {preview}</div>}
          {resultFormat}
        </div>
      );
  }
  return null;
}

export function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button className="menu-item danger" onClick={onClick}><Trash2 size={15} /> {label}</button>;
}
