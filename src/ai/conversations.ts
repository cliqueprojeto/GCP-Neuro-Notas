/**
 * Conversas com a IA salvas como páginas (pasta "Conversas com IA").
 * O conteúdo da página traz links [[ ]] para as notas citadas e para a página de
 * contexto, então cada conversa aparece ligada às ideias no Grafo.
 */
import type { Page } from '../lib/types';
import { useVault, livePages } from '../store/vault';
import { mdToHtml } from './assist';
import { htmlToDoc, escapeHtml } from '../lib/transfer';
import { normalize } from '../lib/doc';
import { t } from '../i18n';

export interface SavedMsg {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

const linkSpan = (p: Page) => `<span data-type="pageLink" data-id="${p.id}" data-label="${escapeHtml(p.title || '…')}">${escapeHtml(p.title || '…')}</span>`;

export function conversationsRoot(create = true): Page | null {
  const v = useVault.getState();
  const pages = livePages(v.pages);
  const root = pages.find((p) => p.parentId === null && p.tags?.includes('ia-conversas')) || pages.find((p) => p.parentId === null && p.title === t('chat.root'));
  if (root || !create) return root || null;
  return v.createPage({ title: t('chat.root'), icon: '💬', tags: ['ia-conversas'], cover: 'g:1', content: htmlToDoc(`<p>${escapeHtml(t('chat.rootText'))}</p>`) });
}

export function listConversations(): Page[] {
  return livePages(useVault.getState().pages)
    .filter((p) => p.chat?.messages?.length)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function toDoc(msgs: SavedMsg[], context: Page | null) {
  const pages = useVault.getState().pages;
  const byTitle = new Map(livePages(pages).map((p) => [normalize(p.title || ''), p]));
  let html = '';
  if (context) html += `<p>📎 ${escapeHtml(t('chat.context'))}: ${linkSpan(context)}</p>`;
  for (const m of msgs) {
    if (m.role === 'user') {
      html += `<h3>🙋 ${escapeHtml(m.content.split('\n')[0].slice(0, 140))}</h3>`;
      if (m.content.includes('\n')) html += `<p>${escapeHtml(m.content).replace(/\n/g, '<br>')}</p>`;
      continue;
    }
    // [[Título]] na resposta vira link de verdade (aparece no Grafo e nos backlinks).
    const body = mdToHtml(m.content).replace(/\[\[([^\]]+)\]\]/g, (all, title) => {
      const p = byTitle.get(normalize(title));
      return p ? linkSpan(p) : all;
    });
    html += `<div data-type="callout" data-emoji="✨" data-tone="purple">${escapeHtml(t('chat.answer'))}</div>${body}`;
    const src = (m.sources || []).map((id) => pages[id]).filter((p) => p && !p.deletedAt);
    if (src.length) html += `<p><em>${escapeHtml(t('chat.sources'))}:</em> ${src.map(linkSpan).join(', ')}</p>`;
    html += '<hr>';
  }
  return htmlToDoc(html);
}

/** Cria ou atualiza a página da conversa. Devolve o id. */
export function saveConversation(id: string | null, msgs: SavedMsg[], provider: string, context: Page | null): string {
  const v = useVault.getState();
  const firstQ = msgs.find((m) => m.role === 'user')?.content || t('chat.untitled');
  const title = '💬 ' + firstQ.replace(/\s+/g, ' ').slice(0, 70);
  const chat = { messages: msgs, provider, contextId: context?.id };
  const content = toDoc(msgs, context);
  const existing = id ? v.pages[id] : null;
  if (existing && !existing.deletedAt) {
    v.updatePage(existing.id, { chat, content });
    return existing.id;
  }
  const root = conversationsRoot()!;
  const page = v.createPage({ title: title.replace(/^💬 /, ''), icon: '💬', parentId: root.id, tags: ['ia'], chat, content });
  return page.id;
}
