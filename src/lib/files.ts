/** Anexos: leitura, ícone contextual por tipo, tamanho legível, abrir e baixar. */
import { File, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation } from 'lucide-react';
import type { FileRef } from './types';
import { uid } from './crypto';
import { saveBinaryFile } from './platform';

export const MAX_FILE_MB = 25;

export function pickFiles(multiple = true, accept = ''): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    if (accept) input.accept = accept;
    input.onchange = () => resolve(Array.from(input.files || []));
    input.click();
  });
}

export async function toFileRef(f: File): Promise<FileRef> {
  if (f.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${f.name}: > ${MAX_FILE_MB} MB`);
  const data = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
  return { id: uid('f'), name: f.name, type: f.type || guessType(f.name), size: f.size, data, addedAt: Date.now() };
}

const guessType = (name: string) => {
  const e = name.split('.').pop()?.toLowerCase() || '';
  return ({ pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', zip: 'application/zip' } as Record<string, string>)[e] || 'application/octet-stream';
};

export function fileKind(f: { type: string; name: string }) {
  const t = f.type, e = f.name.split('.').pop()?.toLowerCase() || '';
  if (t.startsWith('image/')) return { icon: FileImage, color: '#ec4899', label: 'IMG' };
  if (t.startsWith('video/')) return { icon: FileVideo, color: '#8b5cf6', label: 'VID' };
  if (t.startsWith('audio/')) return { icon: FileAudio, color: '#f59e0b', label: 'AUD' };
  if (t === 'application/pdf' || e === 'pdf') return { icon: FileText, color: '#ef4444', label: 'PDF' };
  if (/sheet|excel|csv/.test(t) || ['xlsx', 'xls', 'csv', 'ods'].includes(e)) return { icon: FileSpreadsheet, color: '#16a34a', label: e.toUpperCase() || 'XLS' };
  if (/presentation|powerpoint/.test(t) || ['pptx', 'ppt', 'odp', 'key'].includes(e)) return { icon: Presentation, color: '#f97316', label: e.toUpperCase() || 'PPT' };
  if (/word|document|rtf/.test(t) || ['docx', 'doc', 'odt', 'rtf'].includes(e)) return { icon: FileText, color: '#2563eb', label: e.toUpperCase() || 'DOC' };
  if (/zip|rar|7z|tar|gzip/.test(t) || ['zip', 'rar', '7z', 'gz', 'tar'].includes(e)) return { icon: FileArchive, color: '#64748b', label: e.toUpperCase() };
  if (/json|javascript|xml|html|css|typescript/.test(t) || ['js', 'ts', 'json', 'py', 'html', 'css', 'xml', 'java'].includes(e)) return { icon: FileCode, color: '#0ea5e9', label: e.toUpperCase() };
  if (t.startsWith('text/')) return { icon: FileText, color: '#475569', label: e.toUpperCase() || 'TXT' };
  return { icon: File, color: '#64748b', label: e.toUpperCase() || 'FILE' };
}

export const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

export async function downloadFile(f: FileRef) {
  const ext = f.name.includes('.') ? f.name.split('.').pop()! : 'bin';
  return saveBinaryFile(f.name, f.data.split(',')[1] || '', [{ name: ext.toUpperCase(), extensions: [ext] }]);
}

/** Abre o anexo numa nova janela (imagens, PDF, áudio, vídeo, texto); outros tipos são baixados. */
export function openFile(f: FileRef) {
  if (/^(image|video|audio|text)\//.test(f.type) || f.type === 'application/pdf') {
    try {
      const bin = atob(f.data.split(',')[1] || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: f.type }));
      const w = window.open(url, '_blank');
      if (w) return setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { /* cai no download */ }
  }
  void downloadFile(f);
}
