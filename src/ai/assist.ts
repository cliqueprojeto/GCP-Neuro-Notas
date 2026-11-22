import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useVault } from '../store/vault';
import { resolvedLang } from '../store/prefs';
import { chat } from './providers';
import type { AiProvider } from '../lib/types';

export const LANG_NAMES = { pt: 'Brazilian Portuguese', en: 'English', es: 'Spanish' } as const;

export function activeProvider(): AiProvider | null {
  const { providers, activeProvider } = useVault.getState().settings.ai;
  return providers.find((p) => p.id === activeProvider) || providers[0] || null;
}

export type AiAction = 'improve' | 'fix' | 'shorter' | 'longer' | 'summarize' | 'explain' | 'continue' | 'actions' | 'translate' | 'tone' | 'outline' | 'title' | 'tags';

const INSTRUCTIONS: Record<AiAction, string> = {
  improve: 'Rewrite the text to be clearer, more fluent and more engaging, keeping the meaning and the language of the original.',
  fix: 'Fix spelling, grammar and punctuation. Keep the wording and the language. Return only the corrected text.',
  shorter: 'Make the text noticeably shorter while keeping the key information. Keep the language.',
  longer: 'Expand the text with more detail, examples and explanation. Keep the language and tone.',
  summarize: 'Summarize the text in a few bullet points followed by a one-sentence conclusion.',
  explain: 'Explain the text in simple terms, as if to a smart beginner.',
  continue: 'Continue writing from where the text ends, matching style, language and tone. Return only the continuation.',
  actions: 'Extract the action items from the text as a Markdown task list ("- [ ] ..."), with owners and dates when mentioned.',
  translate: 'Translate the text into {target}. Return only the translation.',
  tone: 'Rewrite the text in a {target} tone. Keep the language.',
  outline: 'Create a well-structured outline (Markdown headings and bullets) for a document about the text.',
  title: 'Suggest one short, descriptive title for this note. Return only the title, no quotes.',
  tags: 'Suggest up to 5 short lowercase tags (single words or hyphenated) for this note, comma-separated. Return only the tags.',
};

export async function runAction(action: AiAction, text: string, target = ''): Promise<string> {
  const p = activeProvider();
  if (!p) throw new Error('no-provider');
  const lang = LANG_NAMES[resolvedLang()];
  const system =
    `You are a writing assistant inside the GCP-Neuro Notas app. ${INSTRUCTIONS[action].replace('{target}', target)} ` +
    `Use Markdown formatting when it helps. Do not add preambles like "Here is". If you need to choose a language and the text has none, use ${lang}.`;
  return chat(p, system, [{ role: 'user', content: text || '(empty)' }]);
}

export async function generate(prompt: string, context = ''): Promise<string> {
  const p = activeProvider();
  if (!p) throw new Error('no-provider');
  const lang = LANG_NAMES[resolvedLang()];
  const system =
    `You are a writing assistant inside the GCP-Neuro Notas app. Write what the user asks, in ${lang} unless they ask otherwise. ` +
    `Use Markdown: headings, lists, tables and task lists ("- [ ]") when useful. No preambles.` +
    (context ? `\n\nCurrent note for context:\n<note>\n${context.slice(0, 12000)}\n</note>` : '');
  return chat(p, system, [{ role: 'user', content: prompt }]);
}

export function mdToHtml(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  // Listas de tarefas do Markdown viram listas de tarefas do editor.
  const tasks = html
    .replace(/<ul>\s*(<li>\s*<input[^>]*type="checkbox"[\s\S]*?)<\/ul>/g, (_m, inner) => `<ul data-type="taskList">${inner}</ul>`)
    .replace(/<li>\s*<input([^>]*)type="checkbox"([^>]*)>\s*/g, (_m, a, b) => `<li data-type="taskItem" data-checked="${/checked/.test(a + b)}">`);
  return DOMPurify.sanitize(tasks, { ADD_ATTR: ['data-type', 'data-checked'] });
}
