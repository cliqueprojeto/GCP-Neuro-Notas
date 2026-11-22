import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, ChevronRight, Dices, Download, Eye, FileSpreadsheet, ImagePlus, ListChecks, Plus, RotateCcw, Settings2, Shuffle, Trash2, Trophy, X,
} from 'lucide-react';
import { useT, useLang, LOCALES } from '../i18n';
import { pickImages, saveTextFile } from '../lib/platform';
import { uid } from '../lib/crypto';
import { useVault } from '../store/vault';
import { useUi, toast } from '../store/ui';
import { formatDate } from '../lib/doc';

// ------------------------------------------------------------------ callout

const TONES = ['info', 'success', 'warning', 'danger', 'purple', 'gray'];
const TONE_EMOJI: Record<string, string> = { info: '💡', success: '✅', warning: '⚠️', danger: '🚨', purple: '🔮', gray: '📌' };

export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const cycle = () => {
    if (!editor.isEditable) return;
    const i = TONES.indexOf(node.attrs.tone);
    const tone = TONES[(i + 1) % TONES.length];
    updateAttributes({ tone, emoji: TONE_EMOJI[tone] });
  };
  return (
    <NodeViewWrapper className={`callout tone-${node.attrs.tone}`} data-type="callout">
      <button className="callout-emoji" contentEditable={false} onClick={cycle} title="↻">
        {node.attrs.emoji}
      </button>
      <NodeViewContent className="callout-body" as="div" />
    </NodeViewWrapper>
  );
}

// ------------------------------------------------------------------ toggle

export function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const t = useT();
  return (
    <NodeViewWrapper className={'toggle' + (node.attrs.open ? ' open' : '')} data-type="toggle">
      <div className="toggle-head" contentEditable={false}>
        <button className="toggle-btn" onClick={() => updateAttributes({ open: !node.attrs.open })}>
          <ChevronRight size={16} />
        </button>
        <input className="toggle-summary" value={node.attrs.summary} placeholder={t('block.toggle.placeholder')} onChange={(e) => updateAttributes({ summary: e.target.value })} />
      </div>
      <NodeViewContent className="toggle-body" as="div" />
    </NodeViewWrapper>
  );
}

// -------------------------------------------------------------------- poll

interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export function PollView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const t = useT();
  const a = node.attrs as { question: string; multiple: boolean; options: PollOption[] };
  const [editing, setEditing] = useState(!a.question);
  const total = a.options.reduce((s, o) => s + (o.votes || 0), 0);
  const max = Math.max(1, ...a.options.map((o) => o.votes || 0));
  const set = (patch: any) => updateAttributes(patch);
  const options = a.options.length ? a.options : [];
  return (
    <NodeViewWrapper className={'block-card poll' + (selected ? ' is-selected' : '')} data-type="poll">
      <div className="block-card-head" contentEditable={false}>
        <span className="block-badge"><BarChart3 size={14} /> {t('block.poll')}</span>
        <div className="grow" />
        {editor.isEditable && (
          <button className="icon-btn sm" onClick={() => setEditing(!editing)} title={t('common.edit')}>
            {editing ? <Eye size={15} /> : <Settings2 size={15} />}
          </button>
        )}
      </div>
      <div contentEditable={false}>
        {editing ? (
          <div className="stack">
            <input className="input lg" placeholder={t('block.poll.question')} value={a.question} onChange={(e) => set({ question: e.target.value })} />
            {options.map((o, i) => (
              <div className="row" key={o.id}>
                <input
                  className="input"
                  placeholder={`${t('block.poll.option')} ${i + 1}`}
                  value={o.label}
                  onChange={(e) => set({ options: options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })}
                />
                <button className="icon-btn" onClick={() => set({ options: options.filter((x) => x.id !== o.id) })}>
                  <X size={15} />
                </button>
              </div>
            ))}
            <div className="row">
              <button className="btn ghost" onClick={() => set({ options: [...options, { id: uid('o'), label: '', votes: 0 }] })}>
                <Plus size={15} /> {t('block.poll.addOption')}
              </button>
              <label className="check">
                <input type="checkbox" checked={a.multiple} onChange={(e) => set({ multiple: e.target.checked })} /> {t('block.poll.multiple')}
              </label>
              <div className="grow" />
              <button className="btn primary" onClick={() => setEditing(false)}>{t('common.done')}</button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <div className="poll-q">{a.question || t('block.poll.question')}</div>
            {options.map((o) => {
              const pct = total ? Math.round(((o.votes || 0) / total) * 100) : 0;
              return (
                <button key={o.id} className="poll-opt" onClick={() => set({ options: options.map((x) => (x.id === o.id ? { ...x, votes: (x.votes || 0) + 1 } : x)) })}>
                  <span className="poll-bar" style={{ width: `${((o.votes || 0) / max) * 100}%` }} />
                  <span className="poll-label">{o.label || '—'}</span>
                  <span className="poll-val">
                    {o.votes || 0} · {pct}%
                  </span>
                </button>
              );
            })}
            <div className="row muted small">
              <span>{t('block.poll.total', { n: total })}</span>
              <div className="grow" />
              {editor.isEditable && total > 0 && (
                <button className="btn ghost sm" onClick={() => set({ options: options.map((x) => ({ ...x, votes: 0 })) })}>
                  <RotateCcw size={14} /> {t('block.poll.reset')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ------------------------------------------------------------------ raffle

interface RaffleResult {
  at: number;
  winners: string[];
}

export function RaffleView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const t = useT();
  const lang = useLang();
  const a = node.attrs as { title: string; mode: 'list' | 'number'; entries: string[]; min: number; max: number; count: number; unique: boolean; results: RaffleResult[] };
  const [text, setText] = useState(a.entries.join('\n'));
  const [rolling, setRolling] = useState<string[] | null>(null);
  const set = (patch: any) => updateAttributes(patch);
  useEffect(() => setText(a.entries.join('\n')), [a.entries]);

  const pool = useMemo(() => {
    if (a.mode === 'number') {
      const out: string[] = [];
      for (let i = Math.min(a.min, a.max); i <= Math.max(a.min, a.max) && out.length < 100000; i++) out.push(String(i));
      return out;
    }
    return a.entries.map((e) => e.trim()).filter(Boolean);
  }, [a.mode, a.entries, a.min, a.max]);

  const draw = () => {
    if (!pool.length) return toast(t('block.raffle.empty'), 'error');
    const n = Math.max(1, Math.min(a.count || 1, a.unique ? pool.length : 999));
    const rnd = (k: number) => {
      const b = new Uint32Array(1);
      crypto.getRandomValues(b);
      return b[0] % k;
    };
    const winners: string[] = [];
    const avail = [...pool];
    for (let i = 0; i < n; i++) {
      const idx = rnd(avail.length);
      winners.push(avail[idx]);
      if (a.unique) avail.splice(idx, 1);
      if (!avail.length) break;
    }
    // Animação de "roleta" antes de revelar o resultado.
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      setRolling(winners.map(() => pool[rnd(pool.length)]));
      if (ticks > 16) {
        clearInterval(timer);
        setRolling(null);
        set({ results: [{ at: Date.now(), winners }, ...(a.results || [])].slice(0, 20) });
      }
    }, 70);
  };

  const last = a.results?.[0];
  return (
    <NodeViewWrapper className={'block-card raffle' + (selected ? ' is-selected' : '')} data-type="raffle">
      <div className="block-card-head" contentEditable={false}>
        <span className="block-badge"><Dices size={14} /> {t('block.raffle')}</span>
        <input className="block-title" value={a.title} placeholder={t('block.raffle.title')} onChange={(e) => set({ title: e.target.value })} readOnly={!editor.isEditable} />
      </div>
      <div className="raffle-grid" contentEditable={false}>
        <div className="stack">
          <div className="seg">
            <button className={a.mode === 'list' ? 'on' : ''} onClick={() => set({ mode: 'list' })}>
              <ListChecks size={14} /> {t('block.raffle.list')}
            </button>
            <button className={a.mode === 'number' ? 'on' : ''} onClick={() => set({ mode: 'number' })}>
              # {t('block.raffle.numbers')}
            </button>
          </div>
          {a.mode === 'list' ? (
            <textarea
              className="input"
              rows={6}
              value={text}
              placeholder={t('block.raffle.entries')}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => set({ entries: text.split('\n') })}
            />
          ) : (
            <div className="row">
              <label className="field-inline">{t('block.raffle.from')}<input className="input" type="number" value={a.min} onChange={(e) => set({ min: +e.target.value })} /></label>
              <label className="field-inline">{t('block.raffle.to')}<input className="input" type="number" value={a.max} onChange={(e) => set({ max: +e.target.value })} /></label>
            </div>
          )}
          <div className="row">
            <label className="field-inline">
              {t('block.raffle.count')}
              <input className="input" type="number" min={1} value={a.count} onChange={(e) => set({ count: Math.max(1, +e.target.value) })} style={{ width: 70 }} />
            </label>
            <label className="check">
              <input type="checkbox" checked={a.unique} onChange={(e) => set({ unique: e.target.checked })} /> {t('block.raffle.unique')}
            </label>
          </div>
          <div className="row">
            <button className="btn primary" onClick={draw} disabled={!!rolling}>
              <Shuffle size={15} /> {t('block.raffle.draw')}
            </button>
            <span className="muted small">{t('block.raffle.pool', { n: pool.length })}</span>
          </div>
        </div>
        <div className="raffle-stage">
          {rolling ? (
            <div className="raffle-winners rolling">{rolling.map((w, i) => <span key={i}>{w}</span>)}</div>
          ) : last ? (
            <>
              <Trophy size={26} className="raffle-trophy" />
              <div className="raffle-winners">{last.winners.map((w, i) => <span key={i}>{w}</span>)}</div>
              <small className="muted">{formatDate(last.at, LOCALES[lang], { dateStyle: 'short', timeStyle: 'short' })}</small>
            </>
          ) : (
            <span className="muted">{t('block.raffle.ready')}</span>
          )}
          {a.results?.length > 1 && (
            <details className="raffle-history">
              <summary>{t('block.raffle.history')}</summary>
              {a.results.slice(1).map((r) => (
                <div key={r.at} className="small">
                  {formatDate(r.at, LOCALES[lang], { dateStyle: 'short', timeStyle: 'short' })} — {r.winners.join(', ')}
                </div>
              ))}
            </details>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// -------------------------------------------------------------------- form

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'number' | 'date' | 'select' | 'checkbox' | 'rating';
  required?: boolean;
  options?: string[];
}

interface FormResponse {
  id: string;
  at: number;
  values: Record<string, any>;
}

export function FormView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const t = useT();
  const lang = useLang();
  const a = node.attrs as { title: string; description: string; fields: FormField[]; responses: FormResponse[] };
  const [tab, setTab] = useState<'fill' | 'edit' | 'responses'>(a.fields.length ? 'fill' : 'edit');
  const [values, setValues] = useState<Record<string, any>>({});
  const set = (patch: any) => updateAttributes(patch);
  const types: FormField['type'][] = ['text', 'textarea', 'email', 'number', 'date', 'select', 'checkbox', 'rating'];

  const submit = () => {
    for (const f of a.fields) {
      if (f.required && (values[f.id] == null || values[f.id] === '' || values[f.id] === false)) return toast(t('block.form.required', { f: f.label }), 'error');
    }
    set({ responses: [...(a.responses || []), { id: uid('r'), at: Date.now(), values }] });
    setValues({});
    toast(t('block.form.sent'), 'success');
  };

  const csv = () => {
    const head = ['Data', ...a.fields.map((f) => f.label)];
    const rows = a.responses.map((r) => [new Date(r.at).toISOString(), ...a.fields.map((f) => String(r.values[f.id] ?? ''))]);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    void saveTextFile(`${a.title || 'formulario'}.csv`, [head, ...rows].map((r) => r.map(esc).join(',')).join('\n'), [{ name: 'CSV', extensions: ['csv'] }]);
  };

  const toDatabase = () => {
    const v = useVault.getState();
    const titleId = uid('c');
    const props = a.fields.map((f) => ({
      id: f.id,
      name: f.label || f.type,
      type: (f.type === 'number' || f.type === 'rating' ? 'number' : f.type === 'date' ? 'date' : f.type === 'checkbox' ? 'checkbox' : f.type === 'email' ? 'email' : 'text') as any,
    }));
    const viewId = uid('v');
    const page = v.createPage({
      type: 'database',
      title: `${a.title || t('block.form')} — ${t('block.form.responses')}`,
      icon: '📋',
      db: {
        properties: [{ id: titleId, name: t('db.prop.submitted'), type: 'title' }, ...props],
        rows: a.responses.map((r) => ({
          id: uid('r'),
          cells: { [titleId]: formatDate(r.at, LOCALES[lang], { dateStyle: 'short', timeStyle: 'short' }), ...r.values },
          createdAt: r.at,
          updatedAt: r.at,
        })),
        views: [{ id: viewId, name: t('db.view.table'), type: 'table', filters: [] }],
        activeView: viewId,
      },
    });
    useUi.getState().go({ name: 'page', id: page.id });
  };

  const field = (f: FormField) => {
    const v = values[f.id];
    const on = (x: any) => setValues({ ...values, [f.id]: x });
    switch (f.type) {
      case 'textarea':
        return <textarea className="input" rows={3} value={v || ''} onChange={(e) => on(e.target.value)} />;
      case 'select':
        return (
          <select className="input" value={v || ''} onChange={(e) => on(e.target.value)}>
            <option value="">—</option>
            {(f.options || []).map((o) => <option key={o}>{o}</option>)}
          </select>
        );
      case 'checkbox':
        return <input type="checkbox" checked={!!v} onChange={(e) => on(e.target.checked)} />;
      case 'rating':
        return (
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={n <= (v || 0) ? 'on' : ''} onClick={() => on(n)}>★</button>
            ))}
          </div>
        );
      default:
        return <input className="input" type={f.type} value={v || ''} onChange={(e) => on(e.target.value)} />;
    }
  };

  return (
    <NodeViewWrapper className={'block-card form' + (selected ? ' is-selected' : '')} data-type="form">
      <div className="block-card-head" contentEditable={false}>
        <span className="block-badge"><FileSpreadsheet size={14} /> {t('block.form')}</span>
        <div className="grow" />
        <div className="seg sm">
          <button className={tab === 'fill' ? 'on' : ''} onClick={() => setTab('fill')}>{t('block.form.fill')}</button>
          {editor.isEditable && <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>{t('block.form.build')}</button>}
          <button className={tab === 'responses' ? 'on' : ''} onClick={() => setTab('responses')}>
            {t('block.form.responses')} ({a.responses?.length || 0})
          </button>
        </div>
      </div>
      <div contentEditable={false}>
        {tab === 'edit' && (
          <div className="stack">
            <input className="input lg" placeholder={t('block.form.title')} value={a.title} onChange={(e) => set({ title: e.target.value })} />
            <input className="input" placeholder={t('block.form.description')} value={a.description} onChange={(e) => set({ description: e.target.value })} />
            {a.fields.map((f) => (
              <div className="form-field-edit" key={f.id}>
                <input className="input" placeholder={t('block.form.question')} value={f.label} onChange={(e) => set({ fields: a.fields.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)) })} />
                <select className="input" value={f.type} onChange={(e) => set({ fields: a.fields.map((x) => (x.id === f.id ? { ...x, type: e.target.value } : x)) })}>
                  {types.map((ty) => <option key={ty} value={ty}>{t(`block.form.type.${ty}` as any)}</option>)}
                </select>
                <label className="check">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => set({ fields: a.fields.map((x) => (x.id === f.id ? { ...x, required: e.target.checked } : x)) })} /> *
                </label>
                <button className="icon-btn" onClick={() => set({ fields: a.fields.filter((x) => x.id !== f.id) })}><Trash2 size={15} /></button>
                {f.type === 'select' && (
                  <input
                    className="input full"
                    placeholder={t('block.form.options')}
                    value={(f.options || []).join(', ')}
                    onChange={(e) => set({ fields: a.fields.map((x) => (x.id === f.id ? { ...x, options: e.target.value.split(',').map((s) => s.trim()) } : x)) })}
                  />
                )}
              </div>
            ))}
            <div className="row">
              <button className="btn ghost" onClick={() => set({ fields: [...a.fields, { id: uid('f'), label: '', type: 'text' }] })}>
                <Plus size={15} /> {t('block.form.addField')}
              </button>
              <div className="grow" />
              <button className="btn primary" onClick={() => setTab('fill')}>{t('common.done')}</button>
            </div>
          </div>
        )}
        {tab === 'fill' && (
          <div className="stack">
            {a.title && <div className="poll-q">{a.title}</div>}
            {a.description && <div className="muted">{a.description}</div>}
            {a.fields.map((f) => (
              <label className="form-field" key={f.id}>
                <span>{f.label}{f.required && <b className="req"> *</b>}</span>
                {field(f)}
              </label>
            ))}
            {a.fields.length > 0 && (
              <div className="row">
                <button className="btn primary" onClick={submit}>{t('block.form.submit')}</button>
              </div>
            )}
          </div>
        )}
        {tab === 'responses' && (
          <div className="stack">
            {!a.responses?.length ? (
              <div className="muted">{t('block.form.noResponses')}</div>
            ) : (
              <div className="table-scroll">
                <table className="mini-table">
                  <thead>
                    <tr><th>#</th>{a.fields.map((f) => <th key={f.id}>{f.label}</th>)}<th /></tr>
                  </thead>
                  <tbody>
                    {a.responses.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        {a.fields.map((f) => <td key={f.id}>{typeof r.values[f.id] === 'boolean' ? (r.values[f.id] ? '✔' : '') : String(r.values[f.id] ?? '')}</td>)}
                        <td>
                          {editor.isEditable && (
                            <button className="icon-btn sm" onClick={() => set({ responses: a.responses.filter((x) => x.id !== r.id) })}><X size={13} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="row">
              <button className="btn ghost" onClick={csv} disabled={!a.responses?.length}><Download size={15} /> CSV</button>
              <button className="btn ghost" onClick={toDatabase} disabled={!a.responses?.length}><FileSpreadsheet size={15} /> {t('block.form.toDb')}</button>
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ----------------------------------------------------------------- gallery

export function GalleryView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const t = useT();
  const a = node.attrs as { images: { src: string; caption?: string }[]; columns: number };
  const [view, setView] = useState<number | null>(null);
  const add = async () => {
    const imgs = await pickImages(true);
    if (imgs.length) updateAttributes({ images: [...a.images, ...imgs.map((src) => ({ src, caption: '' }))] });
  };
  const ref = useRef<HTMLDivElement>(null);
  return (
    <NodeViewWrapper className={'block-card gallery' + (selected ? ' is-selected' : '')} data-type="gallery">
      <div className="block-card-head" contentEditable={false}>
        <span className="block-badge"><ImagePlus size={14} /> {t('block.gallery')}</span>
        <div className="grow" />
        {editor.isEditable && (
          <>
            <div className="seg sm">
              {[2, 3, 4].map((c) => (
                <button key={c} className={a.columns === c ? 'on' : ''} onClick={() => updateAttributes({ columns: c })}>{c}</button>
              ))}
            </div>
            <button className="btn ghost sm" onClick={add}><Plus size={14} /> {t('block.gallery.add')}</button>
          </>
        )}
      </div>
      <div ref={ref} className="gallery-grid" contentEditable={false} style={{ gridTemplateColumns: `repeat(${a.columns || 3}, 1fr)` }}>
        {a.images.map((img, i) => (
          <figure key={i} className="gallery-item">
            <img src={img.src} alt={img.caption || ''} onClick={() => setView(i)} />
            {editor.isEditable ? (
              <input
                className="gallery-caption"
                placeholder={t('block.gallery.caption')}
                value={img.caption || ''}
                onChange={(e) => updateAttributes({ images: a.images.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })}
              />
            ) : (
              img.caption && <figcaption>{img.caption}</figcaption>
            )}
            {editor.isEditable && (
              <button className="gallery-del" onClick={() => updateAttributes({ images: a.images.filter((_, j) => j !== i) })}><X size={13} /></button>
            )}
          </figure>
        ))}
        {!a.images.length && (
          <button className="gallery-empty" onClick={add}>
            <ImagePlus size={28} />
            <span>{t('block.gallery.empty')}</span>
          </button>
        )}
      </div>
      {view !== null && a.images[view] && (
        <div className="lightbox" contentEditable={false} onClick={() => setView(null)}>
          <img src={a.images[view].src} alt="" />
          {a.images[view].caption && <div className="lightbox-cap">{a.images[view].caption}</div>}
        </div>
      )}
    </NodeViewWrapper>
  );
}
