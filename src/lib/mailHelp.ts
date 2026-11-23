/** Traduz erros de SMTP em orientações claras, com o passo a passo de cada provedor. */
export type MailIssue = 'gmailAppPassword' | 'badLogin' | 'outlookBasicAuth' | 'connection' | 'tls' | 'sender' | 'unknown';

export interface MailHelp { issue: MailIssue; link?: string }

export function explainMailError(raw: string, host = ''): MailHelp {
  const m = raw.toLowerCase();
  const gmail = /gmail|google/.test(host.toLowerCase()) || /gsmtp|google\.com/.test(m);
  const microsoft = /office365|outlook|hotmail|live\.com/.test(host.toLowerCase());
  if (/5\.7\.9|invalidsecondfactor|application-specific password/.test(m)) return { issue: 'gmailAppPassword', link: 'https://myaccount.google.com/apppasswords' };
  if (/5\.7\.139|smtpclientauthentication|basic authentication is disabled|authentication unsuccessful/.test(m) && microsoft) return { issue: 'outlookBasicAuth', link: 'https://account.microsoft.com/security' };
  if (/535|5\.7\.8|badcredentials|username and password not accepted|authentication failed|invalid credentials|auth/.test(m))
    return { issue: 'badLogin', link: gmail ? 'https://myaccount.google.com/apppasswords' : microsoft ? 'https://account.microsoft.com/security' : undefined };
  if (/certificate|tls|ssl|handshake|wrong version number/.test(m)) return { issue: 'tls' };
  if (/timed out|timeout|connection refused|dns|resolve|unreachable|network|could not connect|failed to lookup/.test(m)) return { issue: 'connection' };
  if (/5\.7\.1|sender|from address|not owned|send as/.test(m)) return { issue: 'sender' };
  return { issue: 'unknown' };
}

/** Senhas de app do Google/Microsoft aparecem em blocos com espaços ("abcd efgh ijkl mnop"). */
export const cleanAppPassword = (pw: string, host: string) => (/gmail|google|office365|outlook|live|hotmail|yahoo/i.test(host) ? pw.replace(/\s+/g, '') : pw);
