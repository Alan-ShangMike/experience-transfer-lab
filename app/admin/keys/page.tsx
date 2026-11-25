'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import './admin.css';

type KeyStatus = { zhihu: boolean; deepseek: boolean };
type Screen = 'loading' | 'sign-in' | 'settings' | 'unavailable';

export default function AdminKeysPage() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [status, setStatus] = useState<KeyStatus>({ zhihu: false, deepseek: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch('/api/admin/keys', { signal: controller.signal, cache: 'no-store' });
        const payload = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setScreen('sign-in');
        } else if (response.ok) {
          setStatus(payload);
          setScreen('settings');
        } else {
          setError(payload.error || '暂时无法打开后台。');
          setScreen('unavailable');
        }
      } catch {
        if (controller.signal.aborted) return;
        setError('暂时无法连接后台。');
        setScreen('unavailable');
      }
    }
    void check();
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const signingIn = screen === 'sign-in';
    const data = signingIn
      ? { password: String(values.get('password') ?? '') }
      : Object.fromEntries(['zhihu', 'deepseek'].flatMap((key) => {
        const value = String(values.get(key) ?? '').trim();
        return value ? [[key, value]] : [];
      }));
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(signingIn ? '/api/admin/session' : '/api/admin/keys', {
        method: signingIn ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (!signingIn && response.status === 401) setScreen('sign-in');
        throw new Error(payload.error || '操作失败，请重试。');
      }
      form.reset();
      setStatus(payload);
      setScreen('settings');
      if (!signingIn) setNotice('凭证已保存，下次请求会使用新配置。');
    } catch (cause) {
      setError(cause instanceof Error && !(cause instanceof TypeError) ? cause.message : '后台连接暂时不可用。');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/session', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setScreen('sign-in');
    } catch {
      setError('退出失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-screen">
      <div className="admin-container">
        <a className="admin-home" href="/">经验迁移 Lab</a>
        <section className="glass admin-panel" aria-labelledby="admin-title" aria-busy={busy}>
          <header className="admin-header">
            <KeyRound size={22} aria-hidden="true" />
            <div>
              <h1 id="admin-title">API 凭证管理</h1>
              <p>{screen === 'settings' ? '分别配置资料检索和分析服务。' : '登录后可管理服务凭证。'}</p>
            </div>
          </header>
          {screen === 'loading' && <p role="status">正在读取管理后台…</p>}
          {screen === 'sign-in' && (
            <form className="admin-form" onSubmit={submit}>
              <label><span>管理密码</span>
                <input autoComplete="current-password" name="password" type="password" required />
              </label>
              <button className="admin-primary" type="submit" disabled={busy}>{busy ? '登录中…' : '登录后台'}</button>
            </form>
          )}
          {screen === 'settings' && (
            <form className="admin-form" onSubmit={submit}>
              <label>
                <span className="admin-label">知乎 Access Secret <small data-ready={status.zhihu}>{status.zhihu ? '已配置' : '待配置'}</small></span>
                <input autoComplete="new-password" name="zhihu" type="password" placeholder="填写新的 Access Secret" maxLength={1024} />
              </label>
              <label>
                <span className="admin-label">DeepSeek API Key <small data-ready={status.deepseek}>{status.deepseek ? '已配置' : '待配置'}</small></span>
                <input autoComplete="new-password" name="deepseek" type="password" placeholder="填写新的 API Key" maxLength={1024} />
              </label>
              <p className="admin-help">更换一项时，另一项留空即可。</p>
              <div className="admin-actions">
                <button className="admin-primary" type="submit" disabled={busy}>{busy ? '正在保存…' : '保存凭证'}</button>
                <button className="admin-secondary" type="button" onClick={signOut} disabled={busy}>退出登录</button>
              </div>
            </form>
          )}
          {error && <p className="admin-feedback" role="alert">{error}</p>}
          {notice && <p className="admin-feedback success" role="status">{notice}</p>}
        </section>
      </div>
    </main>
  );
}
