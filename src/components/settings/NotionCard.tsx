import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, FileArchive, RefreshCw, Search, Send } from 'lucide-react';
import { useT, useLang, LOCALES, type TKey } from '../../i18n';
import { useVault } from '../../store/vault';
import { toast, useUi } from '../../store/ui';
import { Modal, Spinner } from '../ui';
import { openUrl, isTauri } from '../../lib/platform';
import { relativeTime } from '../../lib/doc';
import { importFromNotion, notionErrorKey, pushToNotion, searchNotion, syncFromNotion, testToken, type NotionItem } from '../../cloud/notion';
import { NotionIcon } from './BrandIcons';
import { pickFiles } from '../../lib/files';
import type { Page } from '../../lib/types';

// Valores estáveis: um [] ou {} novo a cada leitura faria a tela redesenhar sem parar.
const NO_LINKS: Record<string, string> = {};

/** Cartão "Notion" em Configurações › Backup: token, importar e sincronizar. */
export function NotionCard() {
  const t = useT();
  const lang = useLang();
  const v = useVault();
  const notion = v.settings.notion;
  const [tk, setTk] = useState(notion?.token || '');
  const [busy, setBusy] = useState('');
  const ws = notion?.token ? notion.workspace || '' : '';
  const [pick, setPick] = useState(false);
  const [help, setHelp] = useState(!notion?.token);
  const linked = Object.keys(notion?.links || {}).length;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(t(notionErrorKey(e) as TKey) + (notionErrorKey(e) === 'notion.err.generic' ? ' ' + String((e as Error).message || e) : ''), 'error');
    } finally {
      setBusy('');
    }
  };
  const saveToken = () =>
    run('test', async () => {
      const name = await testToken(tk.trim());
      v.updateSettings((s) => ({ ...s, notion: { ...(s.notion || {}), token: tk.trim(), workspace: name } }));
      setHelp(false);
      toast(t('notion.connected', { w: name }), 'success');
      // Próximo passo natural: escolher o que trazer do Notion.
      setPick(true);
    });

  const importZip = async () => {
    const [f] = await pickFiles(false, '.zip,application/zip');
    if (!f) return;
    setBusy('zip');
    try {
      const { importNotionZip } = await import('../../lib/notionZip');
      const r = await importNotionZip(new Uint8Array(await f.arrayBuffer()), null, (s) => setBusy('zip:' + s));
      toast(t('notion.zipDone', { p: r.pages, d: r.databases, f: r.files }), 'success');
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      toast(msg === 'notion-zip-empty' ? t('notion.zipEmpty') : t('notion.zipError') + ' ' + msg, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="card-section notion-card">
      <div className="card-head">
        <span className="card-icon brand"><NotionIcon size={20} /></span>
        <div>
          <h3>Notion</h3>
          <p className="muted">{t('notion.subtitle')}</p>
        </div>
      </div>
      <div className="card-body">
      {!isTauri && <div className="callout-box warn">{t('cloud.desktopOnly')}</div>}
      <div className="row">
        <input className="input mono" type="password" placeholder="ntn_… / secret_…" value={tk} onChange={(e) => setTk(e.target.value)} autoComplete="off" />
        <button className="btn primary sm" disabled={!tk.trim() || !!busy || !isTauri} onClick={saveToken}>{busy === 'test' ? <Spinner /> : <CheckCircle2 size={14} />} {t('notion.connect')}</button>
      </div>
      {notion?.token && (
        <div className="row wrap">
          <button className="btn ghost sm" disabled={!!busy} onClick={() => setPick(true)}><Download size={14} /> {t('notion.import')}</button>
          <button className="btn ghost sm" disabled={!!busy} title={linked ? undefined : t('notion.syncFirst')} onClick={() => (linked ? run('sync', async () => { const n = await syncFromNotion((s) => setBusy('sync:' + s)); toast(t('notion.synced', { n }), 'success'); }) : setPick(true))}>
            {busy.startsWith('sync') ? <Spinner /> : <RefreshCw size={14} />} {t('notion.sync')}
          </button>
          <span className="muted small">
            {ws && <>{ws} · </>}{t('notion.linked', { n: linked })}
            {notion.lastSync ? ` · ${t('cloud.lastSync')}: ${relativeTime(notion.lastSync, LOCALES[lang])}` : ''}
          </span>
          <button className="btn ghost sm danger" onClick={() => (setTk(''), v.updateSettings((s) => ({ ...s, notion: { token: '', links: s.notion?.links } })))}>{t('cloud.disconnect')}</button>
        </div>
      )}
      {busy.startsWith('sync:') && <p className="muted small">↻ {busy.slice(5)}</p>}
      <div className="notion-zip">
        <button className="btn ghost sm" disabled={!!busy} onClick={importZip}>{busy.startsWith('zip') ? <Spinner /> : <FileArchive size={14} />} {t('notion.zip')}</button>
        <span className="muted small">{busy.startsWith('zip:') ? '↻ ' + busy.slice(4) : t('notion.zipHint')}</span>
      </div>
      <details className="advanced" open={help} onToggle={(e) => setHelp((e.target as HTMLDetailsElement).open)}>
        <summary>{t('notion.howTo')}</summary>
        <ol className="notion-steps">
          <li>{t('notion.step1')} <button className="link-btn" onClick={() => openUrl('https://www.notion.so/profile/integrations')}><ExternalLink size={12} /> notion.so/profile/integrations</button></li>
          <li>{t('notion.step2')}</li>
          <li>{t('notion.step3')}</li>
          <li>{t('notion.step4')}</li>
        </ol>
        <p className="muted small">{t('notion.privacy')}</p>
      </details>
      {pick && <NotionPicker onClose={() => setPick(false)} />}
      </div>
    </section>
  );
}

function NotionPicker({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [items, setItems] = useState<NotionItem[] | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const seq = useRef(0);
  const load = async (query = '') => {
    const my = ++seq.current;
    setItems(null);
    setErr('');
    try {
      const r = await searchNotion(query);
      if (my === seq.current) setItems(r);
    } catch (e) {
      if (my !== seq.current) return;
      const k = notionErrorKey(e);
      setErr(t(k as TKey) + (k === 'notion.err.generic' ? ' ' + String((e as Error)?.message || e) : ''));
      setItems([]);
    }
  };
  // Carrega uma vez ao abrir (antes era chamado a cada desenho da tela e travava o app).
  useEffect(() => {
    void load();
    return () => void (seq.current = -1);
  }, []);
  const go = async () => {
    setBusy('…');
    try {
      const chosen = (items || []).filter((i) => sel.has(i.id));
      const n = await importFromNotion(chosen, (s) => setBusy(s));
      toast(t('notion.imported', { n }), 'success');
      onClose();
    } catch (e) {
      toast(t(notionErrorKey(e) as TKey) + ' ' + String((e as Error).message || ''), 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title={<><NotionIcon size={18} /> {t('notion.import')}</>}
      footer={
        <>
          {busy && <span className="muted small ellipsis grow"><Spinner /> {busy}</span>}
          {!busy && <div className="grow" />}
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={!sel.size || !!busy} onClick={go}><Download size={15} /> {t('notion.importN', { n: sel.size })}</button>
        </>
      }
    >
      <form className="row" onSubmit={(e) => (e.preventDefault(), load(q))}>
        <input className="input" placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn ghost sm"><Search size={14} /></button>
      </form>
      <div className="notion-list">
        {items === null && <div className="muted small pad"><Spinner /> {t('notion.loading')}</div>}
        {err && <div className="callout-box warn">{err}</div>}
        {items?.length === 0 && !err && <div className="muted small pad">{t('notion.none')}</div>}
        {items && items.length > 1 && (
          <label className="notion-item all">
            <input type="checkbox" checked={sel.size === items.length} onChange={() => setSel(sel.size === items.length ? new Set() : new Set(items.map((i) => i.id)))} />
            <span className="grow">{t('notion.selectAll')}</span>
          </label>
        )}
        {items?.map((i) => (
          <label key={i.id} className="notion-item">
            <input type="checkbox" checked={sel.has(i.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(i.id) ? n.delete(i.id) : n.add(i.id); return n; })} />
            <span className="notion-ic">{i.icon || (i.kind === 'database' ? '🗂️' : '📄')}</span>
            <span className="grow ellipsis">{i.title}</span>
            <small className="muted">{i.kind === 'database' ? t('new.database') : t('new.page')}</small>
          </label>
        ))}
      </div>
    </Modal>
  );
}

/** Janela "Enviar ao Notion" a partir de uma página. */
export function NotionSendModal({ page, onClose }: { page: Page; onClose: () => void }) {
  const t = useT();
  const token = useVault((s) => s.settings.notion?.token);
  const links = useVault((s) => s.settings.notion?.links) ?? NO_LINKS;
  const linked = Object.entries(links).find(([, local]) => local === page.id)?.[0];
  const [items, setItems] = useState<NotionItem[] | null>(null);
  const [parent, setParent] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token || linked) return;
    let alive = true;
    searchNotion()
      .then((r) => alive && setItems(r.filter((i) => i.kind === 'page')))
      .catch((e) => alive && (toast(t(notionErrorKey(e) as TKey), 'error'), setItems([])));
    return () => void (alive = false);
  }, [token, linked]);
  const send = async () => {
    setBusy(true);
    try {
      const url = await pushToNotion(page, parent || null);
      toast(t('notion.sent'), 'success');
      if (url.startsWith('http')) void openUrl(url);
      onClose();
    } catch (e) {
      toast(t(notionErrorKey(e) as TKey) + ' ' + String((e as Error).message || ''), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={<><NotionIcon size={18} /> {t('notion.send')}</>}
      footer={
        <>
          <div className="grow" />
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          {token && <button className="btn primary" disabled={busy || (!linked && !parent)} onClick={send}>{busy ? <Spinner /> : <Send size={15} />} {linked ? t('notion.update') : t('notion.send')}</button>}
        </>
      }
    >
      {!token ? (
        <>
          <p className="muted">{t('notion.needToken')}</p>
          <button className="btn primary" onClick={() => (onClose(), useUi.getState().go({ name: 'settings', tab: 'backup' }))}>{t('nav.settings')}</button>
        </>
      ) : linked ? (
        <p className="muted">{t('notion.linkedPage')}</p>
      ) : (
        <>
          <p className="muted small">{t('notion.chooseParent')}</p>
          <div className="notion-list">
            {items === null && <div className="muted small pad"><Spinner /> {t('notion.loading')}</div>}
            {items?.length === 0 && <div className="muted small pad">{t('notion.none')}</div>}
            {items?.map((i) => (
              <label key={i.id} className={'notion-item' + (parent === i.id ? ' on' : '')}>
                <input type="radio" name="np" checked={parent === i.id} onChange={() => setParent(i.id)} />
                <span className="notion-ic">{i.icon || '📄'}</span>
                <span className="grow ellipsis">{i.title}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
