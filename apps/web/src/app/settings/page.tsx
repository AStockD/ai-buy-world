'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/store-auth';

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [language, setLanguage] = useState('zh-CN');
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-5 py-3">
        <div className="mx-auto flex max-w-[760px] items-center gap-3">
          <button onClick={() => router.back()} className="text-txt-muted hover:text-brand">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[15px] font-semibold text-txt">设置</h1>
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-5 py-6">
        {/* Language */}
        <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-txt">语言</h2>
          <div className="flex gap-2">
            {[
              { value: 'zh-CN', label: '中文' },
              { value: 'en-US', label: 'English' },
            ].map((lang) => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value)}
                className={`rounded-xl px-4 py-2 text-[13px] transition-colors ${
                  language === lang.value
                    ? 'bg-brand text-white'
                    : 'border border-border bg-surface text-txt-2 hover:border-brand'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-txt">通知</h2>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-txt-2">推送通知</span>
            <button
              onClick={() => setNotifyEnabled(!notifyEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${notifyEnabled ? 'bg-brand' : 'bg-border'}`}
            >
              <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifyEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </section>

        {/* About */}
        <section className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-txt">关于</h2>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-txt-muted">版本</span>
              <span className="text-txt">0.2.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-txt-muted">技术栈</span>
              <span className="text-txt">Next.js + Fastify</span>
            </div>
          </div>
        </section>

        {/* Logout — visually separated to prevent accidental clicks */}
        <div className="mt-10 border-t border-border pt-6">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full rounded-xl py-3 text-[13px] text-txt-muted transition-colors hover:text-danger"
          >
            退出登录
          </button>
        </div>

        {/* Logout Confirmation */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowLogoutConfirm(false)}>
            <div
              className="w-full max-w-[760px] rounded-t-2xl bg-surface p-5 pb-[env(safe-area-inset-bottom)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 text-center">
                <div className="mb-2 text-3xl">👋</div>
                <h3 className="text-[15px] font-semibold text-txt">确认退出登录？</h3>
                <p className="mt-1 text-[12px] text-txt-muted">退出后需要重新登录才能使用</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 rounded-xl border border-border bg-surface py-3 text-[13px] font-medium text-txt transition-colors hover:bg-surface-2"
                >
                  取消
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 rounded-xl bg-danger py-3 text-[13px] font-medium text-white transition-colors hover:bg-danger/90"
                >
                  确认退出
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
