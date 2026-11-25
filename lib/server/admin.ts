import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { activeCredentials, saveCredentials, storageSecret, type CredentialSettings } from './keys';

const cookieName = 'lab_admin';
const sessionSeconds = 8 * 60 * 60;
const loginWindow = 5 * 60 * 1000;
const limit = 10;
let failedLogins = 0;
let retryAfter = 0;

function configuration() {
  const password = process.env.ADMIN_PASSWORD;
  const secret = storageSecret();
  const origin = process.env.APP_ORIGIN;
  if (!password || password.length < 16 || !secret || !origin) return;
  try {
    const url = new URL(origin);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return;
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return;
    return { password, secret, origin: url.origin, secure: url.protocol === 'https:' };
  } catch {
    return;
  }
}

type AdminConfig = NonNullable<ReturnType<typeof configuration>>;

function json(value: unknown, status = 200, headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set('Cache-Control', 'no-store');
  return Response.json(value, { status, headers: result });
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

function sign(config: AdminConfig, payload: string) {
  return createHmac('sha256', config.secret)
    .update('lab-admin-v1\0')
    .update(digest(config.password))
    .update(payload)
    .digest();
}

function serializeCookie(config: AdminConfig, token: string, maxAge: number) {
  return cookieName + '=' + token + '; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age='
    + maxAge + (config.secure ? '; Secure' : '');
}

function signedIn(request: Request, config: AdminConfig) {
  const cookie = request.headers.get('cookie')?.split(';').find((part) => part.trim().startsWith(cookieName + '='));
  const token = cookie?.trim().slice(cookieName.length + 1) ?? '';
  const match = /^(\d{1,12})\.([\da-f]{32})\.([\da-f]{64})$/u.exec(token);
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(Buffer.from(match[3], 'hex'), sign(config, match[1] + '.' + match[2]));
}

async function readPayload(request: Request): Promise<Record<string, unknown> | undefined> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return;
  const reader = request.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return;
      }
      text += decoder.decode(value, { stream: true });
    }
    const value: unknown = JSON.parse(text + decoder.decode());
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    return;
  } finally {
    reader.releaseLock();
  }
}

async function credentialStatus() {
  const current = await activeCredentials();
  return json({ zhihu: Boolean(current.zhihu), deepseek: Boolean(current.deepseek) });
}

async function session(request: Request, config: AdminConfig) {
  if (request.method === 'DELETE') return json({ ok: true }, 200, { 'Set-Cookie': serializeCookie(config, '', 0) });
  if (request.method !== 'POST') return json({ error: '请求方式不支持。' }, 405);
  const payload = await readPayload(request);
  if (typeof payload?.password !== 'string') return json({ error: '请输入管理密码。' }, 400);
  const now = Date.now();
  if (now >= retryAfter) {
    retryAfter = now + loginWindow;
    failedLogins = 0;
  }
  if (failedLogins >= limit) {
    return json({ error: '尝试次数过多，请稍后再试。' }, 429, { 'Retry-After': String(Math.ceil((retryAfter - now) / 1000)) });
  }
  if (!timingSafeEqual(digest(payload.password), digest(config.password))) {
    failedLogins++;
    return json({ error: '管理密码错误。' }, 401);
  }

  failedLogins = 0;
  const value = String(Math.floor(now / 1000) + sessionSeconds) + '.' + randomBytes(16).toString('hex');
  const token = value + '.' + sign(config, value).toString('hex');
  const status = await activeCredentials();
  return json({ zhihu: Boolean(status.zhihu), deepseek: Boolean(status.deepseek) }, 200, {
    'Set-Cookie': serializeCookie(config, token, sessionSeconds),
  });
}

async function updateKeys(request: Request) {
  const payload = await readPayload(request);
  if (!payload) return json({ error: '无法读取提交内容。' }, 400);
  const update: CredentialSettings = {};
  for (const field of ['zhihu', 'deepseek'] as const) {
    if (!(field in payload)) continue;
    const value = payload[field];
    if (typeof value !== 'string' || !/^[\x21-\x7e]{12,1024}$/u.test(value.trim())) {
      return json({ error: '请填写完整的 API 凭证。' }, 400);
    }
    update[field] = value.trim();
  }
  if (!Object.keys(update).length) return json({ error: '请填写至少一项凭证。' }, 400);
  await saveCredentials(update);
  return credentialStatus();
}

export async function adminApi(request: Request, action: string) {
  const config = configuration();
  if (!config) return json({ error: '管理后台需要配置 APP_ORIGIN、ADMIN_PASSWORD 和 APP_SECRET。' }, 503);
  if (request.method !== 'GET' && request.headers.get('origin') !== config.origin) {
    return json({ error: '请求来源与管理后台地址不一致。' }, 403);
  }
  try {
    if (action === 'session') return await session(request, config);
    if (action !== 'keys') return json({ error: '接口不存在。' }, 404);
    if (!signedIn(request, config)) return json({ error: '请先登录。' }, 401);
    if (request.method === 'GET') return await credentialStatus();
    if (request.method === 'PUT') return await updateKeys(request);
    return json({ error: '请求方式不支持。' }, 405);
  } catch {
    return json({ error: '凭证存储暂时不可用，请检查服务端数据目录和 APP_SECRET。' }, 503);
  }
}
