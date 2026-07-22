'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/store-auth';
import { useChatStore } from '../../lib/store-chat';
import { api } from '../../lib/api';
import { Drawer } from '../../components/Drawer';
import { Sidebar } from '../../components/Sidebar';

export default function WishlistPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadWishlist();
  }, [user]);

  const loadWishlist = async () => {
    setLoading(true);
    try {
      const res = await api.listWishlist();
      setItems(res.data || []);
    } catch { /* empty */ }
    setLoading(false);
  };

  const handleRemove = async (id: string) => {
    try {
      await api.removeFromWishlist(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch { /* empty */ }
  };

  const handleBuy = (product: any) => {
    const msg = `帮我下单购买这个商品，商品ID: ${product.id}`;
    sendMessage(msg);
    router.push('/');
  };

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bg">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
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
          <h1 className="text-[15px] font-semibold text-txt">心愿单</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto max-w-[760px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light">
                  <span className="text-2xl">❤️</span>
                </div>
                <p className="text-sm text-txt-muted">心愿单为空，快去添加喜欢的商品吧</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.length > 1 && (
                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-xl bg-brand/50 py-2.5 text-[13px] font-semibold text-white/70"
                    title="批量下单功能即将上线"
                  >
                    一键全部下单 ({items.length} 件) — 即将上线
                  </button>
                )}
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm">
                    {item.product?.image_url && (
                      <img src={item.product.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                    )}
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm text-txt line-clamp-2">{item.product?.name || '商品'}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand">{item.status}</span>
                        <span className="text-xs text-txt-muted">{item.region}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => item.product && handleBuy(item.product)}
                        className="rounded-lg bg-brand px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-dark"
                      >
                        购买
                      </button>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="rounded-lg p-1.5 text-txt-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
