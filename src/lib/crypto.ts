/**
 * Criptografia do cofre.
 *
 *  - Senha → chave de proteção com Argon2id (64 MiB, 3 passagens).
 *  - Uma chave de dados aleatória (256 bits) cifra cada registro com
 *    XChaCha20-Poly1305 (nonce aleatório de 192 bits, autenticado).
 *  - A chave de dados fica "embrulhada" pela senha e pela chave de recuperação,
 *    então trocar a senha não exige recriptografar as notas.
 */
import { argon2id } from 'hash-wasm';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

export interface KdfParams {
  alg: 'argon2id';
  m: number; // KiB
  t: number;
  p: number;
}

export const DEFAULT_KDF: KdfParams = { alg: 'argon2id', m: 65536, t: 3, p: 1 };
export const FAST_KDF: KdfParams = { alg: 'argon2id', m: 19456, t: 2, p: 1 };

const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function toB64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(secret: string, salt: Uint8Array, kdf: KdfParams = DEFAULT_KDF): Promise<Uint8Array> {
  const out = await argon2id({
    password: secret.normalize('NFKC'),
    salt,
    parallelism: kdf.p,
    iterations: kdf.t,
    memorySize: kdf.m,
    hashLength: 32,
    outputType: 'binary',
  });
  return out as Uint8Array;
}

export function sealBytes(key: Uint8Array, plain: Uint8Array): string {
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(key, nonce).encrypt(plain);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return toB64(out);
}

export function openBytes(key: Uint8Array, sealed: string): Uint8Array {
  const raw = fromB64(sealed);
  const nonce = raw.subarray(0, 24);
  const ct = raw.subarray(24);
  return xchacha20poly1305(key, nonce).decrypt(ct);
}

export function seal(key: Uint8Array, value: unknown): string {
  return sealBytes(key, enc.encode(JSON.stringify(value)));
}

export function open<T = unknown>(key: Uint8Array, sealed: string): T {
  return JSON.parse(dec.decode(openBytes(key, sealed))) as T;
}

/** Cabeçalho do cofre: o que é preciso para destrancar a chave de dados. */
export interface VaultHeader {
  format: 'gcp-notas-vault';
  version: 1;
  kdf: KdfParams;
  salt: string;
  wrapped: string; // chave de dados cifrada pela senha
  recoverySalt?: string;
  recoveryWrapped?: string; // chave de dados cifrada pela chave de recuperação
  hint?: string;
  created: number;
  updated: number;
}

/** Chave de recuperação legível: 6 grupos de 5 caracteres (≈150 bits). */
export function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(30);
  let s = '';
  for (let i = 0; i < 30; i++) {
    s += alphabet[bytes[i] % alphabet.length];
    if (i % 5 === 4 && i < 29) s += '-';
  }
  return s;
}

export function normalizeRecovery(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{5})(?=.)/g, '$1-');
}

export async function createHeader(
  password: string,
  dataKey: Uint8Array,
  recoveryCode: string | null,
  hint = '',
  kdf: KdfParams = DEFAULT_KDF,
): Promise<VaultHeader> {
  const salt = randomBytes(16);
  const kek = await deriveKey(password, salt, kdf);
  const now = Date.now();
  const header: VaultHeader = {
    format: 'gcp-notas-vault',
    version: 1,
    kdf,
    salt: toB64(salt),
    wrapped: sealBytes(kek, dataKey),
    hint,
    created: now,
    updated: now,
  };
  if (recoveryCode) {
    const rsalt = randomBytes(16);
    const rkek = await deriveKey(normalizeRecovery(recoveryCode), rsalt, FAST_KDF);
    header.recoverySalt = toB64(rsalt);
    header.recoveryWrapped = sealBytes(rkek, dataKey);
  }
  return header;
}

export async function unwrapWithPassword(header: VaultHeader, password: string): Promise<Uint8Array> {
  const kek = await deriveKey(password, fromB64(header.salt), header.kdf);
  return openBytes(kek, header.wrapped); // lança erro se a senha estiver errada
}

export async function unwrapWithRecovery(header: VaultHeader, code: string): Promise<Uint8Array> {
  if (!header.recoverySalt || !header.recoveryWrapped) throw new Error('no-recovery');
  const kek = await deriveKey(normalizeRecovery(code), fromB64(header.recoverySalt), FAST_KDF);
  return openBytes(kek, header.recoveryWrapped);
}

export async function rewrapPassword(header: VaultHeader, dataKey: Uint8Array, newPassword: string): Promise<VaultHeader> {
  const salt = randomBytes(16);
  const kek = await deriveKey(newPassword, salt, header.kdf);
  return { ...header, salt: toB64(salt), wrapped: sealBytes(kek, dataKey), updated: Date.now() };
}

export async function rewrapRecovery(header: VaultHeader, dataKey: Uint8Array, code: string): Promise<VaultHeader> {
  const rsalt = randomBytes(16);
  const rkek = await deriveKey(normalizeRecovery(code), rsalt, FAST_KDF);
  return { ...header, recoverySalt: toB64(rsalt), recoveryWrapped: sealBytes(rkek, dataKey), updated: Date.now() };
}

/** Arquivo de backup protegido por uma senha própria (exportação/importação). */
export interface BackupFile {
  format: 'gcp-notas-backup';
  version: 1;
  app: string;
  created: number;
  kdf: KdfParams;
  salt: string;
  payload: string;
}

export async function encryptBackup(payload: unknown, password: string, appVersion: string): Promise<BackupFile> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, DEFAULT_KDF);
  return {
    format: 'gcp-notas-backup',
    version: 1,
    app: appVersion,
    created: Date.now(),
    kdf: DEFAULT_KDF,
    salt: toB64(salt),
    payload: seal(key, payload),
  };
}

export async function decryptBackup<T>(file: BackupFile, password: string): Promise<T> {
  if (file.format !== 'gcp-notas-backup') throw new Error('invalid-format');
  const key = await deriveKey(password, fromB64(file.salt), file.kdf);
  return open<T>(key, file.payload);
}

export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const bits = pw.length * Math.log2(Math.max(pool, 1));
  const unique = new Set(pw).size / pw.length;
  const score = bits * (0.5 + unique / 2);
  if (score < 28) return 1;
  if (score < 45) return 2;
  if (score < 65) return 3;
  return 4;
}

export function generatePassword(length = 20, symbols = true): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' + (symbols ? '!@#$%&*-_=+?' : '');
  const bytes = randomBytes(length * 2);
  let s = '';
  for (let i = 0; s.length < length && i < bytes.length; i++) {
    const v = bytes[i];
    if (v < 256 - (256 % chars.length)) s += chars[v % chars.length];
  }
  while (s.length < length) s += chars[randomBytes(1)[0] % chars.length];
  return s;
}

export function uid(prefix = ''): string {
  const b = randomBytes(10);
  return prefix + Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 16);
}
