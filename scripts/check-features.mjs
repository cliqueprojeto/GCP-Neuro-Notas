// Verificação visual dos recursos da 1.2 (bases avançadas, blocos, quadro, grafo, calendário, nuvem).
// Uso: node scripts/check-features.mjs [url] [pasta]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '/tmp/gcp-check';
const PASS = 'SenhaForte#2026';
const mobile = process.argv.includes('--mobile');

const b = await chromium.launch();
const ctx = mobile
  ? await b.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR', isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
  : await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
const shot = async (name) => {
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log('✓', name);
};
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    console.log('✗', name, String(e.message).split('\n')[0]);
    await p.screenshot({ path: `${OUT}/ERR-${name}.png` }).catch(() => {});
  }
};

await p.goto(URL);
await p.waitForSelector('.wizard');
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
await p.waitForTimeout(1000);

const openSidebar = async () => {
  if (mobile && !(await p.$('.app.mobile-open'))) {
    await p.click('.mnav-item:has-text("Menu")');
    await p.waitForTimeout(400);
  }
};
const openPage = async (title) => {
  await openSidebar();
  const el = p.locator(`.sidebar .tree-title:text-is("${title}")`).first();
  if (!(await el.isVisible())) {
    // expande pais
    for (const c of await p.$$('.sidebar .tree-caret:not(.leaf)')) await c.click().catch(() => {});
  }
  await p.locator(`.sidebar .tree-title:text-is("${title}")`).first().click();
  await p.waitForTimeout(900);
};

await step('sidebar-calendario', async () => {
  await openSidebar();
  await shot('01-sidebar-minical');
});

await step('tabela', async () => {
  await openPage('Tarefas');
  await p.click('.db-view-tab:has-text("Tabela")');
  await shot('02-tarefas');
  // filtro estilo Excel na coluna Status
  const th = p.locator('th:has-text("Status")').first();
  await th.locator('.th-ic').first().click();
  await p.waitForSelector('.xfilter');
  await shot('03-filtro-excel');
  await p.locator('.xfilter-list label:has-text("Concluído") input').click();
  await p.click('.xfilter >> text=Aplicar');
  await shot('04-filtrado');
  await p.click('.filter-chips >> text=Limpar filtros');
  // menu do botão direito
  const row = p.locator('.db-table tbody tr').nth(1);
  const box = await row.boundingBox();
  if (mobile) await p.locator('.db-table tbody tr').nth(1).locator('.row-grip').click();
  else await p.mouse.click(box.x + 60, box.y + box.height / 2, { button: 'right' });
  await p.waitForSelector('.ctx-menu');
  await shot('05-menu-contexto');
  await p.click('.ctx-menu >> text=Inserir linha acima');
  await p.waitForTimeout(300);
});

await step('novos-campos', async () => {
  await p.click('.th-add .icon-btn');
  await p.waitForSelector('.type-menu2');
  await shot('06-tipos-de-campo');
  await p.click('.type-opt:has-text("Moeda")');
  await p.waitForTimeout(300);
  const cur = p.locator('td.td-currency input').first();
  await cur.click();
  await cur.type('123456');
  await p.click('.th-add .icon-btn');
  await p.click('.type-opt:has-text("CPF")');
  await p.waitForTimeout(300);
  const cpf = p.locator('td.td-cpf input').first();
  await cpf.click();
  await cpf.type('52998224725');
  await p.click('.th-add .icon-btn');
  await p.click('.type-opt:has-text("Fórmula") >> nth=0');
  await p.waitForTimeout(300);
  await p.locator('th.th-formula .th-btn').click();
  await p.waitForSelector('.formula-box');
  await p.fill('.formula-box textarea', '{Horas} * 2');
  await shot('07-formula');
  await p.keyboard.press('Escape');
  await p.mouse.click(900, 200);
  await p.waitForTimeout(300);
  await shot('08-tabela-campos');
});

await step('exportar', async () => {
  await p.click('.db-tools button[title="Exportar"]');
  await shot('09-exportar');
  await p.mouse.click(900, 200);
});

await step('modelo', async () => {
  await p.click('.db-tools button[title="Salvar tabela como modelo"]');
  await p.waitForSelector('.utpl-style');
  await p.fill('.modal input.input', 'Tarefas da equipe');
  await p.fill('.modal textarea', 'Estrutura com status, prioridade e prazos');
  await shot('10-salvar-modelo');
  await p.click('.modal >> text=Salvar modelo');
});

await step('blocos', async () => {
  await openPage('Comece por aqui');
  const para = p.locator('.ProseMirror h2').first();
  await para.hover();
  await p.waitForSelector('.block-handle');
  await shot('11-alca-bloco');
  await p.click('.block-handle .bh-btn.grip');
  await p.waitForSelector('.ctx-menu');
  await shot('12-menu-bloco');
  await p.keyboard.press('Escape');
  await p.click('.ProseMirror');
  await p.keyboard.press('Control+End');
  await p.keyboard.press('Enter');
  await p.keyboard.type('/');
  await p.waitForSelector('.suggest');
  await shot('13-comando-barra');
  await p.keyboard.type('tarefas da');
  await shot('14-comando-modelo');
  await p.keyboard.press('Escape');
});

await step('quadro', async () => {
  await openSidebar();
  await p.click('.sidebar >> text="Quadros"');
  await p.waitForTimeout(500);
  await p.click('text=Novo quadro');
  await p.waitForSelector('.canvas-area');
  const area = await p.locator('.canvas-area').boundingBox();
  await p.keyboard.press('n');
  await p.mouse.click(area.x + 300, area.y + 250);
  await p.keyboard.press('Escape');
  await p.mouse.click(area.x + 50, area.y + 50);
  await p.waitForTimeout(300);
  await p.keyboard.press('s');
  await p.mouse.click(area.x + 750, area.y + 420);
  await p.mouse.click(area.x + 50, area.y + 50);
  await p.waitForTimeout(300);
  // liga do lado direito da nota até perto do lado esquerdo da forma (magnetismo)
  const nodes = await p.$$('.cnode');
  const n1 = await nodes[0].boundingBox();
  const n2 = await nodes[1].boundingBox();
  await p.locator('.cnode').first().hover();
  await p.mouse.move(n1.x + n1.width, n1.y + n1.height / 2);
  await p.mouse.down();
  await p.mouse.move(n2.x - 30, n2.y + n2.height / 2 + 10, { steps: 12 });
  await shot('15-conector-magnetico');
  await p.mouse.up();
  await p.waitForTimeout(300);
  await shot('16-conector-selecionado');
  // moldura para apresentar
  await p.keyboard.press('f');
  await p.mouse.move(area.x + 150, area.y + 120);
  await p.mouse.down();
  await p.mouse.move(area.x + 1000, area.y + 600, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  await p.click('.canvas-present');
  await p.waitForTimeout(1200);
  await shot('17-apresentacao');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
});

await step('quadros-lista', async () => {
  await openSidebar();
  await p.click('.sidebar >> text="Quadros"');
  await shot('18-quadros');
});

await step('grafo', async () => {
  await openSidebar();
  await p.click('.sidebar >> text="Grafo de ideias"');
  await p.waitForTimeout(2500);
  const c = await p.locator('.graph-area canvas').boundingBox();
  await p.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
  await p.waitForTimeout(400);
  await shot('19-grafo');
});

await step('calendario', async () => {
  await openSidebar();
  await p.click('.mini-cal-foot >> text=Mês');
  await shot('20-calendario-mes');
  await p.click('.cal-hub .seg >> text=Semana');
  await shot('21-calendario-semana');
  await p.click('.cal-hub .seg >> text=Dia');
  await shot('22-calendario-dia');
});

await step('nuvem', async () => {
  await openSidebar();
  await p.click('.sidebar >> text="Configurações"');
  await p.click('.settings-tabs >> text=Backup');
  await p.waitForTimeout(400);
  await shot('23-nuvem');
  await p.click('.cloud-row >> text=Configurar >> nth=0').catch(() => p.click('text=Passo a passo do Google'));
  await p.waitForSelector('.guide-steps');
  await shot('24-guia-google');
  await p.keyboard.press('Escape');
  await p.locator('.notion-card').scrollIntoViewIfNeeded();
  await shot('25-notion');
});

console.log('erros:', errors.length ? errors : 'nenhum');
await b.close();
