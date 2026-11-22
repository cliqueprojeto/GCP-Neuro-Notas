// Gera os ícones do Android (adaptativo sem bordas) a partir de assets/branding/icon-android.svg
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const svg = fs.readFileSync(`${ROOT}/assets/branding/icon-android.svg`, 'utf8');
const RES = `${ROOT}/packaging/android/res`;
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const b = await chromium.launch();
const p = await b.newPage();
const render = async (size, file, round = false) => {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;${round ? 'border-radius:50%;overflow:hidden;' : ''}">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`);
  await p.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
};
for (const [d, k] of Object.entries(dens)) {
  const dir = `${RES}/mipmap-${d}`;
  fs.mkdirSync(dir, { recursive: true });
  await render(Math.round(108 * k), `${dir}/ic_launcher_foreground.png`);
  await render(Math.round(48 * k), `${dir}/ic_launcher.png`);
  await render(Math.round(48 * k), `${dir}/ic_launcher_round.png`, true);
}
fs.mkdirSync(`${RES}/mipmap-anydpi-v26`, { recursive: true });
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, xml);
fs.writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, xml);
fs.mkdirSync(`${RES}/values`, { recursive: true });
fs.writeFileSync(`${RES}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#3B1585</color>
</resources>
`);
// prévia com máscaras (círculo, squircle, gota) para conferência
await p.setViewportSize({ width: 760, height: 220 });
const fg = fs.readFileSync(`${RES}/mipmap-xxxhdpi/ic_launcher_foreground.png`).toString('base64');
const masks = ['50%', '28%', '50% 50% 50% 12%', '0'];
await p.setContent(`<body style="margin:0;background:#e5e7eb;display:flex;gap:30px;padding:30px">${masks.map((m) => `<div style="width:160px;height:160px;border-radius:${m};overflow:hidden;background:#3B1585"><img src="data:image/png;base64,${fg}" style="width:160px;height:160px;transform:scale(1.0)"></div>`).join('')}</body>`);
if (process.argv[2]) await p.screenshot({ path: process.argv[2] });
await b.close();
console.log('ok');
