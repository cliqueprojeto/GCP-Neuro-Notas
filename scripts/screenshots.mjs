// Gera as capturas de tela do README a partir do build web (npm run build && npx vite preview).
// Uso: node scripts/screenshots.mjs [url] [pasta]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || 'docs/screenshots';
const PASS = 'SenhaForte#2026';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const shot = async (name) => {
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log('✓', name);
};
const nav = async (label) => {
  await p.click(`.sidebar >> text="${label}"`);
  await p.waitForTimeout(600);
};
const openPage = async (title) => {
  await p.click(`.sidebar .tree-title:text-is("${title}")`);
  await p.waitForTimeout(900);
};

await p.goto(URL);
await p.waitForSelector('.wizard');
await shot('15-assistente');
await p.click('text=Avançar');
await p.click('text=Avançar');
const pw = await p.$$('input[type=password]');
await pw[0].fill(PASS);
await pw[1].fill(PASS);
await p.click('text=Criar cofre');
await p.waitForSelector('.recovery-code', { timeout: 30000 });
await p.click('.check.big input');
await p.click('text=Avançar');
for (const t of ['Plano de projeto', 'Lista de leitura', 'Orçamento pessoal']) await p.click(`.starter:has-text("${t}")`);
await p.click('text=Começar a usar');
await p.waitForSelector('.home', { timeout: 20000 });
await p.waitForTimeout(1200);

// Liga algumas páginas para o grafo e o painel de conexões.
await openPage('Comece por aqui');
await p.click('.ProseMirror');
await p.keyboard.press('Control+End');
await p.keyboard.press('Enter');
await p.keyboard.press('Enter');
await p.keyboard.type('Ideias conectadas: ');
for (const t of ['Segundo cérebro', 'Plano de projeto', 'Tarefas', 'Cofre de senhas']) {
  await p.keyboard.type('[[' + t.slice(0, 8));
  await p.waitForSelector('.suggest-item');
  await p.keyboard.press('Enter');
}
await p.waitForTimeout(800);
await nav('Início');
await shot('01-inicio');

await openPage('Comece por aqui');
await shot('02-editor');
await p.click('.ProseMirror');
await p.keyboard.press('Control+End');
await p.keyboard.press('Enter');
await p.keyboard.type('/');
await p.waitForSelector('.suggest');
await shot('03-comandos');
await p.keyboard.type('enquete');
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
await p.fill('.poll input.input.lg', 'Qual formato para o próximo evento?');
const opts = await p.$$('.poll .row input.input');
await opts[0].fill('Presencial');
await opts[1].fill('Online');
await p.click('.poll >> text=Concluir');
for (let i = 0; i < 7; i++) await p.click('.poll-opt >> nth=0');
for (let i = 0; i < 4; i++) await p.click('.poll-opt >> nth=1');
await p.keyboard.press('Control+End');
await p.click('.ProseMirror', { position: { x: 10, y: 10 } });
await p.keyboard.press('Control+End');
await p.keyboard.press('Enter');
await p.keyboard.type('/sorteio');
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
await p.fill('.raffle .block-title', 'Sorteio de ingressos');
await p.fill('.raffle textarea', 'Ana\nBruno\nCarla\nDiego\nElis\nFábio\nGabi');
await p.click('.raffle .grow, .raffle .block-badge');
await p.click('.raffle >> text=Sortear');
await p.waitForTimeout(1800);
await p.$eval('.raffle', (e) => e.scrollIntoView({ block: 'center' }));
await shot('04-blocos-interativos');

await p.click('.sidebar .tree-caret >> nth=1').catch(() => {});
await openPage('Painel de projetos');
await p.waitForTimeout(1500);
await p.$eval('.content', (e) => e.scrollTo(0, 330));
await shot('05-relatorio-bi');
await p.click('.widget >> nth=3 >> .widget-actions button >> nth=0', { force: true });
await p.waitForSelector('.widget-editor');
await shot('06-editor-de-grafico');
await p.keyboard.press('Escape');

await p.click('.sidebar .tree-item:has-text("Painel de projetos") .tree-caret');
await openPage('Tarefas');
await shot('07-kanban');
await p.click('.db-view-tab:has-text("Calendário")');
await shot('08-calendario');

await openPage('Cofre de senhas');
await shot('09-cofre-de-senhas');

await openPage('Lista de leitura');
await shot('10-galeria');

// Modo Quadro: transforma a página do segundo cérebro em um quadro com desenho e conexões.
await openPage('Segundo cérebro');
await p.click('.mode-seg >> text=Quadro');
await p.waitForSelector('.canvas-area');
await p.waitForTimeout(600);
const area = await p.$('.canvas-area');
const box = await area.boundingBox();
await p.mouse.dblclick(box.x + 760, box.y + 180);
await p.keyboard.type('💡 Ideia central:\nlançar o festival');
await p.mouse.click(box.x + 1300, box.y + 600);
await p.click('.dock-btn[title^="Forma"]');
await p.mouse.click(box.x + 1050, box.y + 420);
await p.keyboard.type('Captação');
await p.mouse.click(box.x + 1300, box.y + 650);
await p.click('.dock-btn[title^="Moldura"]');
await p.mouse.move(box.x + 640, box.y + 360);
await p.mouse.down();
await p.mouse.move(box.x + 1250, box.y + 620, { steps: 8 });
await p.mouse.up();
await p.click('.dock-btn[title^="Caneta"]');
await p.mouse.move(box.x + 680, box.y + 520);
await p.mouse.down();
for (let i = 0; i <= 30; i++) await p.mouse.move(box.x + 680 + i * 8, box.y + 520 + Math.sin(i / 3) * 30);
await p.mouse.up();
await p.click('.dock-btn[title^="Selecionar"]');
const nodes = await p.$$('.cnode');
const link = async (a, bIdx) => {
  const h = await nodes[a].$('.cnode-link');
  const hb = await h.boundingBox();
  const tb = await nodes[bIdx].boundingBox();
  await p.mouse.move(hb.x + 6, hb.y + 6);
  await p.mouse.down();
  await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 });
  await p.mouse.up();
};
await nodes[0].hover();
await link(0, 1);
await nodes[1].hover();
await link(1, 2);
await p.mouse.click(box.x + 1350, box.y + 120);
await shot('11-quadro');
await p.click('.mode-seg >> text=Documento');

await nav('Grafo de ideias');
await p.waitForTimeout(2500);
await shot('12-grafo');

await nav('Templates');
await shot('13-templates');

await p.click('text=Perguntar à IA');
await shot('14-segundo-cerebro-ia');
await p.click('.ai-head .icon-btn');

await p.keyboard.press('Control+k');
await p.keyboard.type('proj');
await shot('16-paleta-de-comandos');
await p.keyboard.press('Escape');

await nav('Configurações');
await p.click('.stab:has-text("Atualizações")');
await shot('17-atualizacoes');
await p.click('.stab:has-text("Backup")');
await shot('18-backup-nuvem');
await p.click('.stab:has-text("Inteligência")');
await shot('19-ia');

await nav('Apoie o projeto');
await shot('20-apoie');
await nav('Sobre');
await shot('21-sobre');

// Tema claro em inglês e espanhol.
await p.click('.lang-seg >> text=EN');
await p.click('.topbar .icon-btn.boxed >> nth=0');
await p.click('.theme-chip:has-text("Snow")');
await nav('Home');
await shot('22-light-en-home');
await openPage('Tarefas');
await shot('23-light-en-board');
await p.click('.lang-seg >> text=ES');
await p.click('.topbar .icon-btn.boxed >> nth=0');
await p.click('.theme-chip:has-text("Sakura")');
await nav('Apoya el proyecto');
await shot('24-sakura-es-apoya');
await p.click('.lang-seg >> text=PT');
await p.click('.topbar .icon-btn.boxed >> nth=0');
await p.click('.theme-chip:has-text("Midnight")');

await p.click('.side-foot .icon-btn');
await p.waitForSelector('.auth-card');
await shot('25-login');

console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'sem erros de página');
await b.close();
