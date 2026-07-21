'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

const FILTERS = ['全部', '订单历史', '周边', '平台精选', '个性化'];

export default function CommunityPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('全部');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      const res = await api.listProducts();
      setItems(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-[15px] font-semibold text-txt">社区推荐</h1>
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-5 py-4">
        {/* Filter tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                activeFilter === f
                  ? 'bg-brand text-white'
                  : 'border border-border bg-surface text-txt-2 hover:border-brand hover:text-brand'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-txt-muted">暂无推荐商品</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item: any) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
              >
                {item.image_url && (
                  <div className="flex h-[140px] items-center justify-center bg-gradient-to-br from-[#F3F0FF] to-[#FFF7ED]">
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-3">
                  <p className="mb-1.5 text-[12px] font-semibold leading-snug text-txt line-clamp-2">
                    {item.name}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[15px] font-bold text-accent">
                      {item.source_currency === 'CNY' ? '¥' : '$'}{item.source_price}
                    </span>
                    <span className="text-[10px] text-txt-muted">{item.source_currency}</span>
                  </div>
                  {item.sales_count > 0 && (
                    <p className="mt-1 text-[10px] text-txt-muted">已售 {item.sales_count}</p>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    <button className="flex-1 rounded-lg bg-brand py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-dark">
                      购买
                    </button>
                    <button className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[11px] text-txt-muted transition-colors hover:border-brand hover:text-brand">
                      ❤️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
