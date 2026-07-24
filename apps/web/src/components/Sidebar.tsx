'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store-auth';
import { useChatStore } from '../lib/store-chat';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarProps {
  onMobileClose?: () => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function Sidebar({ onMobileClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const { conversations, currentConversationId, loadConversations, selectConversation, sendMessage, error, isStreaming } = useChatStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewChat = () => {
    useChatStore.setState({ currentConversationId: null, messages: [] });
    onMobileClose?.();
    if (pathname === '/') {
      router.replace(`/?t=${Date.now()}`);
    } else {
      router.push('/');
    }
  };

  const [selectingId, setSelectingId] = useState<string | null>(null);

  const handleSelect = async (id: string) => {
    setSelectingId(id);
    try {
      await selectConversation(id);
      onMobileClose?.();
      if (pathname !== '/') {
        router.push('/');
      }
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <aside className="flex h-full w-64 min-w-64 flex-col bg-sidebar-bg border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 pb-4 pt-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand to-accent text-lg">
          🛍️
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-bold tracking-tight text-[#F0EDFF]">AIBuyWorld</span>
          <span className="text-[10px] tracking-wide text-sidebar-muted">AIBuyWorld · AI购物助手</span>
        </div>
      </div>

      {/* New Chat Button */}
      <button
        onClick={handleNewChat}
        className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-brand/35 bg-brand/20 px-3.5 py-2.5 text-[13px] font-medium text-sidebar-text transition-all hover:border-brand/50 hover:bg-brand/30"
      >
        <span>✏️</span>
        <span>新对话</span>
      </button>

      {/* Recent Conversations */}
      <div className="flex-1 overflow-y-auto px-2 pt-4">
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
          最近对话
        </div>
        {conversations.length === 0 && (
          <div className="px-2.5 py-4 text-center text-[11px] text-sidebar-muted">暂无对话记录</div>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => !selectingId && handleSelect(conv.id)}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[9px] text-[13px] transition-colors ${
              conv.id === currentConversationId
                ? 'bg-sidebar-active text-[#DDD6FE]'
                : 'text-sidebar-text hover:bg-sidebar-hover'
            } ${selectingId === conv.id ? 'opacity-60' : ''}`}
          >
            <span className="w-5 shrink-0 text-center text-[15px]">
              {selectingId === conv.id ? '⏳' : '💬'}
            </span>
            <span className="flex-1 truncate">{conv.title || '新对话'}</span>
            <span className="text-[10px] text-sidebar-muted">{formatTime(conv.updated_at)}</span>
          </div>
        ))}
      </div>

      <div className="mx-3 my-2 h-px bg-sidebar-border" />

      {/* My Shopping */}
      <div className="px-2">
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
          我的购物
        </div>
        <Link href="/wishlist" onClick={onMobileClose} className="flex items-center gap-2 rounded-lg px-2.5 py-[9px] text-[13px] text-sidebar-text transition-colors hover:bg-sidebar-hover">
          <span className="w-5 text-center text-[15px]">❤️</span>
          <span className="flex-1 truncate">心愿单</span>
        </Link>
        <Link href="/orders" onClick={onMobileClose} className="flex items-center gap-2 rounded-lg px-2.5 py-[9px] text-[13px] text-sidebar-text transition-colors hover:bg-sidebar-hover">
          <span className="w-5 text-center text-[15px]">📦</span>
          <span className="flex-1 truncate">我的订单</span>
        </Link>
      </div>

      <div className="mx-3 my-2 h-px bg-sidebar-border" />

      {/* Quick Features */}
      <div className="px-2">
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
          快捷功能
        </div>
        <div onClick={() => { if (isStreaming) return; if (pathname !== '/') { router.push('/'); } setTimeout(() => sendMessage('有什么推荐'), 100); onMobileClose?.(); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[9px] text-[13px] text-sidebar-text transition-colors hover:bg-sidebar-hover">
          <span className="w-5 shrink-0 text-center text-[15px]">⭐</span>
          <span>好物推荐</span>
        </div>
        <div onClick={() => { if (isStreaming) return; if (pathname !== '/') { router.push('/'); } setTimeout(() => sendMessage('运费怎么算'), 100); onMobileClose?.(); }} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[9px] text-[13px] text-sidebar-text transition-colors hover:bg-sidebar-hover">
          <span className="w-5 shrink-0 text-center text-[15px]">✈️</span>
          <span>运费计算</span>
        </div>
        <Link href="/settings" onClick={onMobileClose} className="flex items-center gap-2 rounded-lg px-2.5 py-[9px] text-[13px] text-sidebar-text transition-colors hover:bg-sidebar-hover">
          <span className="w-5 shrink-0 text-center text-[15px]">⚙️</span>
          <span>设置</span>
        </Link>
      </div>

      {/* User Info */}
      <div className="flex items-center gap-2.5 border-t border-sidebar-border p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-pink-500 text-sm font-bold text-white">
          {user?.name?.charAt(0) || '?'}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-[13px] font-semibold text-[#E2E8F0]">{user?.name || '用户'}</div>
          <div className="text-[11px] text-sidebar-muted">
            📍 {user?.region || '未设置'}
          </div>
        </div>
        <button
          onClick={logout}
          className="text-sidebar-muted transition-colors hover:text-sidebar-text"
          title="退出登录"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l4-4m-4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
