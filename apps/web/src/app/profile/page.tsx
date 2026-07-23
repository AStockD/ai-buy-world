'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/store-auth';
import { Drawer } from '../../components/Drawer';
import { Sidebar } from '../../components/Sidebar';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bg">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <Drawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
        <Sidebar onMobileClose={() => setMobileMenuOpen(false)} />
      </Drawer>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-border bg-surface px-5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="mr-3 flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-txt-muted transition-colors hover:bg-surface-2 hover:text-brand md:hidden"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-[15px] font-semibold text-txt">我的</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[760px] px-5 py-4">
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-pink-500 text-xl font-bold text-white">
                {user.name?.charAt(0) || '?'}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-txt">{user.name}</h2>
                <p className="text-sm text-txt-muted">{user.email}</p>
                {user.region && (
                  <span className="mt-1 inline-block rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand">{user.region}</span>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-0.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
              <MenuItem label="我的地址" icon="📍" onClick={() => router.push('/addresses')} />
              <MenuItem label="通知消息" icon="🔔" />
              <MenuItem label="购物指南" icon="📖" />
              <MenuItem label="关于我们" icon="ℹ️" />
            </div>

            <div className="mt-6">
              <button
                onClick={logout}
                className="w-full rounded-2xl border border-danger/20 bg-surface py-3 text-sm font-medium text-danger shadow-sm transition-colors hover:bg-danger/5"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MenuItem({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand">{icon}</span>
      <span className="text-sm text-txt">{label}</span>
      <svg className="ml-auto h-4 w-4 text-txt-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
