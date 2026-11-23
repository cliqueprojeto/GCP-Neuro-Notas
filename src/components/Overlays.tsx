import { fmtDateTime } from '../lib/dates';
import { NeuroIcon } from './NeuroIcon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  ArrowRight, Bot, CalendarHeart, CheckCircle2, Database, Download, FileText, Home, Info, LayoutTemplate, ListTodo, Lock, Network, Palette,
  PieChart, Plus, Search, Send, Settings, Sparkles, Trash2, X, AlertCircle, Heart, ExternalLink, Loader2,
  History, ArrowUpRight, Copy, FileInput, FilePlus2, Wand2, AlignLeft, Languages, Lightbulb,
} from 'lucide-react';
import { useT, useLang } from '../i18n';
import { useVault, livePages } from '../store/vault';
import { useUi } from '../store/ui';
import { usePrefs } from '../store/prefs';
import { PageIcon, Modal } from './ui';
import { searchPages, normalize } from '../lib/doc';
import { openDaily } from './Journal';
import { askBrain } from '../ai/brain';
import { activeProvider, LANG_NAMES, runAction, mdToHtml, type AiAction } from '../ai/assist';
import { listConversations, saveConversation } from '../ai/conversations';
import { copyText } from '../lib/platform';
import { htmlToDoc } from '../lib/transfer';
import { toast } from '../store/ui';
import type { ChatMessage } from '../ai/providers';
import type { Page } from '../lib/types';
import { downloadAndInstall, RELEASES_URL, type ReleaseInfo } from '../lib/updater';
import { isDesktop, openUrl } from '../lib/platform';
import { THEMES } from '../lib/themes';

// --------------------------------------------------------- paleta de comandos

interface Cmd { id: string; label: string; icon: React.ReactNode; hint?: string; run: () => void }

export function CommandPalette() {
  const t = useT();
  const ui = useUi();
  const pages = useVault((s) => s.pages);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [tagSel, setTagSel] = useState<string[]>([]);
  const [typeSel, setTypeSel] = useState<Page['type'] | ''>('');
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ui.palette) setQ(''), setSel(0), setTagSel([]), setTypeSel('');
  }, [ui.palette]);

  const live = livePages(pages);
  // Tags existentes (com contagem) e filtros: chips clicáveis ou "#tag" digitado na busca.
  const allTags = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const p of live) for (const tg of p.tags || []) {
      const k = normalize(tg);
      const cur = m.get(k);
      m.set(k, { label: cur?.label || tg, n: (cur?.n || 0) + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps
  const typed = [...q.matchAll(/#([^\s#]+)/g)].map((m) => normalize(m[1]));
  const wanted = [...new Set([...tagSel, ...typed])];
  const all = live.filter(
    (p) => (!typeSel || p.type === typeSel) && wanted.every((w) => (p.tags || []).some((tg) => normalize(tg) === w || (typed.includes(w) && normalize(tg).startsWith(w)))),
  );
  const filtering = wanted.length > 0 || !!typeSel;
  const make = (type: Page['type']) => () => {
    const p = useVault.getState().createPage({ type, title: q.startsWith('>') ? '' : q });
    ui.go({ name: 'page', id: p.id });
  };
  const commands: Cmd[] = [
    { id: 'new', label: t('cmd.newPage'), icon: <Plus size={16} />, run: make('page') },
    { id: 'newdb', label: t('cmd.newDatabase'), icon: <Database size={16} />, run: make('database') },
    { id: 'newrep', label: t('cmd.newReport'), icon: <PieChart size={16} />, run: make('report') },
    { id: 'newcanvas', label: t('cmd.newCanvas'), icon: <Palette size={16} />, run: make('canvas') },
    { id: 'today', label: t('nav.today'), icon: <CalendarHeart size={16} />, run: () => openDaily() },
    { id: 'home', label: t('nav.home'), icon: <Home size={16} />, run: () => ui.go({ name: 'home' }) },
    { id: 'tasks', label: t('nav.tasks'), icon: <ListTodo size={16} />, run: () => ui.go({ name: 'tasks' }) },
    { id: 'graph', label: t('nav.graph'), icon: <NeuroIcon size={16} />, run: () => ui.go({ name: 'graph' }) },
    { id: 'ai', label: t('nav.askAi'), icon: <Sparkles size={16} />, run: () => ui.set({ aiPanel: true }) },
    { id: 'tpl', label: t('nav.templates'), icon: <LayoutTemplate size={16} />, run: () => ui.go({ name: 'templates' }) },
    { id: 'settings', label: t('nav.settings'), icon: <Settings size={16} />, run: () => ui.go({ name: 'settings' }) },
    { id: 'backup', label: t('settings.tab.backup'), icon: <Download size={16} />, run: () => ui.go({ name: 'settings', tab: 'backup' }) },
    { id: 'aiset', label: t('settings.tab.ai'), icon: <Bot size={16} />, run: () => ui.go({ name: 'settings', tab: 'ai' }) },
    { id: 'trash', label: t('nav.trash'), icon: <Trash2 size={16} />, run: () => ui.go({ name: 'trash' }) },
    { id: 'support', label: t('nav.support'), icon: <Heart size={16} />, run: () => ui.go({ name: 'support' }) },
    { id: 'about', label: t('nav.about'), icon: <Info size={16} />, run: () => ui.go({ name: 'about' }) },
    { id: 'lock', label: t('nav.lock'), icon: <Lock size={16} />, run: () => useVault.getState().lock() },
    ...THEMES.map((th) => ({ id: 'th' + th.id, label: `${t('settings.theme')}: ${th.name}`, icon: <Palette size={16} />, run: () => usePrefs.getState().set({ theme: th.id }) })),
  ];
  const query = q.replace(/^>/, '').replace(/#[^\s#]+/g, '').trim();
  const cmdHits = commands.filter((c) => !query || normalize(c.label).includes(normalize(query)));
  const pageHits = q.startsWith('>') ? [] : query ? searchPages(all, query, filtering ? 40 : 12) : [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, filtering ? 40 : 8).map((p) => ({ page: p, score: 0, snippet: (p.tags || []).map((x) => '#' + x).join(' ') }));
  const items: Cmd[] = [
    ...pageHits.map((h) => ({ id: h.page.id, label: h.page.title || t('page.untitled'), hint: h.snippet, icon: <PageIcon icon={h.page.icon} size={16} />, run: () => ui.go({ name: 'page', id: h.page.id }) })),
    ...(query && !q.startsWith('>') && !filtering ? [{ id: 'create', label: t('cmd.create', { q: query }), icon: <Plus size={16} />, run: make('page') }] : []),
    ...(filtering ? [] : cmdHits.slice(0, query ? 10 : 8)),
  ];
  const run = (c: Cmd) => {
    ui.set({ palette: false });
    c.run();
  };
  useEffect(() => {
    list.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!ui.palette) return null;
  return (
    <div className="modal-back top" onMouseDown={(e) => e.target === e.currentTarget && ui.set({ palette: false })}>
      <div className="palette">
        <div className="palette-input">
          <Search size={18} />
          <input
            autoFocus
            placeholder={t('cmd.placeholder')}
            value={q}
            onChange={(e) => (setQ(e.target.value), setSel(0))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') e.preventDefault(), setSel((s) => Math.min(s + 1, items.length - 1));
              if (e.key === 'ArrowUp') e.preventDefault(), setSel((s) => Math.max(s - 1, 0));
              if (e.key === 'Enter' && items[sel]) run(items[sel]);
              if (e.key === 'Escape') ui.set({ palette: false });
            }}
          />
          <kbd>Esc</kbd>
        </div>
        {!q.startsWith('>') && (
          <div className="palette-filters">
            {(['page', 'database', 'report', 'canvas'] as const).map((ty) => (
              <button key={ty} className={'chip xs' + (typeSel === ty ? ' on' : '')} onClick={() => (setTypeSel(typeSel === ty ? '' : ty), setSel(0))}>{t(`new.${ty}`)}</button>
            ))}
            {allTags.length > 0 && <span className="palette-sep" />}
            {allTags.slice(0, 24).map(([k, v]) => (
              <button key={k} className={'chip xs tag' + (tagSel.includes(k) ? ' on' : '')} onClick={() => (setTagSel(tagSel.includes(k) ? tagSel.filter((x) => x !== k) : [...tagSel, k]), setSel(0))}>
                #{v.label} <small>{v.n}</small>
              </button>
            ))}
          </div>
        )}
        {filtering && !items.length && <div className="muted small pad">{t('editor.noResults')}</div>}
        <div className="palette-list" ref={list}>
          {items.map((c, i) => (
            <button key={c.id + i} className={'palette-item' + (i === sel ? ' on' : '')} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
              {c.icon}
              <span className="grow">
                <span className="ellipsis block">{c.label}</span>
                {c.hint && <small className="muted ellipsis block">{c.hint}</small>}
              </span>
              {i === sel && <ArrowRight size={14} className="muted" />}
            </button>
          ))}
          {!items.length && <div className="muted pad">{t('editor.noResults')}</div>}
        </div>
        <div className="palette-foot muted small">↑↓ {t('cmd.navigate')} · Enter {t('cmd.open')} · &gt; {t('cmd.commands')}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------- painel de IA (cérebro)

interface Msg { role: 'user' | 'assistant'; content: string; sources?: Page[]; error?: boolean }

export function AIPanel() {
  const t = useT();
  const lang = useLang();
  const ui = useUi();
  const pages = useVault((s) => s.pages);
  const brain = useVault((s) => s.settings.ai.brain);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  const [selBar, setSelBar] = useState<{ text: string; x: number; y: number } | null>(null);
  const [trOpen, setTrOpen] = useState(false);
  const autoSave = useVault((s) => s.settings.ai.saveChats !== false);
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const current = ui.route.name === 'page' ? pages[ui.route.id] : null;
  const provider = activeProvider();
  useEffect(() => {
    scroller.current?.scrollTo({ top: 1e9, behavior: 'smooth' });
  }, [msgs, busy]);

  const titleIndex = useMemo(() => new Map(livePages(pages).map((p) => [normalize(p.title || ''), p.id])), [pages]);
  const render = (md: string) => {
    const html = DOMPurify.sanitize(marked.parse(md, { async: false }) as string);
    // [[Título]] vira link clicável para a nota.
    return html.replace(/\[\[([^\]]+)\]\]/g, (_m, title) => {
      const id = titleIndex.get(normalize(title));
      return id ? `<a class="page-link" data-page="${id}">${title}</a>` : `<span class="page-link broken">${title}</span>`;
    });
  };

  const send = async (text = input) => {
    if (!text.trim() || busy) return;
    if (!provider) return;
    const history: ChatMessage[] = msgs.filter((m) => !m.error).slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    abort.current = new AbortController();
    try {
      const all = brain ? livePages(pages) : current ? [current] : [];
      const r = await askBrain(provider, all, history, text, LANG_NAMES[lang], current, abort.current.signal);
      setMsgs((m) => {
        const next: Msg[] = [...m, { role: 'assistant', content: r.text, sources: r.sources }];
        persist(next);
        return next;
      });
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: t('ai.error') + ' ' + String((e as Error).message || e), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  /** Salva a conversa como página (aparece no Grafo ligada às notas citadas). */
  const persist = (list: Msg[]) => {
    if (!autoSave || !provider) return;
    const clean = list.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content, sources: m.sources?.map((p) => p.id) }));
    if (!clean.some((m) => m.role === 'assistant')) return;
    const ctx = convId ? pages[pages[convId]?.chat?.contextId || ''] || null : current;
    setConvId(saveConversation(convId, clean, `${provider.name} · ${provider.model}`, ctx));
  };
  const openConv = (p: Page) => {
    const all = useVault.getState().pages;
    setMsgs((p.chat?.messages || []).map((m) => ({ role: m.role, content: m.content, sources: (m.sources || []).map((id) => all[id]).filter(Boolean) })));
    setConvId(p.id);
    setHistOpen(false);
  };
  const newConv = () => (setMsgs([]), setConvId(null));

  // Ações sobre o trecho selecionado numa resposta (reescrever, resumir, traduzir…).
  const onSelect = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() || '';
    if (!text || !sel?.rangeCount || !scroller.current?.contains(sel.anchorNode)) return setSelBar(null);
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setSelBar({ text, x: r.left + r.width / 2, y: r.top });
  };
  const act = async (action: AiAction, target = '') => {
    if (!selBar || !provider) return;
    const text = selBar.text;
    setSelBar(null);
    setTrOpen(false);
    window.getSelection()?.removeAllRanges();
    const label = t(`ai.action.${action === 'translate' ? 'translate' : action}` as any) + (target ? ` (${target})` : '');
    setMsgs((m) => [...m, { role: 'user', content: `${label}: “${text.slice(0, 400)}${text.length > 400 ? '…' : ''}”` }]);
    setBusy(true);
    try {
      const out = await runAction(action, text, target);
      setMsgs((m) => {
        const next: Msg[] = [...m, { role: 'assistant', content: out }];
        persist(next);
        return next;
      });
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: t('ai.error') + ' ' + String((e as Error).message || e), error: true }]);
    } finally {
      setBusy(false);
    }
  };
  const insertInPage = (md: string) => {
    if (!current || current.type !== 'page') return toast(t('chat.openPageFirst'), 'info');
    const doc = current.content?.type === 'doc' ? current.content : { type: 'doc', content: [] };
    const add = htmlToDoc(mdToHtml(md)).content || [];
    useVault.getState().updatePage(current.id, { content: { ...doc, content: [...(doc.content || []), ...add] } });
    toast(t('chat.inserted'), 'success');
  };
  const saveAsNote = (md: string) => {
    const first = md.replace(/[#*_>`]/g, '').trim().split('\n')[0].slice(0, 60);
    const np = useVault.getState().createPage({ title: first || t('chat.note'), icon: '✨', content: htmlToDoc(mdToHtml(md)), parentId: current?.id ?? null, tags: ['ia'] });
    toast(t('chat.savedNote'), 'success');
    ui.go({ name: 'page', id: np.id });
  };

  const suggestions = current
    ? [t('brain.q.summarize'), t('brain.q.actions'), t('brain.q.connect'), t('brain.q.questions')]
    : [t('brain.q.week'), t('brain.q.projects'), t('brain.q.ideas'), t('brain.q.pending')];

  if (!ui.aiPanel) return null;
  return (
    <aside className="ai-panel">
      <div className="ai-head">
        <span className="ai-orb"><Sparkles size={16} /></span>
        <div className="grow">
          <b>{t('brain.title')}</b>
          <small className="muted block">{provider ? `${provider.name} · ${provider.model}` : t('ai.noProvider')}</small>
        </div>
        <button className="icon-btn sm" title={t('chat.history')} onClick={() => setHistOpen(!histOpen)}><History size={16} /></button>
        {msgs.length > 0 && <button className="btn ghost xs" onClick={newConv}><Plus size={13} /> {t('brain.new')}</button>}
        <button className="icon-btn sm" onClick={() => ui.set({ aiPanel: false })}><X size={17} /></button>
      </div>
      {histOpen && (
        <div className="ai-history">
          <div className="section-label">{t('chat.history')}</div>
          {!listConversations().length && <p className="muted small">{t('chat.noHistory')}</p>}
          {listConversations().slice(0, 40).map((p) => (
            <div key={p.id} className={'ai-hist-item' + (p.id === convId ? ' on' : '')}>
              <button className="grow ellipsis" onClick={() => openConv(p)}>{p.title || t('chat.untitled')}<small className="muted block">{fmtDateTime(p.updatedAt)}</small></button>
              <button className="icon-btn xs" title={t('db.open')} onClick={() => (setHistOpen(false), ui.go({ name: 'page', id: p.id }))}><ArrowUpRight size={13} /></button>
              <button className="icon-btn xs" title={t('common.delete')} onClick={() => (useVault.getState().trashPage(p.id), p.id === convId && newConv())}><Trash2 size={13} /></button>
            </div>
          ))}
          <label className="check small"><input type="checkbox" checked={autoSave} onChange={(e) => useVault.getState().updateSettings((s) => ({ ...s, ai: { ...s.ai, saveChats: e.target.checked } }))} /> {t('chat.autoSave')}</label>
        </div>
      )}
      <div className="ai-body" ref={scroller} onMouseUp={onSelect} onTouchEnd={() => setTimeout(onSelect, 250)} onScroll={() => setSelBar(null)} onClick={(e) => {
        const a = (e.target as HTMLElement).closest('[data-page]') as HTMLElement | null;
        if (a) ui.go({ name: 'page', id: a.dataset.page! });
      }}>
        {!provider ? (
          <div className="ai-empty">
            <Bot size={34} />
            <h3>{t('brain.setupTitle')}</h3>
            <p className="muted">{t('brain.setupText')}</p>
            <button className="btn primary" onClick={() => ui.go({ name: 'settings', tab: 'ai' })}><Settings size={15} /> {t('brain.setup')}</button>
          </div>
        ) : !msgs.length ? (
          <div className="ai-empty">
            <span className="ai-orb lg"><Sparkles size={26} /></span>
            <h3>{t('brain.hello')}</h3>
            <p className="muted">{brain ? t('brain.helloText', { n: livePages(pages).length }) : t('brain.helloLocal')}</p>
            {current && <span className="chip static"><PageIcon icon={current.icon} size={13} /> {current.title || t('page.untitled')}</span>}
            <div className="ai-suggest">
              {suggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={'msg ' + m.role + (m.error ? ' error' : '')}>
              {m.role === 'assistant' ? <div className="prose sm" dangerouslySetInnerHTML={{ __html: render(m.content) }} /> : <p>{m.content}</p>}
              {m.role === 'assistant' && !m.error && (
                <div className="msg-actions">
                  <button className="icon-btn xs" title={t('common.copy')} onClick={() => copyText(m.content).then(() => toast(t('common.copied'), 'success'))}><Copy size={13} /></button>
                  {current?.type === 'page' && <button className="icon-btn xs" title={t('chat.insert')} onClick={() => insertInPage(m.content)}><FileInput size={13} /></button>}
                  <button className="icon-btn xs" title={t('chat.saveNote')} onClick={() => saveAsNote(m.content)}><FilePlus2 size={13} /></button>
                </div>
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="msg-sources">
                  {m.sources.slice(0, 6).map((p) => (
                    <button key={p.id} className="chip xs" onClick={() => ui.go({ name: 'page', id: p.id })}><PageIcon icon={p.icon} size={12} /> {p.title || t('page.untitled')}</button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {busy && <div className="msg assistant"><span className="typing"><i /><i /><i /></span></div>}
      </div>
      {selBar && provider && (
        <div className="ai-selbar" style={{ left: Math.max(8, Math.min(selBar.x - 170, window.innerWidth - 348)), top: Math.max(8, selBar.y - 50) }} onMouseDown={(e) => e.preventDefault()}>
          <button onClick={() => act('improve')}><Wand2 size={13} /> {t('chat.rewrite')}</button>
          <button onClick={() => act('summarize')}><AlignLeft size={13} /> {t('ai.action.summarize')}</button>
          <button onClick={() => setTrOpen(!trOpen)}><Languages size={13} /> {t('ai.translateTo')}</button>
          <button onClick={() => act('explain')}><Lightbulb size={13} /></button>
          <button onClick={() => (copyText(selBar.text), setSelBar(null), toast(t('common.copied'), 'success'))}><Copy size={13} /></button>
          {trOpen && (
            <div className="ai-selbar-sub">
              {(['pt', 'en', 'es'] as const).map((l) => <button key={l} onClick={() => act('translate', LANG_NAMES[l])}>{l.toUpperCase()}</button>)}
            </div>
          )}
        </div>
      )}
      {provider && (
        <div className="ai-input">
          <textarea rows={2} placeholder={t('brain.placeholder')} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())} />
          {busy ? (
            <button className="icon-btn boxed" onClick={() => abort.current?.abort()}><X size={17} /></button>
          ) : (
            <button className="icon-btn boxed accent" onClick={() => send()} disabled={!input.trim()}><Send size={17} /></button>
          )}
        </div>
      )}
    </aside>
  );
}

// --------------------------------------------------------------- atualização

export function UpdateDialog({ release, onClose }: { release: ReleaseInfo; onClose: () => void }) {
  const t = useT();
  const prefs = usePrefs();
  const [progress, setProgress] = useState<{ r: number; t: number } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const install = async () => {
    setError('');
    setProgress({ r: 0, t: release.asset?.size || 0 });
    try {
      await downloadAndInstall(release, (r, tot) => setProgress({ r, t: tot }));
      setDone(true);
    } catch (e) {
      setError(String((e as Error).message || e));
      setProgress(null);
    }
  };
  const pct = progress && progress.t ? Math.round((progress.r / progress.t) * 100) : 0;
  return (
    <Modal open onClose={onClose} title={<><Download size={18} /> {t('update.title', { v: release.version })}</>} width={620}
      footer={
        <>
          <button className="btn ghost" onClick={() => (prefs.set({ skippedVersion: release.version }), onClose())}>{t('update.skip')}</button>
          <div className="grow" />
          <button className="btn ghost" onClick={() => openUrl(release.url || RELEASES_URL)}><ExternalLink size={14} /> GitHub</button>
          {isDesktop && release.asset ? (
            <button className="btn primary" onClick={install} disabled={!!progress || done}>
              {progress ? <Loader2 size={15} className="spin" /> : <Download size={15} />} {done ? t('update.installing') : progress ? `${pct}%` : t('update.install')}
            </button>
          ) : (
            <button className="btn primary" onClick={() => openUrl(release.asset?.url || release.url || RELEASES_URL)}>{t('update.download')}</button>
          )}
        </>
      }>
      <div className="release-notes prose sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(release.notes || '', { async: false }) as string) }} />
      {progress && <div className="progress"><span style={{ width: pct + '%' }} /></div>}
      {release.asset && <small className="muted">{release.asset.name} · {(release.asset.size / 1048576).toFixed(1)} MB · SHA-256 ✓</small>}
      {done && <div className="callout-box"><CheckCircle2 size={16} /> {t('update.done')}</div>}
      {error && <div className="callout-box warn"><AlertCircle size={16} /> {error}</div>}
    </Modal>
  );
}

// ------------------------------------------------------------------- avisos

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="toasts">
      {toasts.map((x) => (
        <div key={x.id} className={'toast ' + x.kind} onClick={() => dismiss(x.id)}>
          {x.kind === 'success' ? <CheckCircle2 size={16} /> : x.kind === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
          <span>{x.text}</span>
        </div>
      ))}
    </div>
  );
}

export { FileText };
