'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store-auth';
import { api } from '../../lib/api';
import { BottomTabs } from '../../components/BottomTabs';

export default function WishlistPage() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-800">心愿单</h1>
      </header>

      <div className="flex-1 px-4 py-4 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl">💝</div>
            <p className="mt-2 text-sm text-gray-400">心愿单为空，快去添加喜欢的商品吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                {item.product?.image_url && (
                  <img src={item.product.image_url} alt="" className="h-16 w-16 rounded object-cover" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-gray-700 line-clamp-2">{item.product?.name || '商品'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{item.status}</span>
                    <span className="text-xs text-gray-400">{item.region}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomTabs />
    </div>
  );
}
