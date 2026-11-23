import { fmtDate, fmtDateTime } from '../lib/dates';
/** Imprimir, exportar (PDF/Excel/CSV) e importar planilhas de uma base de dados. */
import type { DatabaseData, Property, Row } from '../lib/types';
import { cellText, cellValue, isNumericProp } from './logic';
import { saveBinaryFile, saveTextFile, pickBinaryFile } from '../lib/platform';

const safe = (s: string) => (s || 'GCP-Notas').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const plain = (s: string) => s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();

function b64(buf: ArrayBuffer | Uint8Array) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

const exportable = (props: Property[]) => props.filter((p) => p.type !== 'password');
const text = (p: Property, r: Row, yes: string) => {
  const v = cellValue(p, r);
  if (p.type === 'checkbox') return v ? yes : '';
  if (p.type === 'progress') return v === '' || v == null ? '' : `${v}%`;
  if (p.type === 'rating') return v ? '★'.repeat(Number(v)) : '';
  if (p.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return fmtDate(v.slice(0, 10));
  return cellText(p, v);
};

/** Imprime só a tabela (com as colunas e filtros da visualização atual). */
export function printTable(title: string, props: Property[], rows: Row[], yes: string) {
  const cols = exportable(props);
  const host = document.createElement('div');
  host.id = 'print-area';
  host.innerHTML = `<h1>${esc(title)}</h1><table class="print-table"><thead><tr>${cols.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((p) => `<td class="${isNumericProp(p) ? 'num' : ''}">${esc(text(p, r, yes))}</td>`).join('')}</tr>`)
    .join('')}</tbody></table><p class="print-foot">${rows.length} · GCP-Neuro Notas · ${fmtDateTime(Date.now())}</p>`;
  document.body.appendChild(host);
  document.body.classList.add('print-area-mode');
  const done = () => {
    host.remove();
    document.body.classList.remove('print-area-mode');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  setTimeout(() => {
    window.print();
    setTimeout(done, 1500);
  }, 60);
}

/** PDF vetorial da tabela (texto selecionável), paginado automaticamente. */
export async function tablePdf(title: string, props: Property[], rows: Row[], yes: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const cols = exportable(props);
  const landscape = cols.length > 5;
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(31, 35, 48);
  pdf.text(plain(title) || 'GCP-Neuro Notas', 36, 44);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(110, 110, 130);
  pdf.text(`${rows.length} · ${fmtDateTime(Date.now())}`, 36, 60);
  autoTable(pdf, {
    startY: 72,
    head: [cols.map((p) => plain(p.name))],
    body: rows.map((r) => cols.map((p) => plain(text(p, r, yes)).replace(/★/g, '*'))),
    styles: { font: 'helvetica', fontSize: cols.length > 9 ? 7 : 9, cellPadding: 5, overflow: 'linebreak', textColor: [31, 35, 48], lineColor: [229, 231, 235], lineWidth: 0.5 },
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 245, 255] },
    columnStyles: Object.fromEntries(cols.map((p, i) => [i, isNumericProp(p) ? { halign: 'right' as const } : {}])),
    margin: { left: 36, right: 36 },
    didDrawPage: () => {
      const n = pdf.getNumberOfPages();
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`GCP-Neuro Notas · ${n}`, pdf.internal.pageSize.getWidth() - 90, pdf.internal.pageSize.getHeight() - 18);
    },
  });
  pdf.setProperties({ title: plain(title), creator: 'GCP-Neuro Notas' });
  return saveBinaryFile(`${safe(title)}.pdf`, b64(pdf.output('arraybuffer')), [{ name: 'PDF', extensions: ['pdf'] }]);
}

export async function tableXlsx(title: string, props: Property[], rows: Row[]) {
  const XLSX = await import('xlsx');
  const cols = props;
  const aoa: any[][] = [cols.map((p) => p.name)];
  for (const r of rows)
    aoa.push(
      cols.map((p) => {
        const v = cellValue(p, r);
        if (isNumericProp(p)) return v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
        if ((p.type === 'formula' || p.type === 'conditional') && typeof v === 'number') return v;
        if (p.type === 'checkbox') return !!v;
        if (p.type === 'date' && v) return new Date(v + 'T00:00:00');
        if (p.type === 'password') return v || '';
        return cellText(p, v);
      }),
    );
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  ws['!cols'] = cols.map((p) => ({ wch: Math.min(48, Math.max(10, p.name.length + 4, ...rows.slice(0, 50).map((r) => cellText(p, cellValue(p, r)).length + 2))) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: Math.max(0, cols.length - 1) } }) };
  cols.forEach((p, c) => {
    const fmt = p.type === 'currency' || p.format === 'currency' || p.resultFormat === 'currency' ? '#,##0.00' : p.type === 'progress' ? '0"%"' : p.type === 'date' ? 'dd/mm/yyyy' : null;
    if (!fmt) return;
    for (let r = 1; r <= rows.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = fmt;
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (plain(title) || 'Tabela').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  const out = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  return saveBinaryFile(`${safe(title)}.xlsx`, out, [{ name: 'Excel', extensions: ['xlsx'] }]);
}

export function tableCsv(title: string, props: Property[], rows: Row[]) {
  const cols = exportable(props);
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [cols.map((p) => q(p.name)).join(','), ...rows.map((r) => cols.map((p) => q(cellText(p, cellValue(p, r)))).join(','))];
  return saveTextFile(`${safe(title)}.csv`, '﻿' + lines.join('\n'), [{ name: 'CSV', extensions: ['csv'] }]);
}

/** Lê .xlsx, .xls, .ods ou .csv e devolve as abas como matrizes. */
export async function readSpreadsheet(): Promise<{ name: string; sheets: { name: string; aoa: any[][] }[] } | null> {
  const file = await pickBinaryFile('.xlsx,.xls,.xlsm,.ods,.csv,.tsv');
  if (!file) return null;
  const XLSX = await import('xlsx');
  const wb = XLSX.read(file.bytes, { type: 'array', cellDates: true });
  return {
    name: file.name,
    sheets: wb.SheetNames.map((n) => ({ name: n, aoa: XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, raw: true, defval: '' }) })),
  };
}

export type { DatabaseData };
