import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor as TEditor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useT } from '../i18n';
import { normalize } from '../lib/doc';

const key = new PluginKey<{ q: string; cur: number; set: DecorationSet }>('findInPage');

/** Destaca no texto todas as ocorrências da busca (sem acento e sem diferenciar maiúsculas). */
export const FindHighlight = Extension.create({
  name: 'findHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: () => ({ q: '', cur: -1, set: DecorationSet.empty }),
          apply(tr, old) {
            const meta = tr.getMeta(key) as { q: string; cur: number } | undefined;
            const q = meta ? meta.q : old.q;
            const cur = meta ? meta.cur : old.cur;
            if (!meta && !tr.docChanged) return old;
            if (!q) return { q, cur, set: DecorationSet.empty };
            const decos: Decoration[] = [];
            textMatches(tr.doc, q).forEach((m, i) => decos.push(Decoration.inline(m.from, m.to, { class: i === cur ? 'find-hit cur' : 'find-hit' })));
            return { q, cur, set: DecorationSet.create(tr.doc, decos) };
          },
        },
        props: { decorations: (st) => key.getState(st)?.set },
      }),
    ];
  },
});

/** Posições de cada ocorrência do texto no documento. */
export function textMatches(doc: PMNode, q: string): { from: number; to: number }[] {
  const nq = normalize(q);
  if (!nq) return [];
  const out: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // texto do bloco com o mapa de posições (para achar mesmo atravessando negrito/links)
    let text = '';
    const map: number[] = [];
    node.forEach((child, off) => {
      if (child.isText) for (let i = 0; i < child.text!.length; i++) (text += child.text![i]), map.push(pos + 1 + off + i);
    });
    const nt = normalize(text);
    if (nt.length !== text.length) return false; // normalização mudou o tamanho (raro): ignora o bloco
    let i = nt.indexOf(nq);
    while (i >= 0) {
      out.push({ from: map[i], to: map[i + nq.length - 1] + 1 });
      i = nt.indexOf(nq, i + nq.length);
    }
    return false;
  });
  return out;
}

type Filter = 'all' | 'headings' | 'tables' | 'images' | 'links' | 'tasks' | 'layouts' | 'media' | 'callouts';
const FILTERS: Filter[] = ['all', 'headings', 'tables', 'images', 'links', 'tasks', 'layouts', 'media', 'callouts'];
const TYPES: Record<Exclude<Filter, 'all'>, string[]> = {
  headings: ['heading'],
  tables: ['table'],
  images: ['image', 'gallery'],
  links: ['pageLink', 'link'],
  tasks: ['taskItem'],
  layouts: ['columns', 'cards', 'buttons', 'toggle'],
  media: ['attachment', 'mediaRec', 'youtube', 'mapBlock', 'qrcode', 'dbView'],
  callouts: ['callout', 'blockquote'],
};

interface Hit { pos: number; to?: number; type: string; label: string }

function nodeLabel(n: PMNode): string {
  const t = n.textContent?.trim();
  if (t) return t.slice(0, 90);
  const a = n.attrs || {};
  return String(a.label || a.alt || a.caption || a.summary || a.title || (a.files?.[0]?.name ?? '') || n.type.name);
}

/** Barra "Localizar na página": busca com destaque, próximo/anterior e filtros por tipo de elemento. */
export function FindBar({ editor, onClose }: { editor: TEditor; onClose: () => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [cur, setCur] = useState(0);
  const [rev, setRev] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const f = () => setRev((x) => x + 1);
    editor.on('update', f);
    return () => {
      editor.off('update', f);
      editor.view.dispatch(editor.state.tr.setMeta(key, { q: '', cur: -1 }));
    };
  }, [editor]);

  const hits = useMemo<Hit[]>(() => {
    const doc = editor.state.doc;
    const list: Hit[] = [];
    if (filter === 'all') {
      for (const m of textMatches(doc, q)) {
        const $p = doc.resolve(m.from);
        list.push({ pos: m.from, to: m.to, type: $p.parent.type.name, label: $p.parent.textContent.slice(0, 120) });
      }
      return list;
    }
    const types = TYPES[filter];
    const nq = normalize(q);
    doc.descendants((n, pos) => {
      if (filter === 'links' && n.isText && n.marks.some((mk) => mk.type.name === 'link')) {
        if (!nq || normalize(n.text || '').includes(nq)) list.push({ pos, type: 'link', label: n.text || '' });
        return false;
      }
      if (types.includes(n.type.name)) {
        const label = nodeLabel(n);
        if (!nq || normalize(label).includes(nq)) list.push({ pos, type: n.type.name, label });
      }
      return true;
    });
    return list;
  }, [q, filter, rev, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = hits.length ? Math.min(cur, hits.length - 1) : -1;
    editor.view.dispatch(editor.state.tr.setMeta(key, { q: filter === 'all' ? q : '', cur: c }));
  }, [hits, cur, q, filter, editor]);

  const go = (i: number) => {
    if (!hits.length) return;
    const n = (i + hits.length) % hits.length;
    setCur(n);
    const h = hits[n];
    const sel = h.to ? { from: h.pos, to: h.to } : h.pos;
    editor.chain().setTextSelection(sel as any).scrollIntoView().run();
    // rola até o elemento mesmo quando é um bloco (imagem, tabela, colunas…)
    const dom = editor.view.nodeDOM(h.pos) as HTMLElement | null;
    const el = dom?.nodeType === 1 ? dom : (editor.view.domAtPos(h.pos).node as HTMLElement)?.parentElement;
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    if (el && !h.to) {
      el.classList.add('find-flash');
      setTimeout(() => el.classList.remove('find-flash'), 1200);
    }
  };

  return (
    <div className="find-bar" onMouseDown={(e) => (e.target as HTMLElement).tagName !== 'INPUT' && e.preventDefault()}>
      <div className="find-row">
        <Search size={15} className="muted" />
        <input
          ref={input}
          className="find-input"
          placeholder={t('find.placeholder')}
          value={q}
          onChange={(e) => (setQ(e.target.value), setCur(0))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.preventDefault(), go(e.shiftKey ? cur - 1 : cur + (hits[cur] && q ? 1 : 0)));
            if (e.key === 'Escape') (e.preventDefault(), onClose());
          }}
        />
        <span className="find-count">{hits.length ? `${Math.min(cur + 1, hits.length)}/${hits.length}` : q || filter !== 'all' ? '0' : ''}</span>
        <button className="icon-btn xs" title={t('find.prev')} disabled={!hits.length} onClick={() => go(cur - 1)}><ChevronUp size={15} /></button>
        <button className="icon-btn xs" title={t('find.next')} disabled={!hits.length} onClick={() => go(cur + 1)}><ChevronDown size={15} /></button>
        <button className="icon-btn xs" title={t('common.close')} onClick={onClose}><X size={15} /></button>
      </div>
      <div className="find-filters">
        {FILTERS.map((f) => (
          <button key={f} className={'chip xs' + (filter === f ? ' on' : '')} onClick={() => (setFilter(f), setCur(0))}>{t(`find.f.${f}` as any)}</button>
        ))}
      </div>
      {(filter !== 'all' || q) && hits.length > 0 && (
        <div className="find-results">
          {hits.slice(0, 200).map((h, i) => (
            <button key={h.pos + ':' + i} className={'find-result' + (i === cur ? ' on' : '')} onClick={() => go(i)}>
              <small className="find-type">{t(`find.t.${h.type}` as any) || h.type}</small>
              <span className="ellipsis">{h.label || '—'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
