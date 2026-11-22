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
