import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Page, UserTemplate } from '../lib/types';
import { useT } from '../i18n';
import { useVault } from '../store/vault';
import { toast } from '../store/ui';
import { Modal, PageIcon, Popover, Switch } from '../components/ui';
import { IconPicker } from '../components/IconPicker';
import { uid } from '../lib/crypto';
import { useRef } from 'react';

export const TEMPLATE_COLORS = ['#7c3aed', '#4f46e5', '#2563eb', '#0891b2', '#0d9488', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#475569'];

const deep = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** Estrutura reaproveitável de uma página (sem ids, datas e hierarquia). */
function snapshot(page: Page, withRows: boolean): Partial<Page> {
  const { id, parentId, order, createdAt, updatedAt, deletedAt, purged, favorite, journalDate, ...rest } = deep(page) as Page;
  void id; void parentId; void order; void createdAt; void updatedAt; void deletedAt; void purged; void favorite; void journalDate;
  if (rest.db && !withRows) rest.db = { ...rest.db, rows: [] };
  return rest;
}

export function saveUserTemplate(page: Page, meta: { name: string; description: string; icon: string; color: string; withRows: boolean }): UserTemplate {
  const tpl: UserTemplate = {
    id: uid('ut'),
    kind: page.type,
    name: meta.name.trim(),
    description: meta.description.trim(),
    icon: meta.icon,
    color: meta.color,
    withRows: meta.withRows,
    page: snapshot(page, meta.withRows),
    createdAt: Date.now(),
  };
  useVault.getState().updateSettings((s) => ({ ...s, templates: [...(s.templates || []), tpl] }));
  return tpl;
}

export function deleteUserTemplate(id: string) {
  useVault.getState().updateSettings((s) => ({ ...s, templates: (s.templates || []).filter((x) => x.id !== id) }));
}

/** Cria uma página nova a partir de um modelo do usuário. Ids internos são renovados. */
export function instantiateUser(tpl: UserTemplate, parentId: string | null, title?: string): Page {
  const base = deep(tpl.page);
  if (base.db) {
    const idMap: Record<string, string> = {};
    base.db.properties = base.db.properties.map((p) => {
      const nid = uid('c');
      idMap[p.id] = nid;
      return { ...p, id: nid };
    });
    const remap = (k: string) => idMap[k] || k;
    base.db.properties = base.db.properties.map((p) => ({ ...p, rules: p.rules?.map((r) => ({ ...r, id: uid('k'), prop: remap(r.prop) })) }));
    base.db.rows = (base.db.rows || []).map((r) => ({ ...r, id: uid('r'), createdAt: Date.now(), updatedAt: Date.now(), cells: Object.fromEntries(Object.entries(r.cells).map(([k, v]) => [remap(k), v])) }));
    const views = base.db.views.map((v) => ({
      ...v,
      id: uid('v'),
      groupBy: v.groupBy && remap(v.groupBy),
      dateProp: v.dateProp && remap(v.dateProp),
      sort: v.sort ? { ...v.sort, prop: remap(v.sort.prop) } : v.sort,
      filters: v.filters.map((f) => ({ ...f, id: uid('f'), prop: remap(f.prop) })),
      hidden: v.hidden?.map(remap),
    }));
    const activeIdx = base.db.views.findIndex((v) => v.id === base.db!.activeView);
    base.db.views = views;
    base.db.activeView = views[Math.max(0, activeIdx)]?.id || views[0]?.id;
  }
  if (base.canvas) {
    const map: Record<string, string> = {};
    base.canvas.nodes = base.canvas.nodes.map((n) => ((map[n.id] = uid('n')), { ...n, id: map[n.id] }));
    base.canvas.edges = base.canvas.edges.map((e) => ({ ...e, id: uid('e'), from: map[e.from] || e.from, to: map[e.to] || e.to }));
  }
  return useVault.getState().createPage({ ...base, title: title ?? base.title ?? tpl.name, parentId });
}

/** Janela "Salvar como modelo": nome, descrição, ícone e cor. */
export function SaveTemplateModal({ page, open, onClose }: { page: Page; open: boolean; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(page.title || '');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TEMPLATE_COLORS[0]);
  const [icon, setIcon] = useState(page.type === 'database' ? 'lucide:Table2:#ffffff' : page.type === 'canvas' ? 'lucide:PenTool:#ffffff' : 'lucide:FileText:#ffffff');
  const [withRows, setWithRows] = useState(false);
  const [pick, setPick] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const save = () => {
    if (!name.trim()) return;
    saveUserTemplate(page, { name, description, icon, color, withRows });
    toast(t('utpl.saved'), 'success');
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title={page.type === 'database' ? t('utpl.titleDb') : t('utpl.titlePage')}
      footer={
        <>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={!name.trim()} onClick={save}>{t('utpl.save')}</button>
        </>
      }
    >
      <p className="muted small">{page.type === 'database' ? t('utpl.introDb') : t('utpl.introPage')}</p>
      <label className="field-label">{t('utpl.name')}</label>
      <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      <label className="field-label">{t('utpl.description')}</label>
      <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="utpl-style">
        <button ref={ref} className="utpl-iconbtn" onClick={() => setPick(!pick)}>
          <span className="utpl-badge" style={{ background: color }}><PageIcon icon={icon} size={18} /></span>
          {t('utpl.iconColor')}
        </button>
        <div className="color-row">
          {TEMPLATE_COLORS.map((c) => (
            <button key={c} className={'color-dot' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)}>
              {c === color && <Check size={12} color="#fff" />}
            </button>
          ))}
        </div>
      </div>
      <Popover anchor={ref.current} open={pick} onClose={() => setPick(false)}>
        <div style={{ width: 340 }}>
          <IconPicker onSelect={(i) => (setIcon(i.startsWith('lucide:') ? i.replace(/:[^:]+$/, ':#ffffff') : i), setPick(false))} />
        </div>
      </Popover>
      {page.type === 'database' && <Switch checked={withRows} onChange={setWithRows} label={t('utpl.withRows')} />}
    </Modal>
  );
}

export function UserTemplateBadge({ tpl, size = 18 }: { tpl: UserTemplate; size?: number }) {
  return (
    <span className="utpl-badge" style={{ background: tpl.color, width: size + 16, height: size + 16 }}>
      <PageIcon icon={tpl.icon} size={size} />
    </span>
  );
}
