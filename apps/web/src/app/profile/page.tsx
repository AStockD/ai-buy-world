'use client';

import { useAuthStore } from '../../lib/store-auth';
import { BottomTabs } from '../../components/BottomTabs';

export default function ProfilePage() {
  const { user, logout } = useAuthStore();

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-800">我的</h1>
      </header>

      <div className="flex-1 pb-20">
        <div className="flex items-center gap-4 bg-white px-4 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl text-primary-600">
            {user.name?.charAt(0) || '?'}
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-800">{user.name}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{user.region}</span>
          </div>
        </div>

        <div className="mt-4 space-y-1 bg-white">
          <MenuItem label="我的地址" icon="📍" />
          <MenuItem label="通知消息" icon="🔔" />
          <MenuItem label="购物指南" icon="📖" />
          <MenuItem label="关于我们" icon="ℹ️" />
        </div>

        <div className="mt-8 px-4">
          <button
            onClick={logout}
            className="w-full rounded-lg border border-red-200 py-3 text-sm text-red-500 transition-colors hover:bg-red-50"
          >
            退出登录
          </button>
        </div>
      </div>

      <BottomTabs />
    </div>
  );
}

function MenuItem({ label, icon }: { label: string; icon: string }) {
  return (
    <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50">
      <span className="text-lg">{icon}</span>
      <span className="text-sm text-gray-700">{label}</span>
      <svg className="ml-auto h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
