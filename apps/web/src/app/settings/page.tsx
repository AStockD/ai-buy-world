'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/store-auth';

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [language, setLanguage] = useState('zh-CN');
  const [notifyEnabled, setNotifyEnabled] = useState(true);

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

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full rounded-xl border border-danger/30 bg-danger/5 py-3 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/10"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
