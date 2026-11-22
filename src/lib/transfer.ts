/** Exportação/importação: backup criptografado, Markdown, HTML e pacote para IA. */
import { marked } from 'marked';
import TurndownService from 'turndown';
import { generateHTML, generateJSON } from '@tiptap/core';
import { decryptBackup, encryptBackup, uid, type BackupFile } from './crypto';
import { APP_VERSION, pickTextFiles, saveTextFile } from './platform';
import type { Page } from './types';
import { useVault, livePages } from '../store/vault';
import { pageText } from './doc';
import { exportExtensions } from '../editor/extensions';

export async function exportBackup(password: string): Promise<string | null> {
  const payload = useVault.getState().exportPlain();
  const file = await encryptBackup(payload, password, APP_VERSION);
  const d = new Date().toISOString().slice(0, 10);
  return saveTextFile(`GCP-Notas-backup-${d}.gcpnotes`, JSON.stringify(file), [{ name: 'GCP Notas backup', extensions: ['gcpnotes'] }]);
}

export async function pickBackupFile(): Promise<BackupFile | null> {
  const files = await pickTextFiles([{ name: 'GCP Notas backup', extensions: ['gcpnotes', 'json'] }]);
  if (!files.length) return null;
  const data = JSON.parse(files[0].text);
  if (data.format !== 'gcp-notas-backup') throw new Error('invalid-format');
  return data;
}

export async function importBackup(file: BackupFile, password: string, mode: 'merge' | 'replace') {
  const payload = await decryptBackup<{ pages: Page[] }>(file, password);
  await useVault.getState().importPages(payload.pages, mode);
  return payload.pages.length;
}

// ------------------------------------------------------------- Markdown

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
td.addRule('taskItem', {
  filter: (n) => n.nodeName === 'LI' && (n as HTMLElement).dataset.type === 'taskItem',
  replacement: (content, node) => `- [${(node as HTMLElement).dataset.checked === 'true' ? 'x' : ' '}] ${content.trim()}\n`,
});
td.addRule('pageLink', {
  filter: (n) => n.nodeName === 'SPAN' && (n as HTMLElement).dataset.type === 'pageLink',
  replacement: (_c, node) => `[[${(node as HTMLElement).dataset.label || ''}]]`,
});

export function pageToHtml(p: Page): string {
  if (!p.content) return '';
  try {
    return generateHTML(p.content, exportExtensions());
  } catch {
    return '';
  }
}

export function pageToMarkdown(p: Page, pages: Record<string, Page>): string {
  let md = `# ${p.icon && !p.icon.startsWith('lucide:') ? p.icon + ' ' : ''}${p.title || ''}\n\n`;
  if (p.tags?.length) md += p.tags.map((t) => `#${t}`).join(' ') + '\n\n';
  if (p.type === 'database' && p.db) {
    const props = p.db.properties.filter((x) => x.type !== 'password');
    md += `| ${props.map((x) => x.name).join(' | ')} |\n| ${props.map(() => '---').join(' | ')} |\n`;
    for (const r of p.db.rows) {
      md +=
        '| ' +
        props
          .map((x) => {
            const v = r.cells[x.id];
            if (Array.isArray(v)) return v.map((id) => x.options?.find((o) => o.id === id)?.label ?? '').join(', ');
            if (x.type === 'select' || x.type === 'status') return x.options?.find((o) => o.id === v)?.label ?? '';
            if (x.type === 'checkbox') return v ? '✔' : '';
            return String(v ?? '').replace(/\|/g, '\\|');
          })
          .join(' | ') +
        ' |\n';
    }
    return md;
  }
  md += td.turndown(pageToHtml(p));
  const kids = livePages(pages).filter((c) => c.parentId === p.id);
  if (kids.length) md += `\n\n---\n${kids.map((k) => `- [[${k.title}]]`).join('\n')}\n`;
  return md;
}

export function markdownToDoc(md: string) {
  // [[links]] viram texto marcado para depois serem ligados às páginas certas.
  const html = marked.parse(md.replace(/\[\[([^\]]+)\]\]/g, '<span data-type="pageLink" data-label="$1"></span>'), { async: false }) as string;
  return htmlToDoc(html);
}

export function htmlToDoc(html: string) {
  return generateJSON(html, exportExtensions());
}

export async function exportPageFile(p: Page, format: 'md' | 'html') {
  const pages = useVault.getState().pages;
  const name = (p.title || 'pagina').replace(/[\\/:*?"<>|]+/g, '-');
  if (format === 'md') return saveTextFile(`${name}.md`, pageToMarkdown(p, pages), [{ name: 'Markdown', extensions: ['md'] }]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(p.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1f2330}
table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px}img{max-width:100%}blockquote{border-left:3px solid #8b5cf6;margin:0;padding-left:14px;color:#555}</style>
</head><body><h1>${escapeHtml(p.icon && !p.icon.startsWith('lucide:') ? p.icon + ' ' : '')}${escapeHtml(p.title)}</h1>${pageToHtml(p)}</body></html>`;
  return saveTextFile(`${name}.html`, html, [{ name: 'HTML', extensions: ['html'] }]);
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Importa arquivos Markdown/TXT/HTML (ex.: um cofre do Obsidian) como páginas. */
export async function importFiles(parentId: string | null): Promise<number> {
  const files = await pickTextFiles([{ name: 'Markdown / Texto / HTML', extensions: ['md', 'markdown', 'txt', 'html', 'htm'] }], true);
  if (!files.length) return 0;
  const v = useVault.getState();
  const created: Page[] = [];
  for (const f of files) {
    const title = f.name.replace(/\.(md|markdown|txt|html?)$/i, '');
    let content;
    if (/\.html?$/i.test(f.name)) content = htmlToDoc(f.text);
    else if (/\.txt$/i.test(f.name)) content = htmlToDoc(f.text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join(''));
    else content = markdownToDoc(f.text.replace(/^---[\s\S]*?---\s*/, ''));
    created.push(v.createPage({ title, content, parentId, icon: '📝' }));
  }
  // Liga os [[links]] pelo título, agora que todas as páginas existem.
  const byTitle = new Map(livePages(useVault.getState().pages).map((p) => [p.title.toLowerCase(), p.id]));
  for (const p of created) {
    const fixed = linkByTitle(p.content, byTitle);
    if (fixed.changed) useVault.getState().updatePage(p.id, { content: fixed.doc });
  }
  return created.length;
}

function linkByTitle(doc: any, byTitle: Map<string, string>) {
  let changed = false;
  const walk = (n: any): any => {
    if (n?.type === 'pageLink' && !n.attrs?.id && n.attrs?.label) {
      let id = byTitle.get(String(n.attrs.label).toLowerCase());
      if (!id) {
        const np = useVault.getState().createPage({ title: n.attrs.label, icon: '📝' });
        id = np.id;
        byTitle.set(n.attrs.label.toLowerCase(), id);
      }
      changed = true;
      return { ...n, attrs: { ...n.attrs, id } };
    }
    if (n?.content) return { ...n, content: n.content.map(walk) };
    return n;
  };
  return { doc: walk(doc), changed };
}

/** Pacote em Markdown para usar as notas como contexto em qualquer IA (ChatGPT, Claude, Gemini…). */
export async function exportAiContext(selection?: string[]) {
  const pages = useVault.getState().pages;
  const list = livePages(pages).filter((p) => !selection || selection.includes(p.id));
  const date = new Date().toISOString().slice(0, 10);
  let out = `# GCP Notas — base de conhecimento (${date})\n\n`;
  out += `> ${list.length} notas. Links entre notas aparecem como [[Título]].\n\n## Índice\n\n`;
  out += list.map((p) => `- [[${p.title || 'Sem título'}]]${p.tags?.length ? ' — ' + p.tags.map((t) => '#' + t).join(' ') : ''}`).join('\n');
  for (const p of list) {
    out += `\n\n---\n\n`;
    out += p.type === 'page' ? pageToMarkdown(p, pages) : `# ${p.title}\n\n${pageText(p)}`;
  }
  return saveTextFile(`GCP-Notas-contexto-IA-${date}.md`, out, [{ name: 'Markdown', extensions: ['md'] }]);
}

export function newId() {
  return uid('x');
}
