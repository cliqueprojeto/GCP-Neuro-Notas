/**
 * A IA do chat pode alterar a página aberta: recebe o HTML da página (sem as imagens pesadas,
 * trocadas por marcadores) e devolve a página inteira atualizada num bloco ```gcp-page```.
 * O usuário vê a proposta e decide aplicar (com desfazer).
 */
import { pageToHtml, htmlToDoc } from '../lib/transfer';
import type { Page } from '../lib/types';

export const MAX_EDIT_CHARS = 120_000;
const DATA_URL = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;

export interface PageForAi { html: string; assets: string[] }

export function pageForAi(p: Page): PageForAi {
  const assets: string[] = [];
  const html = pageToHtml(p).replace(DATA_URL, (m) => `gcp-asset:${assets.push(m) - 1}`);
  return { html, assets };
}

export function restoreAssets(html: string, assets: string[]): string {
  return html.replace(/gcp-asset:(\d+)/g, (m, n) => assets[+n] ?? m);
}

export const EDIT_INSTRUCTIONS =
  `\n\nYou can also EDIT the page that is open right now; its full HTML is inside <current_page>. ` +
  `When the user asks you to change, fix, normalize, reorganize, complete, translate, format or replace anything in this page ` +
  `(for example "normalize the tables", "replace the data with this", "fix the dates"), first explain in one or two short sentences what you changed, ` +
  `then output the COMPLETE updated page as HTML inside a fenced block that starts with \`\`\`gcp-page and ends with \`\`\`. ` +
  `Rules for the block: keep everything you were not asked to change exactly as it is — every tag, attribute and data-* attribute, ` +
  `image sources like gcp-asset:N, page links (<span data-type="pageLink" ...>), columns (<div data-type="columns">/<div data-type="column">), ` +
  `callouts, toggles and other custom blocks. Use plain HTML: h1-h3, p, strong, em, u, s, mark, a, ul/ol/li, ` +
  `<ul data-type="taskList"><li data-type="taskItem" data-checked="true|false"><p>…</p></li></ul>, ` +
  `tables as <table><tbody><tr><th><p>…</p></th>…</tr><tr><td><p>…</p></td>…</tr></tbody></table>. ` +
  `Do not output the block when the user only asks a question or wants an answer in the chat.`;

/** Separa o texto da resposta e a proposta de página (se houver). */
export function splitEdit(text: string): { text: string; html: string | null } {
  const m = text.match(/```gcp-page\s*\n([\s\S]*?)(```|$)/);
  if (!m) return { text, html: null };
  return { text: text.replace(m[0], '').trim(), html: m[1].trim() };
}

export function htmlToPageDoc(html: string, assets: string[]) {
  const doc = htmlToDoc(restoreAssets(html, assets));
  if (!doc.content?.length) doc.content = [{ type: 'paragraph' }];
  return doc;
}
