/** QR Codes: conteúdo de cada tipo (link, texto, e-mail, telefone, SMS, WhatsApp, Wi-Fi, Pix, vCard) e geração estilizada. */
export type QrKind = 'link' | 'text' | 'email' | 'phone' | 'sms' | 'whatsapp' | 'wifi' | 'pix' | 'vcard';
export const QR_KINDS: QrKind[] = ['link', 'text', 'email', 'phone', 'sms', 'whatsapp', 'wifi', 'pix', 'vcard'];
export type QrDots = 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
export type QrCorners = 'square' | 'extra-rounded' | 'dot';
export const QR_DOTS: QrDots[] = ['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'];
export const QR_CORNERS: QrCorners[] = ['square', 'extra-rounded', 'dot'];

export interface QrStyle { fg: string; bg: string; dots: QrDots; corners: QrCorners; logo?: string; gradient?: boolean }
export type QrFields = Record<string, string>;

const digits = (s = '') => s.replace(/\D/g, '');
const wifiEsc = (s = '') => s.replace(/([\\;,:"])/g, '\\$1');
const vEsc = (s = '') => s.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');

/* ---------- Pix (BR Code estático, padrão EMV do Banco Central) ---------- */
const tlv = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v;
function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
const ascii = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');
export function pixPayload(f: { key?: string; name?: string; city?: string; amount?: string; txid?: string; message?: string }) {
  let key = (f.key || '').trim();
  // telefone sem +55 vira +55…; CPF/CNPJ só dígitos
  if (/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(key)) key = '+55' + digits(key);
  else if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(key) || /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(key)) key = digits(key);
  const gui = tlv('00', 'br.gov.bcb.pix') + tlv('01', key) + (f.message ? tlv('02', ascii(f.message).slice(0, 72)) : '');
  const amount = Number(String(f.amount || '').replace(/\./g, '').replace(',', '.'));
  let p = tlv('00', '01') + tlv('26', gui) + tlv('52', '0000') + tlv('53', '986');
  if (amount > 0) p += tlv('54', amount.toFixed(2));
  p += tlv('58', 'BR') + tlv('59', ascii(f.name || 'RECEBEDOR').slice(0, 25).toUpperCase()) + tlv('60', ascii(f.city || 'BRASIL').slice(0, 15).toUpperCase());
  p += tlv('62', tlv('05', (ascii(f.txid || '').replace(/[^A-Za-z0-9]/g, '') || '***').slice(0, 25)));
  p += '6304';
  return p + crc16(p);
}

export function qrPayload(kind: QrKind, f: QrFields): string {
  switch (kind) {
    case 'link': return (f.url || '').trim();
    case 'text': return f.text || '';
    case 'email': {
      const q = [f.subject && `subject=${encodeURIComponent(f.subject)}`, f.body && `body=${encodeURIComponent(f.body)}`].filter(Boolean).join('&');
      return `mailto:${(f.to || '').trim()}${q ? '?' + q : ''}`;
    }
    case 'phone': return `tel:${(f.phone || '').replace(/[^\d+]/g, '')}`;
    case 'sms': return `SMSTO:${(f.phone || '').replace(/[^\d+]/g, '')}:${f.message || ''}`;
    case 'whatsapp': return `https://wa.me/${digits(f.phone)}${f.message ? `?text=${encodeURIComponent(f.message)}` : ''}`;
    case 'wifi': return `WIFI:T:${f.security || 'WPA'};S:${wifiEsc(f.ssid)};${f.security === 'nopass' ? '' : `P:${wifiEsc(f.password)};`}${f.hidden === '1' ? 'H:true;' : ''};`;
    case 'pix': return pixPayload(f);
    case 'vcard': return [
      'BEGIN:VCARD', 'VERSION:3.0',
      `N:${vEsc(f.last)};${vEsc(f.first)};;;`, `FN:${vEsc([f.first, f.last].filter(Boolean).join(' '))}`,
      f.org && `ORG:${vEsc(f.org)}`, f.title && `TITLE:${vEsc(f.title)}`,
      f.phone && `TEL;TYPE=CELL:${f.phone}`, f.email && `EMAIL:${f.email}`, f.url && `URL:${f.url}`,
      f.address && `ADR;TYPE=WORK:;;${vEsc(f.address)};;;;`, f.note && `NOTE:${vEsc(f.note)}`,
      'END:VCARD',
    ].filter(Boolean).join('\n');
  }
}

/** Campos de cada tipo, na ordem do formulário. */
export const QR_FIELDS: Record<QrKind, { key: string; type?: 'text' | 'textarea' | 'select' | 'check'; options?: string[] }[]> = {
  link: [{ key: 'url' }],
  text: [{ key: 'text', type: 'textarea' }],
  email: [{ key: 'to' }, { key: 'subject' }, { key: 'body', type: 'textarea' }],
  phone: [{ key: 'phone' }],
  sms: [{ key: 'phone' }, { key: 'message', type: 'textarea' }],
  whatsapp: [{ key: 'phone' }, { key: 'message', type: 'textarea' }],
  wifi: [{ key: 'ssid' }, { key: 'password' }, { key: 'security', type: 'select', options: ['WPA', 'WEP', 'nopass'] }, { key: 'hidden', type: 'check' }],
  pix: [{ key: 'key' }, { key: 'name' }, { key: 'city' }, { key: 'amount' }, { key: 'txid' }, { key: 'message' }],
  vcard: [{ key: 'first' }, { key: 'last' }, { key: 'org' }, { key: 'title' }, { key: 'phone' }, { key: 'email' }, { key: 'url' }, { key: 'address' }, { key: 'note', type: 'textarea' }],
};

export const DEFAULT_QR_STYLE: QrStyle = { fg: '#141414', bg: '#ffffff', dots: 'rounded', corners: 'extra-rounded' };

function options(data: string, s: QrStyle, size: number) {
  return {
    width: size, height: size, type: 'svg' as const, data: data || ' ', margin: Math.round(size * 0.04),
    qrOptions: { errorCorrectionLevel: s.logo ? 'H' as const : 'M' as const },
    image: s.logo || undefined,
    imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: 0.32, hideBackgroundDots: true },
    dotsOptions: s.gradient
      ? { type: s.dots, gradient: { type: 'linear' as const, rotation: Math.PI / 4, colorStops: [{ offset: 0, color: s.fg }, { offset: 1, color: '#38bdf8' }] } }
      : { type: s.dots, color: s.fg },
    cornersSquareOptions: { type: s.corners, color: s.fg },
    cornersDotOptions: { type: s.corners === 'square' ? 'square' as const : 'dot' as const, color: s.fg },
    backgroundOptions: { color: s.bg },
  };
}

/** Desenha o QR Code dentro de um elemento (SVG nítido em qualquer tamanho). */
export async function renderQr(el: HTMLElement, data: string, s: QrStyle, size = 260) {
  const QRCodeStyling = (await import('qr-code-styling')).default;
  const qr = new QRCodeStyling(options(data, s, size) as any);
  el.innerHTML = '';
  qr.append(el);
  return qr;
}

/** PNG (data URL) do QR Code, para exportações, PDF e impressão. */
export async function qrPng(data: string, s: QrStyle = DEFAULT_QR_STYLE, size = 360): Promise<string> {
  const QRCodeStyling = (await import('qr-code-styling')).default;
  const qr = new QRCodeStyling({ ...options(data, s, size), type: 'canvas' } as any);
  const blob = (await qr.getRawData('png')) as Blob;
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(blob);
  });
}

export async function qrDownload(data: string, s: QrStyle, ext: 'png' | 'svg', name = 'qrcode') {
  const QRCodeStyling = (await import('qr-code-styling')).default;
  const qr = new QRCodeStyling({ ...options(data, s, 1024), type: ext === 'svg' ? 'svg' : 'canvas' } as any);
  const blob = (await qr.getRawData(ext)) as Blob;
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const { saveBinaryFile } = await import('./platform');
  return saveBinaryFile(`${name}.${ext}`, btoa(bin), [{ name: ext.toUpperCase(), extensions: [ext] }]);
}
