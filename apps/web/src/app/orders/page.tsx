'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store-auth';
import { api } from '../../lib/api';
import { Drawer } from '../../components/Drawer';
import { Sidebar } from '../../components/Sidebar';

const STATUS_COLORS: Record<string, string> = {
  '待支付': 'bg-gray-200 text-gray-600',
  '已支付': 'bg-blue-100 text-blue-600',
  '集货中': 'bg-warning-light text-warning',
  '运输中': 'bg-brand-light text-brand',
  '待提货': 'bg-blue-100 text-blue-600',
  '已提货': 'bg-success-light text-success',
  '已取消': 'bg-gray-100 text-gray-400',
  '支付失败': 'bg-red-100 text-red-500',
};

export default function OrdersPage() {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pickupOrderId, setPickupOrderId] = useState<string | null>(null);
  const [pickupCode, setPickupCode] = useState('');

  useEffect(() => {
    if (!user) return;
    loadOrders();
  }, [user, statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listOrders(statusFilter || undefined);
      setOrders(res.items || []);
    } catch (err: any) {
      setError(err.message || '加载订单失败');
    }
    setLoading(false);
  };

  const handlePay = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await api.payOrder(orderId);
      if (res.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: '集货中' } : o));
      }
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleCancel = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await api.cancelOrder(orderId);
      if (res.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: '已取消' } : o));
      }
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleConfirmPickup = async (orderId: string) => {
    if (!pickupCode.trim()) return;
    setActionLoading(orderId);
    try {
      const res = await api.confirmPickup(orderId, pickupCode.trim());
      if (res.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: '已提货' } : o));
        setPickupOrderId(null);
        setPickupCode('');
      }
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  if (!user) return null;

  const statuses = ['', '待支付', '集货中', '运输中', '待提货', '已提货'];

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
          <h1 className="text-[15px] font-semibold text-txt">我的订单</h1>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-5 py-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
                statusFilter === s ? 'bg-brand text-white' : 'bg-surface-2 text-txt-2 hover:bg-border'
              }`}
            >
              {s || '全部'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto max-w-[760px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <p className="text-sm text-red-500">{error}</p>
                <button onClick={loadOrders} className="mt-3 text-sm text-brand hover:underline">重试</button>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
                  <span className="text-2xl">📦</span>
                </div>
                <p className="text-sm text-txt-muted">暂无订单</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order: any) => (
                  <div key={order.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-txt-muted">{order.order_no}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-brand-light text-brand'}`}>
                        {order.status}
                      </span>
                    </div>
                    {order.product && (
                      <div className="mt-3 flex gap-3">
                        {order.product.image_url && (
                          <img src={order.product.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm text-txt line-clamp-2">{order.product.name}</p>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-sm font-bold text-accent md:text-base">${Number(order.total_amount).toFixed(2)}</span>
                            <span className="text-xs text-txt-muted">
                              {new Date(order.created_at).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 取件码展示 */}
                    {order.status === '待提货' && order.pickup_code && (
                      <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
                        取件码: <span className="font-mono font-bold">{order.pickup_code}</span>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="mt-3 flex gap-2">
                      {order.status === '待支付' && (
                        <>
                          <button
                            onClick={() => handlePay(order.id)}
                            disabled={actionLoading === order.id}
                            className="flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                          >
                            {actionLoading === order.id ? '处理中...' : '去支付'}
                          </button>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={actionLoading === order.id}
                            className="rounded-lg border border-border px-3 py-2 text-xs text-txt-muted hover:bg-surface-2 disabled:opacity-50"
                          >
                            取消
                          </button>
                        </>
                      )}

                      {order.status === '待提货' && (
                        pickupOrderId === order.id ? (
                          <div className="flex w-full gap-2">
                            <input
                              type="text"
                              placeholder="输入取件码"
                              value={pickupCode}
                              onChange={(e) => setPickupCode(e.target.value)}
                              className="flex-1 rounded-lg border border-border px-3 py-2 text-xs"
                            />
                            <button
                              onClick={() => handleConfirmPickup(order.id)}
                              disabled={actionLoading === order.id || !pickupCode.trim()}
                              className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => { setPickupOrderId(null); setPickupCode(''); }}
                              className="rounded-lg border border-border px-3 py-2 text-xs text-txt-muted"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPickupOrderId(order.id)}
                            className="flex-1 rounded-lg bg-blue-500 py-2 text-xs font-bold text-white hover:bg-blue-600"
                          >
                            确认提货
                          </button>
                        )
                      )}

                      {order.status === '支付失败' && (
                        <button
                          onClick={() => handlePay(order.id)}
                          disabled={actionLoading === order.id}
                          className="flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
                        >
                          重新支付
                        </button>
                      )}
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
