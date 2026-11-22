/** Stickers vetoriais gerados localmente (sem downloads). */

const svgUrl = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

function badge(text: string, c1: string, c2: string, icon = ''): string {
  const w = Math.max(150, 30 + text.length * 13 + (icon ? 30 : 0));
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="56" viewBox="0 0 ${w} 56">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect x="3" y="3" width="${w - 6}" height="50" rx="25" fill="url(#g)" stroke="#fff" stroke-width="3" transform="rotate(-2 ${w / 2} 28)"/>
<text x="${w / 2}" y="36" font-family="Inter,Segoe UI,Helvetica,Arial,sans-serif" font-size="20" font-weight="800" fill="#fff" text-anchor="middle" transform="rotate(-2 ${w / 2} 28)">${icon ? icon + ' ' : ''}${text}</text>
</svg>`);
}

function shape(path: string, c1: string, c2: string, vb = '0 0 100 100'): string {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="${vb}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<g stroke="#fff" stroke-width="5" stroke-linejoin="round">${path.replace(/FILL/g, 'url(#g)')}</g></svg>`);
}

export const SHAPE_STICKERS: { id: string; src: string }[] = [
  { id: 'star', src: shape('<path fill="FILL" d="M50 6l13 28 30 3-23 20 7 30-27-16-27 16 7-30L7 37l30-3z"/>', '#fde047', '#f97316') },
  { id: 'heart', src: shape('<path fill="FILL" d="M50 88S8 62 8 34a21 21 0 0 1 42-6 21 21 0 0 1 42 6c0 28-42 54-42 54z"/>', '#fb7185', '#db2777') },
  { id: 'check', src: shape('<circle cx="50" cy="50" r="42" fill="FILL"/><path d="M30 52l13 13 28-30" fill="none" stroke-width="9" stroke-linecap="round"/>', '#34d399', '#059669') },
  { id: 'cross', src: shape('<circle cx="50" cy="50" r="42" fill="FILL"/><path d="M34 34l32 32M66 34L34 66" fill="none" stroke-width="9" stroke-linecap="round"/>', '#f87171', '#dc2626') },
  { id: 'bolt', src: shape('<path fill="FILL" d="M58 4L18 56h26l-6 40 42-54H54z"/>', '#facc15', '#eab308') },
  { id: 'bulb', src: shape('<path fill="FILL" d="M50 8a30 30 0 0 0-18 54c4 3 6 8 6 12h24c0-4 2-9 6-12A30 30 0 0 0 50 8z"/><rect x="38" y="80" width="24" height="12" rx="4" fill="FILL"/>', '#fde68a', '#f59e0b') },
  { id: 'rocket', src: shape('<path fill="FILL" d="M50 6c18 12 24 34 18 56H32C26 40 32 18 50 6z"/><path fill="FILL" d="M32 62L18 78l16-2zM68 62l14 16-16-2z"/><circle cx="50" cy="36" r="8" fill="#fff"/><path d="M42 70h16l-8 22z" fill="#fb923c"/>', '#a78bfa', '#6366f1') },
  { id: 'flag', src: shape('<path d="M24 92V10" fill="none" stroke-width="7" stroke-linecap="round"/><path fill="FILL" d="M27 12c20-8 30 8 50 0v40c-20 8-30-8-50 0z"/>', '#38bdf8', '#2563eb') },
  { id: 'pin', src: shape('<path fill="FILL" d="M50 94S16 58 16 38a34 34 0 0 1 68 0c0 20-34 56-34 56z"/><circle cx="50" cy="38" r="12" fill="#fff"/>', '#f472b6', '#9333ea') },
  { id: 'trophy', src: shape('<path fill="FILL" d="M28 10h44v26a22 22 0 0 1-44 0z"/><path d="M28 18H12c0 16 8 22 16 22M72 18h16c0 16-8 22-16 22" fill="none" stroke-width="6"/><rect x="42" y="58" width="16" height="16" fill="FILL"/><rect x="28" y="74" width="44" height="14" rx="4" fill="FILL"/>', '#fde047', '#ca8a04') },
  { id: 'fire', src: shape('<path fill="FILL" d="M50 94c-20 0-32-14-32-32 0-18 14-26 16-46 10 8 14 18 12 28 6-4 8-10 8-16 14 10 28 24 28 38 0 16-12 28-32 28z"/>', '#fb923c', '#dc2626') },
  { id: 'smile', src: shape('<circle cx="50" cy="50" r="42" fill="FILL"/><circle cx="36" cy="42" r="5" fill="#fff" stroke="none"/><circle cx="64" cy="42" r="5" fill="#fff" stroke="none"/><path d="M32 60c10 14 26 14 36 0" fill="none" stroke-width="6" stroke-linecap="round"/>', '#fde047', '#f59e0b') },
];

export const TEXT_STICKER_KEYS = [
  ['sticker.approved', '#34d399', '#059669', '✔'],
  ['sticker.urgent', '#f87171', '#dc2626', '!'],
  ['sticker.important', '#fb923c', '#ea580c', '★'],
  ['sticker.idea', '#fde047', '#f59e0b', '✦'],
  ['sticker.done', '#60a5fa', '#2563eb', '✔'],
  ['sticker.todo', '#a78bfa', '#7c3aed', '○'],
  ['sticker.review', '#f472b6', '#db2777', '?'],
  ['sticker.wow', '#22d3ee', '#7c3aed', '✶'],
] as const;

export function textSticker(label: string, c1: string, c2: string, icon: string) {
  return badge(label, c1, c2, icon);
}
