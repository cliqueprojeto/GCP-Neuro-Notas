import { describe, expect, it } from 'vitest';
import { cleanAppPassword, explainMailError } from '../src/lib/mailHelp';

describe('ajuda de e-mail', () => {
  it('reconhece o pedido de senha de app do Gmail (534 5.7.9)', () => {
    const raw = 'permanent error (534): 5.7.9 Application-specific password required. For more information, go to https://support.google.com/mail/?p=InvalidSecondFactor 71dfb90a1353d-5ee8b653081sm9578090e0c.16 - gsmtp';
    const h = explainMailError(raw, 'smtp.gmail.com');
    expect(h.issue).toBe('gmailAppPassword');
    expect(h.link).toContain('apppasswords');
  });
  it('identifica login recusado e problemas de conexão', () => {
    expect(explainMailError('535 5.7.8 Username and Password not accepted', 'smtp.gmail.com').issue).toBe('badLogin');
    expect(explainMailError('Connection timed out', 'smtp.x.com').issue).toBe('connection');
  });
  it('remove espaços das senhas de app', () => {
    expect(cleanAppPassword('abcd efgh ijkl mnop', 'smtp.gmail.com')).toBe('abcdefghijklmnop');
    expect(cleanAppPassword('a b', 'mail.minhaempresa.com')).toBe('a b');
  });
});
