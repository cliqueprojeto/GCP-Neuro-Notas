/**
 * Geração de imagens (capas) com a chave de IA do próprio usuário.
 * Funciona com OpenAI (gpt-image-1 / DALL·E 3), Google Gemini (imagem nativa) e OpenRouter.
 */
import { useVault } from '../store/vault';
import { netFetch } from '../lib/platform';
import { base, json } from './providers';
import type { AiProvider } from '../lib/types';

const ORDER = ['openai', 'gemini', 'openrouter'] as const;

/** Provedores configurados que sabem gerar imagem (na ordem de preferência). */
export function imageProviders(): AiProvider[] {
  const { providers, activeProvider } = useVault.getState().settings.ai;
  const ok = providers.filter((p) => (ORDER as readonly string[]).includes(p.kind) && p.apiKey);
  return ok.sort((a, b) => (a.id === activeProvider ? -1 : b.id === activeProvider ? 1 : ORDER.indexOf(a.kind as any) - ORDER.indexOf(b.kind as any)));
}

export class NoImageProvider extends Error {
  constructor() {
    super('no-image-provider');
  }
}

async function openai(p: AiProvider, prompt: string, wide: boolean): Promise<string> {
  const post = (body: any) =>
    netFetch(`${base(p)}/images/generations`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` }, body: JSON.stringify(body) });
  try {
    const d = await json(await post({ model: 'gpt-image-1', prompt, size: wide ? '1536x1024' : '1024x1024', n: 1 }));
    const b64 = d.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    if (d.data?.[0]?.url) return d.data[0].url;
  } catch (e) {
    // Contas sem gpt-image-1: tenta o DALL·E 3.
    if (!/model|verified|organization|404|403/i.test(String((e as Error).message))) throw e;
  }
  const d = await json(await post({ model: 'dall-e-3', prompt, size: wide ? '1792x1024' : '1024x1024', n: 1, response_format: 'b64_json' }));
  return `data:image/png;base64,${d.data[0].b64_json}`;
}

async function gemini(p: AiProvider, prompt: string): Promise<string> {
  let last: unknown;
  for (const model of ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview', 'gemini-2.0-flash-preview-image-generation']) {
    try {
      const d = await json(
        await netFetch(`${base(p)}/models/${model}:generateContent?key=${encodeURIComponent(p.apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
        }),
      );
      const part = (d.candidates?.[0]?.content?.parts || []).find((x: any) => x.inlineData || x.inline_data);
      const inl = part?.inlineData || part?.inline_data;
      if (inl?.data) return `data:${inl.mimeType || inl.mime_type || 'image/png'};base64,${inl.data}`;
      last = new Error('sem imagem na resposta');
    } catch (e) {
      last = e;
      if (!/404|not found|not supported|model/i.test(String((e as Error).message))) throw e;
    }
  }
  throw last;
}

async function openrouter(p: AiProvider, prompt: string): Promise<string> {
  const d = await json(
    await netFetch(`${base(p)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash-image', modalities: ['image', 'text'], messages: [{ role: 'user', content: prompt }] }),
    }),
  );
  const url = d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('sem imagem na resposta');
  return url;
}

/** Gera uma imagem e devolve uma data URL (ou URL). */
export async function generateImage(prompt: string, opts: { wide?: boolean } = {}): Promise<string> {
  const list = imageProviders();
  if (!list.length) throw new NoImageProvider();
  const full = opts.wide ? `${prompt}\n\nWide horizontal banner composition (landscape), no text or letters unless explicitly requested, high quality.` : prompt;
  let last: unknown;
  for (const p of list) {
    try {
      if (p.kind === 'openai') return await openai(p, full, !!opts.wide);
      if (p.kind === 'gemini') return await gemini(p, full);
      return await openrouter(p, full);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
