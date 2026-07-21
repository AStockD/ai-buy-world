'use client';

import { useState } from 'react';
import { useAuthStore } from '../lib/store-auth';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!name.trim()) {
          setError('请输入昵称');
          setLoading(false);
          return;
        }
        await register(email, password, name);
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-accent text-2xl shadow-[0_8px_32px_rgba(124,58,237,0.35)]">
            🛍️
          </div>
          <h1 className="text-2xl font-bold text-brand">AIBuyWorld</h1>
          <p className="mt-1 text-sm text-txt-muted">AI 跨境购物助手</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <input
              type="text"
              placeholder="昵称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm outline-none transition-colors focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]"
            />
          )}
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm outline-none transition-colors focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm outline-none transition-colors focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]"
          />

          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand-dark hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? '处理中...' : isLogin ? '登录' : '注册'}
          </button>
        </form>

        <button
          onClick={() => { setEmail('docker@test.com'); setPassword('Test123456'); setIsLogin(true); setError(''); }}
          className="mt-4 w-full rounded-xl border border-dashed border-brand/30 bg-brand-light py-2.5 text-xs text-brand transition-colors hover:border-brand/50 hover:bg-brand-light/80"
        >
          测试账号一键填入
        </button>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          className="mt-3 w-full text-center text-sm text-txt-muted transition-colors hover:text-brand"
        >
          {isLogin ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
      </div>
    </div>
  );
}
