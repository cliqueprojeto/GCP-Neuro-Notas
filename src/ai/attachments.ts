/**
 * Anexos para a IA: imagens e PDF vão no formato nativo de cada provedor;
 * planilhas, Word, PowerPoint, CSV, JSON, Markdown e HTML viram texto aqui no aparelho.
 */
export interface AiAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  data?: string; // base64 (sem prefixo) — imagens e PDF
  text?: string; // conteúdo extraído localmente
}

export const MAX_ATTACH_MB = 15;
const TEXT_LIMIT = 60000;

const b64 = (buf: ArrayBuffer) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const stripXml = (xml: string, para = /<\/(w:p|a:p|p|div|br|li|tr|h\d)>/gi) =>
  xml.replace(para, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();

export async function readAttachment(f: File): Promise<AiAttachment> {
  if (f.size > MAX_ATTACH_MB * 1048576) throw new Error(`${f.name}: > ${MAX_ATTACH_MB} MB`);
  const name = f.name;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const mime = f.type || (ext === 'pdf' ? 'application/pdf' : '');
  const base = { id: Math.random().toString(36).slice(2), name, mime, size: f.size };
  const buf = await f.arrayBuffer();
  if (mime.startsWith('image/') || ext === 'pdf') return { ...base, mime: mime || 'application/pdf', data: b64(buf) };
  let text = '';
  if (['xlsx', 'xls', 'ods', 'csv', 'tsv'].includes(ext)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    text = wb.SheetNames.map((s) => `## ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s])}`).join('\n\n');
  } else if (ext === 'docx' || ext === 'pptx' || ext === 'odt') {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);
    if (ext === 'docx') text = stripXml((await zip.file('word/document.xml')?.async('string')) || '');
    else if (ext === 'odt') text = stripXml((await zip.file('content.xml')?.async('string')) || '', /<\/(text:p|text:h)>/gi);
    else {
      const slides = Object.keys(zip.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]));
      for (const [i, k] of slides.entries()) text += `## Slide ${i + 1}\n${stripXml((await zip.file(k)!.async('string')) || '')}\n\n`;
    }
  } else {
    text = new TextDecoder().decode(buf);
    if (/html?|xml|svg/.test(ext) || mime.includes('html')) text = stripXml(text);
  }
  if (text.length > TEXT_LIMIT) text = text.slice(0, TEXT_LIMIT) + '\n…(truncado)';
  return { ...base, text };
}

/** Texto que acompanha a pergunta quando o anexo não vai em formato nativo. */
export function attachmentText(a: AiAttachment, unsupported = false) {
  if (a.text != null) return `\n\n<file name="${a.name}">\n${a.text}\n</file>`;
  if (unsupported) return `\n\n[${a.name}: este provedor não lê ${a.mime.includes('pdf') ? 'PDF' : 'imagens'} — use Claude, Gemini ou OpenAI]`;
  return '';
}
