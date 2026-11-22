/**
 * "Segundo cérebro": recuperação local de trechos relevantes das notas
 * (BM25, sem enviar nada até o usuário perguntar) e notas relacionadas.
 */
import { normalize, pageText, outgoingLinks } from '../lib/doc';
import type { Page } from '../lib/types';
import { chat, type ChatMessage } from './providers';
import type { AiProvider } from '../lib/types';

const STOP = new Set(
  (
    'a o os as um uma de da do das dos e em no na nos nas por para com sem que se ao à é ser foi são como mais mas ou ' +
    'the of and to in is for on with as at by an be this that it from are was or not ' +
    'el la los las un una y en del al por para con que es se lo como más pero su sus'
  ).split(' '),
);

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9#]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

interface Chunk {
  page: Page;
  text: string;
  tokens: string[];
}

function chunks(pages: Page[], size = 900): Chunk[] {
  const out: Chunk[] = [];
  for (const p of pages) {
    const text = pageText(p);
    if (!text.trim()) continue;
    const paras = text.split(/\n+/);
    let buf = '';
    for (const para of paras) {
      if ((buf + para).length > size && buf) {
        out.push({ page: p, text: buf.trim(), tokens: tokenize(p.title + ' ' + buf) });
        buf = '';
      }
      buf += para + '\n';
    }
    if (buf.trim()) out.push({ page: p, text: buf.trim(), tokens: tokenize(p.title + ' ' + buf) });
  }
  return out;
}

export function retrieve(pages: Page[], query: string, k = 8, budget = 14000): Chunk[] {
  const all = chunks(pages);
  const q = tokenize(query);
  if (!q.length || !all.length) return [];
  const N = all.length;
  const avg = all.reduce((s, c) => s + c.tokens.length, 0) / N;
  const df = new Map<string, number>();
  for (const c of all) for (const t of new Set(c.tokens)) df.set(t, (df.get(t) || 0) + 1);
  const scored = all.map((c) => {
    const tf = new Map<string, number>();
    for (const t of c.tokens) tf.set(t, (tf.get(t) || 0) + 1);
    let s = 0;
    for (const t of q) {
      const f = tf.get(t) || 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
      s += (idf * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (c.tokens.length / avg)));
    }
    if (q.some((t) => normalize(c.page.title).includes(t))) s *= 1.5;
    return { c, s };
  });
  const out: Chunk[] = [];
  let used = 0;
  for (const { c, s } of scored.sort((a, b) => b.s - a.s)) {
    if (s <= 0 || out.length >= k) break;
    if (used + c.text.length > budget) continue;
    out.push(c);
    used += c.text.length;
  }
  return out;
}

export interface BrainAnswer {
  text: string;
  sources: Page[];
}

export async function askBrain(
  provider: AiProvider,
  pages: Page[],
  history: ChatMessage[],
  question: string,
  langName: string,
  current?: Page | null,
  signal?: AbortSignal,
): Promise<BrainAnswer> {
  const found = retrieve(pages, question + ' ' + (current?.title || ''));
  if (current && !found.some((f) => f.page.id === current.id)) {
    const t = pageText(current);
    if (t) found.unshift({ page: current, text: t.slice(0, 6000), tokens: [] });
  }
  const context = found.map((c) => `### [[${c.page.title || 'Sem título'}]]\n${c.text}`).join('\n\n');
  const system =
    `You are the assistant built into GCP-Neuro Notas, acting as the user's second brain. ` +
    `Answer in ${langName}. Use the user's notes below as your primary source. ` +
    `When you use information from a note, cite it inline as [[Note title]] exactly as written. ` +
    `If the notes do not contain the answer, say so briefly and then answer from general knowledge, making the distinction clear. ` +
    `Format with Markdown (short paragraphs, lists and tables when useful).\n\n` +
    `<notes>\n${context || '(no matching notes)'}\n</notes>`;
  const text = await chat(provider, system, [...history, { role: 'user', content: question }], signal);
  const seen = new Set<string>();
  const sources = found.map((f) => f.page).filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  return { text, sources };
}

/** Notas parecidas por conteúdo (TF-IDF + cosseno), para conectar ideias. */
export function relatedPages(pages: Page[], target: Page, k = 6): { page: Page; score: number }[] {
  const docs = pages.filter((p) => !p.deletedAt && !p.purged);
  const toks = new Map(docs.map((p) => [p.id, tokenize(pageText(p))]));
  const df = new Map<string, number>();
  for (const t of toks.values()) for (const w of new Set(t)) df.set(w, (df.get(w) || 0) + 1);
  const N = docs.length;
  const vec = (id: string) => {
    const tf = new Map<string, number>();
    for (const w of toks.get(id) || []) tf.set(w, (tf.get(w) || 0) + 1);
    const v = new Map<string, number>();
    let norm = 0;
    for (const [w, f] of tf) {
      const x = (1 + Math.log(f)) * Math.log(1 + N / (df.get(w) || 1));
      v.set(w, x);
      norm += x * x;
    }
    return { v, norm: Math.sqrt(norm) || 1 };
  };
  const a = vec(target.id);
  const linked = new Set(outgoingLinks(target));
  return docs
    .filter((p) => p.id !== target.id)
    .map((p) => {
      const b = vec(p.id);
      let dot = 0;
      for (const [w, x] of a.v) dot += x * (b.v.get(w) || 0);
      return { page: p, score: dot / (a.norm * b.norm) + (linked.has(p.id) ? 0.05 : 0) };
    })
    .filter((x) => x.score > 0.06)
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}

/** Páginas que citam o título desta página sem link (menções não vinculadas). */
export function unlinkedMentions(pages: Page[], target: Page): Page[] {
  const title = normalize(target.title || '').trim();
  if (title.length < 3) return [];
  return pages.filter(
    (p) => p.id !== target.id && !p.deletedAt && !p.purged && !outgoingLinks(p).includes(target.id) && normalize(pageText(p)).includes(title),
  );
}
