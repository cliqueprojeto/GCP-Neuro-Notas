import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell as RCell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, Radar,
  RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList,
} from 'recharts';
import {
  AreaChart as AreaIcon, BarChart3, BarChartHorizontal, Copy, Database, Gauge, LineChart as LineIcon, Palette, PieChart as PieIcon, Plus, Radar as RadarIcon,
  Settings2, Table2, Trash2, Layers, Donut,
} from 'lucide-react';
import type { ChartType, Page, ReportData, Widget } from '../lib/types';
import { useT, useLang, LOCALES, type TKey } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { usePrefs } from '../store/prefs';
import { useUi } from '../store/ui';
import { CHART_PALETTES, getTheme } from '../lib/themes';
import { Empty, Modal, Select, Switch } from '../components/ui';
import { FilterEditor } from '../database/DatabaseView';
import { computeWidget } from './aggregate';
import { uid } from '../lib/crypto';
import { titleProp } from '../database/logic';

const TYPE_ICONS: Record<ChartType, any> = {
  bar: BarChart3, hbar: BarChartHorizontal, stacked: Layers, line: LineIcon, area: AreaIcon, pie: PieIcon, donut: Donut, kpi: Gauge, table: Table2, radar: RadarIcon,
};

export function usePalette(report: ReportData | undefined, w?: Widget): string[] {
  const theme = usePrefs((s) => s.theme);
  const dark = getTheme(theme).dark;
  const custom = useVault((s) => s.settings.chartPalettes);
  const id = w?.palette || report?.palette || 'gcp';
  if (w?.colors?.length) return w.colors;
  const c = custom.find((p) => p.id === id);
  if (c) return c.colors;
  const p = CHART_PALETTES.find((x) => x.id === id) || CHART_PALETTES[0];
  return dark ? p.dark : p.light;
}

export function ReportView({ page }: { page: Page }) {
  const t = useT();
  const update = useVault((s) => s.updatePage);
  const pages = useVault((s) => s.pages);
  const report = page.report!;
  const [editing, setEditing] = useState<Widget | null>(null);
  const sources = livePages(pages).filter((p) => p.type === 'database');
  const save = (r: ReportData) => update(page.id, { report: r });

  const newWidget = (): Widget => {
    const src = sources[0];
    const group = src?.db?.properties.find((p) => ['select', 'status', 'multi', 'date'].includes(p.type)) || src?.db?.properties[0];
    return { id: uid('w'), title: '', type: 'bar', source: src?.id || '', groupBy: group?.id || '', measure: 'count', agg: 'count', filters: [], sort: 'value-desc', span: 1, showLegend: true, showLabels: false, dateBucket: 'month' };
  };

  return (
    <div className="report">
      <div className="report-bar">
        <Palette size={16} className="muted" />
        <Select
          value={report.palette}
          options={[...CHART_PALETTES.map((p) => ({ value: p.id, label: p.name, icon: <Swatches colors={p.light} /> })), ...useVault.getState().settings.chartPalettes.map((p) => ({ value: p.id, label: p.name, icon: <Swatches colors={p.colors} /> }))]}
          onChange={(palette) => save({ ...report, palette })}
          className="sm"
        />
        <div className="grow" />
        <button className="btn primary sm" onClick={() => setEditing(newWidget())} disabled={!sources.length}><Plus size={15} /> {t('report.addChart')}</button>
      </div>
      {!sources.length ? (
        <Empty
          icon={<Database size={30} />}
          title={t('report.noSources')}
          text={t('report.noSources.text')}
          action={
            <button className="btn primary" onClick={() => {
              const np = useVault.getState().createPage({ type: 'database', title: t('page.newDatabase'), parentId: page.id });
              useUi.getState().go({ name: 'page', id: np.id });
            }}><Plus size={15} /> {t('page.newDatabase')}</button>
          }
        />
      ) : !report.widgets.length ? (
        <Empty icon={<BarChart3 size={30} />} title={t('report.empty')} text={t('report.empty.text')} action={<button className="btn primary" onClick={() => setEditing(newWidget())}><Plus size={15} /> {t('report.addChart')}</button>} />
      ) : (
        <div className="widgets">
          {report.widgets.map((w) => (
            <WidgetCard
              key={w.id}
              w={w}
              report={report}
              onEdit={() => setEditing(w)}
              onDelete={() => save({ ...report, widgets: report.widgets.filter((x) => x.id !== w.id) })}
              onDuplicate={() => save({ ...report, widgets: [...report.widgets, { ...w, id: uid('w'), title: w.title + ' 2' }] })}
            />
          ))}
        </div>
      )}
      {editing && (
        <WidgetEditor
          w={editing}
          report={report}
          sources={sources}
          onClose={() => setEditing(null)}
          onSave={(w) => {
            const exists = report.widgets.some((x) => x.id === w.id);
            save({ ...report, widgets: exists ? report.widgets.map((x) => (x.id === w.id ? w : x)) : [...report.widgets, w] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="swatches">
      {colors.slice(0, 5).map((c) => <i key={c} style={{ background: c }} />)}
    </span>
  );
}

function WidgetCard({ w, report, onEdit, onDelete, onDuplicate }: { w: Widget; report: ReportData; onEdit: () => void; onDelete: () => void; onDuplicate: () => void }) {
  const t = useT();
  const pages = useVault((s) => s.pages);
  const src = pages[w.source];
  const title = w.title || defaultTitle(w, src, t);
  return (
    <div className={`widget span-${w.span}`}>
      <div className="widget-head">
        <div>
          <h4>{title}</h4>
          <small className="muted">{src?.title || '—'}</small>
        </div>
        <div className="widget-actions">
          <button className="icon-btn sm" onClick={onEdit} title={t('common.edit')}><Settings2 size={15} /></button>
          <button className="icon-btn sm" onClick={onDuplicate} title={t('common.duplicate')}><Copy size={15} /></button>
          <button className="icon-btn sm" onClick={onDelete} title={t('common.delete')}><Trash2 size={15} /></button>
        </div>
      </div>
      <Chart w={w} report={report} />
    </div>
  );
}

function defaultTitle(w: Widget, src: Page | undefined, t: (k: TKey, v?: any) => string) {
  const db = src?.db;
  const g = db?.properties.find((p) => p.id === w.groupBy)?.name || '';
  const m = w.agg === 'count' ? t('report.agg.count') : `${t(`report.agg.${w.agg}` as TKey)} ${db?.properties.find((p) => p.id === w.measure)?.name || ''}`;
  return g ? `${m} × ${g}` : m;
}

export function Chart({ w, report, height = 260 }: { w: Widget; report: ReportData; height?: number }) {
  const t = useT();
  const lang = useLang();
  const pages = useVault((s) => s.pages);
  const colors = usePalette(report, w);
  const { data, seriesKeys, total } = useMemo(() => computeWidget(w, pages, t('report.empty.value')), [w, pages, t]);
  const fmt = (v: number) => new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 2 }).format(v);
  const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
  const tip = {
    contentStyle: { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', boxShadow: 'var(--shadow)' },
    labelStyle: { color: 'var(--text)', fontWeight: 600 },
    itemStyle: { color: 'var(--text)' },
    cursor: { fill: 'var(--hover)' },
    formatter: (v: any) => fmt(Number(v)),
  };
  if (!data.length) return <div className="chart-empty muted">{t('report.noData')}</div>;

  if (w.type === 'kpi') {
    return (
      <div className="kpi">
        <div className="kpi-value">{fmt(total)}</div>
        <div className="kpi-label muted">{w.agg === 'count' ? t('report.records') : t(`report.agg.${w.agg}` as TKey)}</div>
        <div className="kpi-bars">
          {data.slice(0, 6).map((d) => (
            <div key={d.key} className="kpi-row">
              <span className="kpi-dot" style={{ background: colors[(d.color ?? 0) % colors.length] }} />
              <span className="grow ellipsis">{d.label}</span>
              <b>{fmt(d.value)}</b>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (w.type === 'table') {
    return (
      <div className="table-scroll" style={{ maxHeight: height }}>
        <table className="mini-table">
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <td><span className="kpi-dot" style={{ background: colors[(d.color ?? 0) % colors.length] }} /> {d.label}</td>
                <td className="num">{fmt(d.value)}</td>
                <td className="num muted">{total ? Math.round((d.value / data.reduce((s, x) => s + x.value, 0)) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const flat = data.map((d) => ({ name: d.label, value: d.value, ...(d.series || {}) }));
  const legend = w.showLegend !== false ? <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} iconType="circle" iconSize={8} /> : null;
  const labels = w.showLabels ? <LabelList dataKey="value" position="top" formatter={(v: any) => fmt(Number(v))} style={{ fill: 'var(--muted)', fontSize: 11 }} /> : null;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        {w.type === 'pie' || w.type === 'donut' ? (
          <PieChart>
            <Tooltip {...tip} />
            {legend}
            <Pie data={flat} dataKey="value" nameKey="name" innerRadius={w.type === 'donut' ? '58%' : 0} outerRadius="82%" paddingAngle={w.type === 'donut' ? 2 : 0} stroke="var(--panel)" strokeWidth={2} label={w.showLabels ? (e: any) => fmt(e.value) : false}>
              {data.map((d, i) => <RCell key={i} fill={colors[(d.color ?? i) % colors.length]} />)}
            </Pie>
          </PieChart>
        ) : w.type === 'line' ? (
          <LineChart data={flat} margin={{ top: 16, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} tickFormatter={fmt} />
            <Tooltip {...tip} cursor={{ stroke: 'var(--muted)', strokeDasharray: '4 4' }} />
            {seriesKeys.length ? (
              <>
                {legend}
                {seriesKeys.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colors[s.color % colors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />)}
              </>
            ) : (
              <Line type="monotone" dataKey="value" name={t('report.value')} stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}>{labels}</Line>
            )}
          </LineChart>
        ) : w.type === 'area' ? (
          <AreaChart data={flat} margin={{ top: 16, right: 12, left: -8, bottom: 0 }}>
            <defs>
              {colors.map((c, i) => (
                <linearGradient key={i} id={`ag-${w.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={c} stopOpacity={0.45} />
                  <stop offset="1" stopColor={c} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} tickFormatter={fmt} />
            <Tooltip {...tip} cursor={{ stroke: 'var(--muted)', strokeDasharray: '4 4' }} />
            {seriesKeys.length ? (
              <>
                {legend}
                {seriesKeys.map((s) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="a" stroke={colors[s.color % colors.length]} fill={`url(#ag-${w.id}-${s.color % colors.length})`} strokeWidth={2} />)}
              </>
            ) : (
              <Area type="monotone" dataKey="value" name={t('report.value')} stroke={colors[0]} fill={`url(#ag-${w.id}-0)`} strokeWidth={2} />
            )}
          </AreaChart>
        ) : w.type === 'radar' ? (
          <RadarChart data={flat} outerRadius="75%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <Tooltip {...tip} />
            <Radar dataKey="value" name={t('report.value')} stroke={colors[0]} fill={colors[0]} fillOpacity={0.35} />
          </RadarChart>
        ) : (
          <BarChart data={flat} layout={w.type === 'hbar' ? 'vertical' : 'horizontal'} margin={{ top: 18, right: 16, left: w.type === 'hbar' ? 8 : -8, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={w.type === 'hbar'} horizontal={w.type !== 'hbar'} />
            {w.type === 'hbar' ? (
              <>
                <XAxis type="number" {...axis} tickFormatter={fmt} />
                <YAxis type="category" dataKey="name" {...axis} width={110} />
              </>
            ) : (
              <>
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} tickFormatter={fmt} />
              </>
            )}
            <Tooltip {...tip} />
            {(w.type === 'stacked' || seriesKeys.length) && seriesKeys.length ? (
              <>
                {legend}
                {seriesKeys.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} stackId={w.type === 'stacked' ? 'a' : undefined} fill={colors[s.color % colors.length]} radius={w.type === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]} stroke="var(--panel)" strokeWidth={w.type === 'stacked' ? 1 : 0} />
                ))}
              </>
            ) : (
              <Bar dataKey="value" name={t('report.value')} radius={w.type === 'hbar' ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                {data.map((d, i) => <RCell key={i} fill={colors[(d.color ?? i) % colors.length]} />)}
                {labels}
              </Bar>
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function WidgetEditor({ w: initial, report, sources, onClose, onSave }: { w: Widget; report: ReportData; sources: Page[]; onClose: () => void; onSave: (w: Widget) => void }) {
  const t = useT();
  const [w, setW] = useState<Widget>(initial);
  const set = (p: Partial<Widget>) => setW({ ...w, ...p });
  const db = sources.find((s) => s.id === w.source)?.db;
  const props = db?.properties || [];
  const numeric = props.filter((p) => ['number', 'rating', 'progress'].includes(p.type));
  const groupable = props.filter((p) => !['password'].includes(p.type));
  const palette = usePalette(report, { ...w, colors: undefined });
  const colors = w.colors?.length ? w.colors : palette;
  const isDate = ['date', 'created'].includes(props.find((p) => p.id === w.groupBy)?.type || '');

  return (
    <Modal
      open
      onClose={onClose}
      title={t('report.configure')}
      width={980}
      className="widget-editor"
      footer={
        <>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" onClick={() => onSave(w)}>{t('common.save')}</button>
        </>
      }
    >
      <div className="we-grid">
        <div className="stack">
          <div className="chart-types">
            {(Object.keys(TYPE_ICONS) as ChartType[]).map((ty) => {
              const Icon = TYPE_ICONS[ty];
              return (
                <button key={ty} className={w.type === ty ? 'on' : ''} onClick={() => set({ type: ty })}>
                  <Icon size={20} />
                  <span>{t(`report.type.${ty}` as TKey)}</span>
                </button>
              );
            })}
          </div>
          <label className="field"><span className="field-label">{t('report.title')}</span><input className="input" value={w.title} placeholder={t('report.autoTitle')} onChange={(e) => set({ title: e.target.value })} /></label>
          <div className="two">
            <label className="field">
              <span className="field-label">{t('report.source')}</span>
              <Select value={w.source} options={sources.map((s) => ({ value: s.id, label: s.title || t('page.untitled') }))} onChange={(source) => {
                const d = sources.find((s) => s.id === source)?.db;
                set({ source, groupBy: d ? titleProp(d).id : '', measure: 'count', agg: 'count', filters: [], seriesBy: undefined });
              }} />
            </label>
            <label className="field">
              <span className="field-label">{t('report.groupBy')}</span>
              <Select value={w.groupBy} options={groupable.map((p) => ({ value: p.id, label: p.name }))} onChange={(groupBy) => set({ groupBy })} />
            </label>
            <label className="field">
              <span className="field-label">{t('report.measure')}</span>
              <Select
                value={w.agg === 'count' ? 'count' : w.measure}
                options={[{ value: 'count', label: t('report.agg.count') }, ...numeric.map((p) => ({ value: p.id, label: p.name }))]}
                onChange={(m) => set(m === 'count' ? { measure: 'count', agg: 'count' } : { measure: m, agg: w.agg === 'count' ? 'sum' : w.agg })}
              />
            </label>
            {w.agg !== 'count' && (
              <label className="field">
                <span className="field-label">{t('report.aggregation')}</span>
                <Select value={w.agg} options={(['sum', 'avg', 'min', 'max'] as const).map((a) => ({ value: a, label: t(`report.agg.${a}` as TKey) }))} onChange={(agg) => set({ agg })} />
              </label>
            )}
            {['bar', 'stacked', 'line', 'area'].includes(w.type) && (
              <label className="field">
                <span className="field-label">{t('report.seriesBy')}</span>
                <Select value={w.seriesBy || ''} options={[{ value: '', label: '—' }, ...groupable.filter((p) => p.id !== w.groupBy).map((p) => ({ value: p.id, label: p.name }))]} onChange={(s) => set({ seriesBy: s || undefined })} />
              </label>
            )}
            {isDate && (
              <label className="field">
                <span className="field-label">{t('report.bucket')}</span>
                <Select value={w.dateBucket || 'month'} options={(['day', 'week', 'month', 'year'] as const).map((b) => ({ value: b, label: t(`report.bucket.${b}` as TKey) }))} onChange={(dateBucket) => set({ dateBucket })} />
              </label>
            )}
            <label className="field">
              <span className="field-label">{t('report.sort')}</span>
              <Select value={w.sort} options={[{ value: 'value-desc', label: t('report.sort.desc') }, { value: 'value-asc', label: t('report.sort.asc') }, { value: 'label', label: t('report.sort.label') }]} onChange={(sort) => set({ sort: sort as Widget['sort'] })} />
            </label>
            <label className="field">
              <span className="field-label">{t('report.size')}</span>
              <div className="seg">
                {[1, 2, 3].map((s) => <button key={s} className={w.span === s ? 'on' : ''} onClick={() => set({ span: s as 1 | 2 | 3 })}>{s === 1 ? '⅓' : s === 2 ? '⅔' : '1/1'}</button>)}
              </div>
            </label>
            <label className="field">
              <span className="field-label">{t('report.limit')}</span>
              <input className="input" type="number" min={0} value={w.limit || ''} placeholder="∞" onChange={(e) => set({ limit: +e.target.value || undefined })} />
            </label>
          </div>
          <div className="row">
            <Switch checked={w.showLegend !== false} onChange={(v) => set({ showLegend: v })} label={t('report.legend')} />
            <Switch checked={!!w.showLabels} onChange={(v) => set({ showLabels: v })} label={t('report.labels')} />
          </div>
          <div className="field">
            <span className="field-label">{t('report.colors')}</span>
            <div className="row wrap">
              <Select value={w.palette || ''} options={[{ value: '', label: t('report.paletteReport') }, ...CHART_PALETTES.map((p) => ({ value: p.id, label: p.name, icon: <Swatches colors={p.light} /> }))]} onChange={(palette) => set({ palette: palette || undefined, colors: undefined })} className="sm" />
              {colors.slice(0, 8).map((c, i) => (
                <input key={i} type="color" className="color-input" value={c} onChange={(e) => set({ colors: colors.map((x, j) => (j === i ? e.target.value : x)) })} />
              ))}
              {w.colors?.length ? <button className="btn ghost sm" onClick={() => set({ colors: undefined })}>{t('common.reset')}</button> : null}
            </div>
          </div>
          {db && (
            <div className="field">
              <span className="field-label">{t('db.filter')}</span>
              <FilterEditor db={db} filters={w.filters} onChange={(filters) => set({ filters })} />
            </div>
          )}
        </div>
        <div className="we-preview">
          <div className="muted small">{t('report.preview')}</div>
          <div className="widget span-1">
            <div className="widget-head"><h4>{w.title || defaultTitle(w, sources.find((s) => s.id === w.source), t)}</h4></div>
            <Chart w={w} report={report} height={300} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
