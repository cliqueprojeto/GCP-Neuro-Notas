import { describe, expect, it } from 'vitest';
import {
  createHeader, decryptBackup, encryptBackup, generateRecoveryCode, open, randomBytes, rewrapPassword, seal, unwrapWithPassword, unwrapWithRecovery, FAST_KDF,
} from '../src/lib/crypto';
import { rankModels, guessProvider } from '../src/ai/providers';
import { compareVersions, pickAsset } from '../src/lib/updater';

describe('cofre criptografado', () => {
  it('cifra e decifra registros com a chave de dados', () => {
    const key = randomBytes(32);
    const sealed = seal(key, { title: 'Olá', n: 1 });
    expect(sealed).not.toContain('Olá');
    expect(open(key, sealed)).toEqual({ title: 'Olá', n: 1 });
    expect(() => open(randomBytes(32), sealed)).toThrow();
  });

  it('abre com a senha e com a chave de recuperação; troca de senha preserva a chave', async () => {
    const dataKey = randomBytes(32);
    const code = generateRecoveryCode();
    const h = await createHeader('senha-correta', dataKey, code, '', FAST_KDF);
    expect(await unwrapWithPassword(h, 'senha-correta')).toEqual(dataKey);
    await expect(unwrapWithPassword(h, 'errada')).rejects.toThrow();
    expect(await unwrapWithRecovery(h, code.toLowerCase().replace(/-/g, ' '))).toEqual(dataKey);
    const h2 = await rewrapPassword(h, dataKey, 'nova-senha');
    expect(await unwrapWithPassword(h2, 'nova-senha')).toEqual(dataKey);
    await expect(unwrapWithPassword(h2, 'senha-correta')).rejects.toThrow();
  });

  it('backup exportado exige a senha do arquivo', async () => {
    const f = await encryptBackup({ pages: [{ id: 'a' }] }, 'arquivo123', '1.0.0');
    expect(JSON.stringify(f)).not.toContain('"id":"a"');
    expect(await decryptBackup(f, 'arquivo123')).toEqual({ pages: [{ id: 'a' }] });
    await expect(decryptBackup(f, 'x')).rejects.toThrow();
  });
});

describe('detecção do melhor modelo de IA', () => {
  it('reconhece o provedor pela chave', () => {
    expect(guessProvider('sk-ant-api03-xxx')).toBe('anthropic');
    expect(guessProvider('sk-or-v1-xxx')).toBe('openrouter');
    expect(guessProvider('AIzaSyXXX')).toBe('gemini');
    expect(guessProvider('gsk_xxx')).toBe('groq');
    expect(guessProvider('sk-proj-xxx')).toBe('openai');
  });

  it('prefere modelos topo de linha e descarta modelos não conversacionais', () => {
    expect(rankModels('anthropic', ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-5-5', 'claude-opus-4-8'])[0]).toBe('claude-opus-5-5');
    const oai = rankModels('openai', ['gpt-4o-mini', 'text-embedding-3-large', 'whisper-1', 'gpt-4o', 'gpt-5', 'gpt-5-mini', 'dall-e-3']);
    expect(oai[0]).toBe('gpt-5');
    expect(oai).not.toContain('whisper-1');
    expect(oai).not.toContain('text-embedding-3-large');
    expect(rankModels('gemini', ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'text-embedding-004'])[0]).toBe('gemini-2.5-pro');
    expect(rankModels('ollama', ['llama3.2:3b', 'qwen2.5:32b', 'mistral:7b'])[0]).toBe('qwen2.5:32b');
  });
});

describe('atualizações', () => {
  it('compara versões semânticas', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('v1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('escolhe o instalador certo por sistema e exige o .sha256', () => {
    const names = [
      'GCP-Notas-1.1.0-Windows-x64-Setup.exe', 'GCP-Notas-1.1.0-macOS-arm64.dmg', 'GCP-Notas-1.1.0-macOS-x86_64.dmg',
      'gcp-notas_1.1.0_amd64.deb', 'gcp-notas-1.1.0-1.x86_64.rpm', 'gcp-notas-bin-1.1.0-1-x86_64.pkg.tar.zst',
    ];
    const assets = names.flatMap((n) => [{ name: n, browser_download_url: 'u/' + n, size: 1 }, { name: n + '.sha256', browser_download_url: 'u/' + n + '.sha256', size: 1 }]);
    expect(pickAsset(assets, 'windows', 'x86_64', '')?.name).toBe(names[0]);
    expect(pickAsset(assets, 'macos', 'aarch64', '')?.name).toBe(names[1]);
    expect(pickAsset(assets, 'macos', 'x86_64', '')?.name).toBe(names[2]);
    expect(pickAsset(assets, 'linux', 'x86_64', 'deb')?.name).toBe(names[3]);
    expect(pickAsset(assets, 'linux', 'x86_64', 'rpm')?.name).toBe(names[4]);
    expect(pickAsset(assets, 'linux', 'x86_64', 'arch')?.name).toBe(names[5]);
    expect(pickAsset([{ name: names[3], browser_download_url: 'x', size: 1 }], 'linux', 'x86_64', 'deb')).toBeUndefined();
  });
});

// ------------------------------------------------------------- 1.2
import { evaluate, checkFormula } from '../src/database/formula';
import { maskCpf, maskCnpj, maskCep, maskPhone, validCpf, validCnpj, currencyFromTyping } from '../src/database/masks';
import { recompute, importMatrix, makeProperty, distinctValues, applyFilters } from '../src/database/logic';
import type { DatabaseData } from '../src/lib/types';

describe('fórmulas', () => {
  const vals: Record<string, any> = { 'Quant.': 10, 'Valor unitário': 1350, Status: 'Concluído', Prazo: '2026-12-01', Nome: 'Ana' };
  const r = (n: string) => vals[n];
  it('aritmética entre campos', () => {
    expect(evaluate('{Quant.} * {Valor unitário}', r)).toBe(13500);
    expect(evaluate('ARRED(10 / 3; 2)', r)).toBe(3.33);
    expect(evaluate('SOMA(1, 2, 3) + MEDIA(2; 4)', r)).toBe(9);
  });
  it('condições, textos e datas', () => {
    expect(evaluate('SE({Status} = "Concluído"; "✅"; "⏳")', r)).toBe('✅');
    expect(evaluate('IF(AND({Quant.} > 5, {Quant.} < 20), "ok", "no")', r)).toBe('ok');
    expect(evaluate('ENTRE({Quant.}; 7; 10)', r)).toBe(true);
    expect(evaluate('{Nome} & " · " & {Quant.}', r)).toBe('Ana · 10');
    expect(evaluate('DIAS({Prazo}; "2026-11-22")', r)).toBe(9);
    expect(evaluate('SOMARDIAS({Prazo}; 31)', r)).toBe('2027-01-01');
  });
  it('detecta erros de sintaxe', () => {
    expect(checkFormula('{A} * (2 + ')).not.toBeNull();
    expect(checkFormula('{A} * 2')).toBeNull();
  });
});

describe('máscaras', () => {
  it('formata e valida documentos', () => {
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
    expect(validCpf('529.982.247-25')).toBe(true);
    expect(validCpf('111.111.111-11')).toBe(false);
    expect(maskCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(validCnpj('11.222.333/0001-81')).toBe(true);
    expect(maskCep('01310100')).toBe('01310-100');
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321');
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
  });
  it('moeda digitada pelos centavos', () => {
    expect(currencyFromTyping('R$ 1.234', 2)).toBe(12.34);
    expect(currencyFromTyping('1', 2)).toBe(0.01);
    expect(currencyFromTyping('', 2)).toBe('');
  });
});

describe('bases de dados 1.2', () => {
  const base = (): DatabaseData => {
    const title = makeProperty('title', 'Nome');
    const q = makeProperty('number', 'Quant.');
    const v = makeProperty('currency', 'Valor');
    const total = { ...makeProperty('formula', 'Total'), formula: '{Quant.} * {Valor}', resultFormat: 'currency' as const };
    const faixa = { ...makeProperty('conditional', 'Faixa'), rules: [{ id: 'k1', prop: total.id, op: 'between' as const, value: '0', value2: '999', result: 'Pequeno' }], elseResult: 'Grande' };
    return {
      properties: [title, q, v, total, faixa],
      rows: [
        { id: 'r1', cells: { [title.id]: 'A', [q.id]: 2, [v.id]: 100 }, createdAt: 1, updatedAt: 1 },
        { id: 'r2', cells: { [title.id]: 'B', [q.id]: 10, [v.id]: 300 }, createdAt: 2, updatedAt: 2 },
        { id: 'r3', cells: { [title.id]: '', [q.id]: 1, [v.id]: 5 }, createdAt: 3, updatedAt: 3 },
      ],
      views: [{ id: 'v', name: 'T', type: 'table', filters: [] }],
      activeView: 'v',
    };
  };
  it('recalcula fórmulas e condicionais por faixa', () => {
    const db = recompute(base());
    const [, , , total, faixa] = db.properties;
    expect(db.rows.map((r) => r.cells[total.id])).toEqual([200, 3000, 5]);
    expect(db.rows.map((r) => r.cells[faixa.id])).toEqual(['Pequeno', 'Grande', 'Pequeno']);
  });
  it('filtro por valores estilo Excel com (em branco)', () => {
    const db = recompute(base());
    const title = db.properties[0];
    expect(distinctValues(db, title)).toEqual(['', 'A', 'B']);
    const rows = applyFilters(db, db.rows, [{ id: 'f', prop: title.id, op: 'in', value: ['', 'B'] }]);
    expect(rows.map((r) => r.id)).toEqual(['r2', 'r3']);
  });
  it('importa planilha detectando tipos', () => {
    const db = base();
    const { db: next, added } = importMatrix(db, [['Nome', 'Quant.', 'Telefone', 'Situação'], ['X', 3, '11987654321', 'Ok'], ['Y', '4', '', 'Pendente'], ['Z', 5, '', 'Ok'], ['W', 1, '', 'Ok']], 'append');
    expect(added).toBe(4);
    expect(next.rows.length).toBe(7);
    const phone = next.properties.find((p) => p.name === 'Telefone')!;
    expect(phone.type).toBe('phone');
    expect(next.rows[3].cells[phone.id]).toBe('(11) 98765-4321');
    const sit = next.properties.find((p) => p.name === 'Situação')!;
    expect(sit.type).toBe('select');
    expect(sit.options!.map((o) => o.label)).toEqual(['Ok', 'Pendente']);
    // a base original não foi alterada
    expect(db.properties.length).toBe(5);
  });
});
