'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store-auth';
import { api } from '../../lib/api';
import { BottomTabs } from '../../components/BottomTabs';

export default function OrdersPage() {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!user) return;
    loadOrders();
  }, [user, statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.listOrders(statusFilter || undefined);
      setOrders(res.items || []);
    } catch { /* empty */ }
    setLoading(false);
  };

  if (!user) return null;

  const statuses = ['', '待支付', '集货中', '运输中', '待提货', '已提货'];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-800">我的订单</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-gray-100 bg-white px-4 py-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
              statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s || '全部'}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">暂无订单</div>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => (
              <div key={order.id} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{order.order_no}</span>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-600">{order.status}</span>
                </div>
                {order.product && (
                  <div className="mt-2 flex gap-3">
                    {order.product.image_url && (
                      <img src={order.product.image_url} alt="" className="h-16 w-16 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 line-clamp-2">{order.product.name}</p>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-red-500">${Number(order.total_amount).toFixed(2)}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(order.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomTabs />
    </div>
  );
}
