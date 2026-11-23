import { NeuroIcon } from './NeuroIcon';
import { useMemo } from 'react';
import {
  BrainCircuit, CalendarHeart, Clock, Database, FileText, FileUp, LayoutTemplate, Network, Palette, PieChart, Plus, ShieldCheck, Sparkles,
  Star, Layers, Share2,
} from 'lucide-react';
import { useT, useLang, LOCALES } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi, toast } from '../store/ui';
import { PageIcon } from './ui';
import { pageText, relativeTime, wordCount } from '../lib/doc';
import { openDaily } from './Journal';
import { importFiles } from '../lib/transfer';
import type { PageType } from '../lib/types';

export function Home() {
  const t = useT();
  const lang = useLang();
  const pages = useVault((s) => s.pages);
  const createPage = useVault((s) => s.createPage);
  const lastBackup = useVault((s) => s.settings.cloud.lastBackup);
  const go = useUi((s) => s.go);
  const setUi = useUi((s) => s.set);
  const all = livePages(pages);
  const stats = useMemo(() => {
    const words = all.reduce((s, p) => s + (p.type === 'page' ? wordCount(pageText(p)) : 0), 0);
    return { pages: all.length, words, dbs: all.filter((p) => p.type === 'database').length, links: all.reduce((s, p) => s + (JSON.stringify(p.content || '').match(/"pageLink"/g)?.length || 0), 0) };
  }, [all]);
  const recent = [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const favs = all.filter((p) => p.favorite).slice(0, 6);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('home.morning') : hour < 18 ? t('home.afternoon') : t('home.evening');
  const nf = new Intl.NumberFormat(LOCALES[lang]);

  const make = (type: PageType) => {
    const p = createPage({ type });
    go({ name: 'page', id: p.id });
  };

  const tools: { key: string; icon: any; tags: [string, string, string]; grad: string; run: () => void }[] = [
    { key: 'docs', icon: FileText, tags: ['MD', 'DOCX', 'PDF'], grad: 'tg-violet', run: () => make('page') },
    { key: 'db', icon: Database, tags: ['TABELA', 'KANBAN', 'AGENDA'], grad: 'tg-teal', run: () => make('database') },
    { key: 'bi', icon: PieChart, tags: ['BI', 'XLSX', 'PPTX'], grad: 'tg-rose', run: () => make('report') },
    { key: 'canvas', icon: Palette, tags: ['QUADRO', 'SETAS', 'CANETA'], grad: 'tg-blue', run: () => make('canvas') },
  ];

  return (
    <div className="page-shell home">
      <div className="page-hero">
        <div className="eyebrow"><Sparkles size={13} /> GCP-NEURO NOTAS</div>
        <h1>{greet}! {t('home.title')}</h1>
        <p className="muted">{t('home.subtitle')}</p>
      </div>

      <div className="home-grid">
        <div className="hero-card">
          <div className="hero-illu">
            <div className="hero-illu-card"><Layers size={34} /></div>
          </div>
          <div className="hero-copy">
            <h2>{t('home.cardTitle')}</h2>
            <p className="muted">{t('home.cardText')}</p>
            <div className="row wrap">
              <button className="btn primary" onClick={() => make('page')}><Plus size={16} /> {t('new.page')}</button>
              <button className="btn ghost" onClick={() => go({ name: 'templates' })}><LayoutTemplate size={16} /> {t('nav.templates')}</button>
              <button className="btn ghost" onClick={() => openDaily()}><CalendarHeart size={16} /> {t('nav.today')}</button>
              <button className="btn ghost" onClick={async () => { const n = await importFiles(null); if (n) toast(t('import.done', { n }), 'success'); }}><FileUp size={16} /> {t('import.short')}</button>
            </div>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat"><span className="stat-icon green"><FileText size={16} /></span><b>{nf.format(stats.pages)}</b><small>{t('home.stat.pages')}</small></div>
          <div className="stat"><span className="stat-icon blue"><Clock size={16} /></span><b>{nf.format(stats.words)}</b><small>{t('home.stat.words')}</small></div>
          <div className="stat"><span className="stat-icon purple"><NeuroIcon size={16} /></span><b>{nf.format(stats.links)}</b><small>{t('home.stat.links')}</small></div>
          <div className="stat"><span className="stat-icon pink"><ShieldCheck size={16} /></span><b>100%</b><small>{lastBackup ? t('home.stat.backup', { d: relativeTime(lastBackup, LOCALES[lang]) }) : t('home.stat.private')}</small></div>
        </div>
      </div>

      <h2 className="section-title">{t('home.tools')}</h2>
      <div className="tool-grid">
        {tools.map(({ key, icon: Icon, tags, grad, run }) => (
          <button key={key} className="tool-card" onClick={run}>
            <div className={'tool-art ' + grad}>
              <span className="tool-tag tl">{tags[0]}</span>
              <span className="tool-tag tr">{tags[1]}</span>
              <span className="tool-tag br">{tags[2]}</span>
              <span className="tool-glyph"><Icon size={30} /></span>
            </div>
            <div className="tool-body">
              <b><span className="tool-mini"><Icon size={14} /></span> {t(`home.tool.${key}` as any)}</b>
              <small className="muted">{t(`home.tool.${key}.text` as any)}</small>
            </div>
          </button>
        ))}
      </div>

      <div className="home-lower">
        <section className="panel">
          <div className="panel-head"><span className="stat-icon yellow"><Clock size={15} /></span><h3>{t('home.recent')}</h3></div>
          {!recent.length && <p className="muted">{t('home.noRecent')}</p>}
          <div className="recent-list">
            {recent.map((p) => (
              <button key={p.id} className="recent" onClick={() => go({ name: 'page', id: p.id })}>
                <PageIcon icon={p.icon} size={18} />
                <span className="grow ellipsis">{p.title || t('page.untitled')}</span>
                <small className="muted">{relativeTime(p.updatedAt, LOCALES[lang])}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><span className="stat-icon purple"><BrainCircuit size={15} /></span><h3>{t('home.brain')}</h3></div>
          <p className="muted">{t('home.brainText')}</p>
          <div className="row wrap">
            <button className="btn ai" onClick={() => setUi({ aiPanel: true })}><Sparkles size={15} /> {t('nav.askAi')}</button>
            <button className="btn ghost" onClick={() => go({ name: 'graph' })}><NeuroIcon size={15} /> {t('nav.graph')}</button>
            <button className="btn ghost" onClick={() => go({ name: 'settings', tab: 'backup' })}><Share2 size={15} /> {t('home.share')}</button>
          </div>
          {favs.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 14 }}><Star size={13} /> {t('nav.favorites')}</div>
              <div className="fav-chips">
                {favs.map((p) => (
                  <button key={p.id} className="chip" onClick={() => go({ name: 'page', id: p.id })}><PageIcon icon={p.icon} size={14} /> {p.title || t('page.untitled')}</button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
