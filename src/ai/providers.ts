import { attachmentText, type AiAttachment } from './attachments';
import Anthropic from '@anthropic-ai/sdk';
import { netFetch } from '../lib/platform';
import type { AiProvider, AiProviderId } from '../lib/types';

export interface ProviderMeta {
  kind: AiProviderId;
  name: string;
  baseUrl: string;
  keyUrl: string;
  needsKey: boolean;
  hint: string;
}

export const PROVIDERS: ProviderMeta[] = [
  { kind: 'anthropic', name: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com', keyUrl: 'https://console.anthropic.com/settings/keys', needsKey: true, hint: 'sk-ant-…' },
  { kind: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', needsKey: true, hint: 'sk-…' },
  { kind: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/app/apikey', needsKey: true, hint: 'AIza…' },
  { kind: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', needsKey: true, hint: '' },
  { kind: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', needsKey: true, hint: 'gsk_…' },
  { kind: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', needsKey: true, hint: 'sk-…' },
  { kind: 'xai', name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai', needsKey: true, hint: 'xai-…' },
  { kind: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', needsKey: true, hint: 'sk-or-…' },
  { kind: 'ollama', name: 'Ollama (local)', baseUrl: 'http://localhost:11434', keyUrl: 'https://ollama.com/download', needsKey: false, hint: '' },
  { kind: 'custom', name: 'Compatível com OpenAI', baseUrl: 'http://localhost:1234/v1', keyUrl: '', needsKey: false, hint: '' },
];

export const providerMeta = (k: AiProviderId) => PROVIDERS.find((p) => p.kind === k)!;

/** Tenta reconhecer o provedor pelo formato da chave colada. */
export function guessProvider(key: string): AiProviderId | null {
  const k = key.trim();
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('xai-')) return 'xai';
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('sk-proj-') || k.startsWith('sk-svcacct-')) return 'openai';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

const base = (p: AiProvider) => (p.baseUrl || providerMeta(p.kind).baseUrl).replace(/\/+$/, '');

function anthropicClient(p: AiProvider) {
  return new Anthropic({
    apiKey: p.apiKey,
    baseURL: p.baseUrl || undefined,
    dangerouslyAllowBrowser: true,
    fetch: netFetch as any,
    maxRetries: 2,
  });
}

async function json(res: Response) {
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* resposta não JSON */
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || data?.message || text.slice(0, 300) || res.statusText;
    throw new Error(`${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

/** Lista os modelos disponíveis para a chave informada. */
export async function listModels(p: AiProvider): Promise<string[]> {
  switch (p.kind) {
    case 'anthropic': {
      const client = anthropicClient(p);
      const ids: string[] = [];
      for await (const m of client.models.list({ limit: 100 })) ids.push(m.id);
      return ids;
    }
    case 'gemini': {
      const data = await json(await netFetch(`${base(p)}/models?pageSize=200&key=${encodeURIComponent(p.apiKey)}`));
      return (data.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m: any) => String(m.name).replace(/^models\//, ''));
    }
    case 'ollama': {
      const data = await json(await netFetch(`${base(p)}/api/tags`));
      return (data.models || []).map((m: any) => m.name);
    }
    default: {
      const headers: Record<string, string> = {};
      if (p.apiKey) headers.Authorization = `Bearer ${p.apiKey}`;
      const data = await json(await netFetch(`${base(p)}/models`, { headers }));
      return (data.data || data.models || []).map((m: any) => m.id || m.name).filter(Boolean);
    }
  }
}

// ------------------------------------------------- escolha do melhor modelo

const EXCLUDE =
  /(embed|embedding|whisper|tts|audio|speech|transcri|dall-e|image|imagen|veo|vision-preview|moderation|realtime|rerank|guard|search-preview|computer-use|aqa|babbage|davinci|instruct|tokenizer|learnlm|native-audio|live|ocr|codestral-embed|sora|gpt-3\.5)/i;

function versionOf(id: string): number {
  const m = id.match(/(\d+(?:[.-]\d)?)/);
  if (!m) return 0;
  const v = parseFloat(m[1].replace('-', '.'));
  return v > 100 ? 0 : v; // descarta datas
}

function sizeOf(id: string): number {
  const m = id.toLowerCase().match(/(\d+(?:\.\d+)?)\s*b\b/);
  return m ? parseFloat(m[1]) : 0;
}

/** Pontuação heurística de capacidade. Maior = melhor para escrita e raciocínio. */
export function scoreModel(kind: AiProviderId, raw: string): number {
  const id = raw.toLowerCase();
  if (EXCLUDE.test(id)) return -1;
  let s = 0;
  const name = id.includes('/') ? id.split('/').pop()! : id;

  if (kind === 'ollama' || kind === 'custom') {
    // Modelos locais: o tamanho (parâmetros) é o melhor indicador de capacidade.
    s = 100 + Math.min(sizeOf(name), 700) * 2 + versionOf(name.replace(/:.*/, ''));
  } else if (/claude/.test(name)) {
    const ver = parseFloat((name.match(/(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d))?(?!\d)/) || []).slice(1).filter(Boolean).join('.') || '0') ||
      parseFloat((name.match(/claude-(\d(?:-\d)?)/)?.[1] || '0').replace('-', '.'));
    const tier = /opus/.test(name) ? 400 : /fable|mythos/.test(name) ? 390 : /sonnet/.test(name) ? 300 : /haiku/.test(name) ? 150 : 100;
    s = tier + ver * 10;
  } else if (/^(gpt|chatgpt|o\d)/.test(name)) {
    const isO = /^o\d/.test(name);
    const ver = isO ? 4.5 + parseFloat(name.slice(1)) / 10 : versionOf(name);
    s = 200 + ver * 30;
    if (/-pro\b/.test(name)) s += 8;
    if (/chatgpt/.test(name)) s -= 15;
  } else if (/gemini/.test(name)) {
    s = 200 + versionOf(name.replace('gemini-', '')) * 30 + (/pro/.test(name) ? 40 : /flash-lite/.test(name) ? 0 : /flash/.test(name) ? 20 : 0);
    if (/exp|experimental/.test(name)) s -= 10;
    if (/gemma/.test(name)) s -= 120;
  } else if (/mistral|magistral|ministral|pixtral|codestral|devstral/.test(name)) {
    s = 200 + (/large/.test(name) ? 60 : /medium/.test(name) ? 40 : /magistral/.test(name) ? 50 : /small/.test(name) ? 15 : 0);
    if (/latest/.test(name)) s += 5;
    if (/codestral|devstral|pixtral/.test(name)) s -= 25;
  } else if (/grok/.test(name)) {
    s = 200 + versionOf(name) * 25 + (/fast|mini/.test(name) ? -15 : 0);
  } else if (/deepseek/.test(name)) {
    s = 230 + (/reasoner|r1/.test(name) ? 10 : 0) + versionOf(name.replace('deepseek', '')) * 5;
  } else {
    s = 150 + Math.min(sizeOf(name), 700) / 4 + versionOf(name) * 3;
  }

  if (/(^|[-_.])(nano|tiny)([-_.]|$)/.test(name)) s -= 70;
  else if (/(^|[-_.])(mini|lite|small|instant)([-_.]|$)/.test(name)) s -= 40;
  if (/preview/.test(name)) s -= 4;
  if (/\d{4}-?\d{2}-?\d{2}|\d{8}|-\d{4}$/.test(name)) s -= 2; // prefere aliases estáveis
  if (/:free$/.test(id)) s -= 30;
  if (kind === 'openrouter' && /^(anthropic|openai|google|x-ai|mistralai|deepseek)\//.test(id)) s += 5;
  return s;
}

export function rankModels(kind: AiProviderId, ids: string[]): string[] {
  return [...new Set(ids)]
    .map((id) => ({ id, s: scoreModel(kind, id) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.id.localeCompare(b.id))
    .map((x) => x.id);
}

export const FALLBACK_MODEL: Partial<Record<AiProviderId, string>> = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5',
  gemini: 'gemini-2.5-pro',
  mistral: 'mistral-large-latest',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  xai: 'grok-4',
  openrouter: 'anthropic/claude-opus-5-5',
};

/** Testa a chave, lista e ordena os modelos e devolve o provedor atualizado. */
export async function detectBestModel(p: AiProvider): Promise<AiProvider> {
  const ids = await listModels(p);
  const ranked = rankModels(p.kind, ids);
  const best = ranked[0] || FALLBACK_MODEL[p.kind] || ids[0];
  return { ...p, models: ranked.length ? ranked : ids, model: p.autoModel === false && p.model ? p.model : best, checkedAt: Date.now() };
}

// -------------------------------------------------------------- conversa

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: AiAttachment[];
}

const isImg = (a: AiAttachment) => a.mime.startsWith('image/') && !!a.data;
const isPdf = (a: AiAttachment) => a.mime.includes('pdf') && !!a.data;
/** Junta ao texto os anexos que não vão em formato nativo. */
const withText = (m: ChatMessage, native: (a: AiAttachment) => boolean) =>
  m.content + (m.attachments || []).filter((a) => !native(a)).map((a) => attachmentText(a, !!a.data)).join('');

export async function chat(p: AiProvider, system: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const model = p.model || FALLBACK_MODEL[p.kind] || '';
  switch (p.kind) {
    case 'anthropic': {
      const client = anthropicClient(p);
      const msgs = messages.map((m) => {
        if (!m.attachments?.length || m.role !== 'user') return { role: m.role, content: m.content };
        const blocks: any[] = [];
        for (const a of m.attachments) {
          if (isImg(a)) blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mime, data: a.data } });
          else if (isPdf(a)) blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data }, title: a.name });
        }
        blocks.push({ type: 'text', text: withText(m, (a) => isImg(a) || isPdf(a)) });
        return { role: m.role, content: blocks };
      });
      const res = await client.messages.create({ model, max_tokens: 16000, system, messages: msgs as any }, { signal });
      if (res.stop_reason === 'refusal') throw new Error('refusal');
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
    }
    case 'gemini': {
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [
            ...(m.attachments || []).filter((a) => isImg(a) || isPdf(a)).map((a) => ({ inline_data: { mime_type: a.mime, data: a.data } })),
            { text: withText(m, (a) => isImg(a) || isPdf(a)) },
          ],
        })),
      };
      const data = await json(
        await netFetch(`${base(p)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        }),
      );
      return (data.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join('').trim();
    }
    case 'ollama': {
      const data = await json(
        await netFetch(`${base(p)}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            stream: false,
            messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: withText(m, isImg), ...(m.attachments?.some(isImg) ? { images: m.attachments.filter(isImg).map((a) => a.data) } : {}) }))],
          }),
          signal,
        }),
      );
      return String(data.message?.content || '').trim();
    }
    default: {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (p.apiKey) headers.Authorization = `Bearer ${p.apiKey}`;
      if (p.kind === 'openrouter') {
        headers['HTTP-Referer'] = 'https://github.com/cliqueprojeto/GCP-Neuro-Notas';
        headers['X-Title'] = 'GCP-Neuro Notas';
      }
      const data = await json(
        await netFetch(`${base(p)}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              ...messages.map((m) => {
                if (!m.attachments?.length || m.role !== 'user') return { role: m.role, content: m.content };
                // OpenAI/OpenRouter leem PDF como arquivo; demais provedores compatíveis recebem imagens
                const pdfOk = p.kind === 'openai' || p.kind === 'openrouter';
                const native = (a: AiAttachment) => isImg(a) || (pdfOk && isPdf(a));
                return {
                  role: m.role,
                  content: [
                    { type: 'text', text: withText(m, native) },
                    ...m.attachments.filter(native).map((a) =>
                      isImg(a) ? { type: 'image_url', image_url: { url: `data:${a.mime};base64,${a.data}` } } : { type: 'file', file: { filename: a.name, file_data: `data:application/pdf;base64,${a.data}` } },
                    ),
                  ],
                };
              }),
            ],
          }),
          signal,
        }),
      );
      const c = data.choices?.[0]?.message?.content;
      return (Array.isArray(c) ? c.map((x: any) => x.text || '').join('') : String(c || '')).trim();
    }
  }
}
