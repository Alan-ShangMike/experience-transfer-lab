import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type CredentialSettings = { zhihu?: string; deepseek?: string };
let pendingWrite: Promise<unknown> = Promise.resolve();

export function storageSecret() {
  const configured = process.env.APP_SECRET?.trim();
  return configured && /^[\da-f]{64}$/iu.test(configured) ? Buffer.from(configured, 'hex') : undefined;
}

function dataDirectory() {
  return resolve(process.env.APP_DATA_DIR?.trim() || '.data');
}

async function savedSettings(): Promise<CredentialSettings> {
  let raw: string;
  try {
    raw = await readFile(join(dataDirectory(), 'credentials.json'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }

  const key = storageSecret();
  if (!key) throw new Error('Credential store requires APP_SECRET');
  const { v, iv, tag, data } = JSON.parse(raw);
  if (v !== 1) throw new Error('Unsupported credential store version');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as CredentialSettings;
}

export async function activeCredentials() {
  const saved = await savedSettings();
  return {
    zhihu: saved.zhihu ?? process.env.ZHIHU_ACCESS_SECRET?.trim(),
    deepseek: saved.deepseek ?? process.env.DEEPSEEK_API_KEY?.trim(),
  };
}

export function saveCredentials(update: CredentialSettings) {
  const write = pendingWrite.then(async () => {
    const key = storageSecret();
    if (!key) throw new Error('Credential store requires APP_SECRET');
    const next = { ...await savedSettings(), ...update };
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(next), 'utf8'), cipher.final()]);
    const payload = JSON.stringify({
      v: 1,
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
      data: encrypted.toString('base64url'),
    });

    const directory = dataDirectory();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = join(directory, 'credentials-' + randomBytes(12).toString('hex') + '.tmp');
    try {
      await writeFile(temporary, payload, { mode: 0o600, flag: 'wx' });
      await rename(temporary, join(directory, 'credentials.json'));
    } finally {
      await rm(temporary, { force: true });
    }
  });
  pendingWrite = write.catch(() => {});
  return write;
}
