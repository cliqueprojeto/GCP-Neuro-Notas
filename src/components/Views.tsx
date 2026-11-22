import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckSquare, ChevronRight, Copy, CreditCard, ExternalLink, Heart, Info, LayoutTemplate, ListTodo, RotateCcw, Scale, Sparkles, Trash2, Code2, GitBranch,
} from 'lucide-react';
import { useT, useLang, LOCALES, type TKey } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi, toast } from '../store/ui';
import { PageIcon, Empty } from './ui';
import { TEMPLATES, CATEGORY_ICONS, instantiate, type TemplateCategory } from '../templates/templates';
import { instantiateUser, deleteUserTemplate, UserTemplateBadge } from '../templates/user';
import { APP_VERSION, copyText, openUrl } from '../lib/platform';
import { formatDate, relativeTime, todayKey } from '../lib/doc';
import { coverCss } from '../lib/themes';
import { AUTHOR_URL } from './Sidebar';
import { RELEASES_URL, REPO } from '../lib/updater';
import type { Page } from '../lib/types';

// Valores estáveis: um [] ou {} novo a cada leitura faria a tela redesenhar sem parar.
const NO_TEMPLATES: never[] = [];

// --------------------------------------------------------------- templates

export function Templates() {
  const t = useT();
  const lang = useLang();
  const [cat, setCat] = useState<TemplateCategory | 'all'>('all');
  const create = useVault((s) => s.createPage);
  const go = useUi((s) => s.go);
  const cats = Object.keys(CATEGORY_ICONS) as TemplateCategory[];
  const list = TEMPLATES.filter((x) => cat === 'all' || x.category === cat);
  const mine = useVault((s) => s.settings.templates) ?? NO_TEMPLATES;
  return (
    <div className="page-shell">
      <div className="page-hero compact">
        <div className="eyebrow"><LayoutTemplate size={13} /> {t('nav.templates')}</div>
        <h1>{t('tpl.title')}</h1>
        <p className="muted">{t('tpl.subtitle', { n: TEMPLATES.length })}</p>
      </div>
      <div className="chips">
        <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>✨ {t('tpl.all')}</button>
        {mine.length > 0 && <button className={'chip' + (cat === ('mine' as any) ? ' on' : '')} onClick={() => setCat('mine' as any)}>⭐ {t('utpl.mine')} ({mine.length})</button>}
        {cats.map((c) => (
          <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{CATEGORY_ICONS[c]} {t(`tpl.cat.${c}` as TKey)}</button>
        ))}
      </div>
      {(cat === 'all' || cat === ('mine' as any)) && (
        <>
          <h3 className="tpl-section-title">⭐ {t('utpl.mine')}</h3>
          {!mine.length && <p className="muted small">{t('utpl.empty')}</p>}
          <div className="tpl-grid">
            {mine.map((tpl) => (
              <div
                key={tpl.id}
                role="button"
                tabIndex={0}
                className="tpl-card user"
                onClick={() => {
                  const root = instantiateUser(tpl, null);
                  toast(t('tpl.created'), 'success');
                  go({ name: 'page', id: root.id });
                }}
              >
                <div className="tpl-cover" style={{ background: `linear-gradient(135deg, ${tpl.color}, color-mix(in srgb, ${tpl.color} 55%, #000))` }}>
                  <UserTemplateBadge tpl={tpl} size={26} />
                </div>
                <button className="tpl-del" title={t('common.delete')} onClick={(e) => (e.stopPropagation(), confirm(t('utpl.confirmDelete')) && deleteUserTemplate(tpl.id))}><Trash2 size={14} /></button>
                <div className="tpl-body">
                  <b>{tpl.name}</b>
                  <small className="muted">{tpl.description || t(`new.${tpl.kind === 'page' ? 'page' : tpl.kind}` as TKey)}</small>
                  <span className="tpl-cat">{t(`new.${tpl.kind === 'page' ? 'page' : tpl.kind}` as TKey)}</span>
                </div>
              </div>
            ))}
          </div>
          {cat === 'all' && <h3 className="tpl-section-title">✨ {t('tpl.title')}</h3>}
        </>
      )}
      <div className="tpl-grid">
        {cat !== ('mine' as any) && list.map((tpl) => (
          <button
            key={tpl.id}
            className="tpl-card"
            onClick={() => {
              const root = instantiate(tpl, lang, null, create);
              toast(t('tpl.created'), 'success');
              go({ name: 'page', id: root.id });
            }}
          >
            <div className="tpl-cover" style={{ background: coverCss(tpl.cover || 'g:0') }}>
              <span className="tpl-icon">{tpl.icon}</span>
            </div>
            <div className="tpl-body">
              <b>{tpl.title[lang]}</b>
              <small className="muted">{tpl.description[lang]}</small>
              <span className="tpl-cat">{CATEGORY_ICONS[tpl.category]} {t(`tpl.cat.${tpl.category}` as TKey)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ lixeira

export function Trash() {
  const t = useT();
  const lang = useLang();
  const pages = useVault((s) => s.pages);
  const v = useVault.getState();
  const list = Object.values(pages).filter((p) => p.deletedAt && !p.purged && !(p.parentId && pages[p.parentId]?.deletedAt && !pages[p.parentId]?.purged)).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  return (
    <div className="page-shell">
      <div className="page-hero compact">
        <div className="eyebrow"><Trash2 size={13} /> {t('nav.trash')}</div>
        <h1>{t('trash.title')}</h1>
        <p className="muted">{t('trash.subtitle')}</p>
      </div>
      {!list.length ? (
        <Empty icon={<Trash2 size={30} />} title={t('trash.empty')} />
      ) : (
        <div className="panel">
          <div className="row"><div className="grow" /><button className="btn ghost danger sm" onClick={() => window.confirm(t('trash.emptyConfirm')) && v.emptyTrash()}><Trash2 size={14} /> {t('trash.emptyAll')}</button></div>
          {list.map((p) => (
            <div key={p.id} className="trash-row">
              <PageIcon icon={p.icon} size={18} />
              <span className="grow ellipsis">{p.title || t('page.untitled')}</span>
              <small className="muted">{relativeTime(p.deletedAt!, LOCALES[lang])}</small>
              <button className="btn ghost sm" onClick={() => v.restorePage(p.id)}><RotateCcw size={14} /> {t('trash.restore')}</button>
              <button className="icon-btn sm" onClick={() => window.confirm(t('trash.purgeConfirm')) && v.purgePage(p.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ tarefas

interface TaskRef { page: Page; text: string; checked: boolean; path: number[]; due?: string; source: 'doc' | 'db'; rowId?: string; propId?: string }

function collectTasks(pages: Page[]): TaskRef[] {
  const out: TaskRef[] = [];
  for (const p of pages) {
    if (p.type === 'page' && p.content) {
      const walk = (n: any, path: number[]) => {
        if (n.type === 'taskItem') {
          const txt = (n.content?.[0]?.content || []).map((c: any) => c.text || c.attrs?.label || '').join('');
          out.push({ page: p, text: txt, checked: !!n.attrs?.checked, path, source: 'doc' });
        }
        n.content?.forEach((c: any, i: number) => walk(c, [...path, i]));
      };
      walk(p.content, []);
    }
    if (p.type === 'database' && p.db) {
      const status = p.db.properties.find((x) => x.type === 'status');
      const check = p.db.properties.find((x) => x.type === 'checkbox');
      const date = p.db.properties.find((x) => x.type === 'date');
      const title = p.db.properties.find((x) => x.type === 'title');
      if (!status && !check) continue;
      for (const r of p.db.rows) {
        const done = status ? status.options?.findIndex((o) => o.id === r.cells[status.id]) === (status.options?.length || 0) - 1 : !!r.cells[check!.id];
        out.push({ page: p, text: r.cells[title?.id || ''] || '—', checked: done, path: [], due: date ? r.cells[date.id] : undefined, source: 'db', rowId: r.id, propId: status?.id || check?.id });
      }
    }
  }
  return out;
}

export function Tasks() {
  const t = useT();
  const lang = useLang();
  const pages = useVault((s) => s.pages);
  const go = useUi((s) => s.go);
  const [showDone, setShowDone] = useState(false);
  const tasks = useMemo(() => collectTasks(livePages(pages)), [pages]);
  const open = tasks.filter((x) => showDone || !x.checked).filter((x) => x.text.trim());
  const today = todayKey();
  const toggleDoc = (tk: TaskRef) => {
    const doc = structuredClone(tk.page.content);
    let n = doc;
    for (const i of tk.path) n = n.content[i];
    n.attrs = { ...n.attrs, checked: !n.attrs?.checked };
    useVault.getState().updatePage(tk.page.id, { content: doc });
  };
  const groups: [string, TaskRef[]][] = [
    [t('tasks.overdue'), open.filter((x) => x.due && x.due < today && !x.checked)],
    [t('tasks.today'), open.filter((x) => x.due === today)],
    [t('tasks.upcoming'), open.filter((x) => x.due && x.due > today)],
    [t('tasks.noDate'), open.filter((x) => !x.due)],
  ];
  return (
    <div className="page-shell">
      <div className="page-hero compact">
        <div className="eyebrow"><ListTodo size={13} /> {t('nav.tasks')}</div>
        <h1>{t('tasks.title')}</h1>
        <p className="muted">{t('tasks.subtitle', { n: tasks.filter((x) => !x.checked).length })}</p>
      </div>
      <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> {t('tasks.showDone')}</label>
      {!tasks.length && <Empty icon={<CheckSquare size={30} />} title={t('tasks.empty')} text={t('tasks.emptyText')} />}
      {groups.map(([label, list]) => list.length > 0 && (
        <section key={label} className="panel">
          <div className="panel-head"><h3>{label}</h3><span className="badge">{list.length}</span></div>
          {list.map((tk, i) => (
            <div key={i} className={'task-row' + (tk.checked ? ' done' : '')}>
              {tk.source === 'doc' ? (
                <button className={'cell-check' + (tk.checked ? ' on' : '')} onClick={() => toggleDoc(tk)}>{tk.checked && '✓'}</button>
              ) : (
                <span className="pill c-blue">DB</span>
              )}
              <span className="grow">{tk.text}</span>
              {tk.due && <small className={tk.due < today && !tk.checked ? 'error-text' : 'muted'}>{formatDate(tk.due, LOCALES[lang])}</small>}
              <button className="link-btn small" onClick={() => go({ name: 'page', id: tk.page.id })}><PageIcon icon={tk.page.icon} size={13} /> {tk.page.title || t('page.untitled')} <ChevronRight size={12} /></button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------- apoie

export const PIX_CODE =
  '00020126850014br.gov.bcb.pix0136e474b71b-7491-4eac-992f-632652e5a4eb0223DEV GESTAO CULTURAL PRO5204000053039865802BR5915BRUNO ALBERTINI6006BRASIL62200516ChromeExtensions63042B27';
export const STRIPE_URL = 'https://donate.stripe.com/fZu4gzeBSfhbd7451F6Ri00';

export function Support() {
  const t = useT();
  const [qr, setQr] = useState('');
  const [showCode, setShowCode] = useState(false);
  useEffect(() => {
    void QRCode.toDataURL(PIX_CODE, { width: 520, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } }).then(setQr);
  }, []);
  return (
    <div className="page-shell">
      <div className="page-hero compact">
        <div className="eyebrow"><Sparkles size={13} /> {t('support.eyebrow')}</div>
        <h1>{t('support.title')}</h1>
        <p className="muted">{t('support.subtitle')}</p>
      </div>
      <section className="panel author-card">
        <img src="/logo.svg" alt="" className="author-logo" />
        <div>
          <h3>{t('about.developedBy')} Bruno Albertini</h3>
          <button className="link-btn" onClick={() => openUrl(AUTHOR_URL)}>Gestão Cultural Pro <ExternalLink size={13} /></button>
          <p className="muted">{t('support.free')}</p>
        </div>
      </section>
      <div className="support-grid">
        <section className="panel">
          <div className="eyebrow">PIX • {t('support.brazil')}</div>
          <div className="qr-box">{qr ? <img src={qr} alt="PIX QR Code" /> : null}</div>
          <p className="muted center">{t('support.scan')}</p>
          <button className="btn primary block lg" onClick={() => copyText(PIX_CODE).then(() => toast(t('support.pixCopied'), 'success'))}><Copy size={16} /> {t('support.copyPix')}</button>
          <button className="link-btn" onClick={() => setShowCode(!showCode)}>▸ {t('support.showCode')}</button>
          {showCode && <code className="pix-code">{PIX_CODE}</code>}
        </section>
        <section className="panel">
          <div className="eyebrow">STRIPE • {t('support.intl')}</div>
          <div className="stripe-heart"><Heart size={34} /></div>
          <h3>{t('support.title')}</h3>
          <p className="muted">{t('support.stripeText')}</p>
          <button className="btn ghost block lg" onClick={() => openUrl(STRIPE_URL)}><CreditCard size={16} /> {t('support.stripe')} <ExternalLink size={14} /></button>
          <button className="link-btn" onClick={() => copyText(STRIPE_URL).then(() => toast(t('common.copied'), 'success'))}><Copy size={14} /> {t('support.copyStripe')}</button>
          <p className="muted small">{t('support.voluntary')}</p>
        </section>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- sobre

export function About() {
  const t = useT();
  return (
    <div className="page-shell">
      <div className="page-hero compact">
        <div className="eyebrow"><Info size={13} /> {t('nav.about')}</div>
        <h1>GCP-Neuro Notas</h1>
        <p className="muted">{t('about.subtitle')}</p>
      </div>
      <section className="panel author-card">
        <img src="/logo.svg" alt="" className="author-logo" />
        <div>
          <h3>GCP-Neuro Notas {APP_VERSION}</h3>
          <p className="muted">{t('about.text')}</p>
          <p>{t('about.developedBy')} <b>Bruno Albertini</b> · <button className="link-btn" onClick={() => openUrl(AUTHOR_URL)}>Gestão Cultural Pro <ExternalLink size={13} /></button></p>
        </div>
      </section>
      <div className="support-grid">
        <section className="panel">
          <div className="panel-head"><Scale size={17} /><h3>{t('about.license')}</h3></div>
          <p className="muted">{t('about.licenseText')}</p>
          <button className="link-btn" onClick={() => openUrl(`https://github.com/${REPO}/blob/main/LICENSE`)}>GNU GPL-3.0 <ExternalLink size={13} /></button>
        </section>
        <section className="panel">
          <div className="panel-head"><Code2 size={17} /><h3>{t('about.source')}</h3></div>
          <p className="muted">{t('about.sourceText')}</p>
          <div className="row wrap">
            <button className="btn ghost sm" onClick={() => openUrl(`https://github.com/${REPO}`)}><GitBranch size={14} /> GitHub</button>
            <button className="btn ghost sm" onClick={() => openUrl(RELEASES_URL)}><ExternalLink size={14} /> {t('updates.github')}</button>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-head"><Sparkles size={17} /><h3>{t('about.stack')}</h3></div>
        <p className="muted small">Tauri · Rust · SQLite · React · TipTap/ProseMirror · Argon2id · XChaCha20-Poly1305 · Recharts · emoji-mart · Lucide · docx · PptxGenJS · SheetJS · jsPDF</p>
      </section>
    </div>
  );
}
