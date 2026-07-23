'use client';

import { useState } from 'react';
import { api } from '../../lib/api';

const STEPS = [
  { key: '待支付', label: '已下单', icon: '📋' },
  { key: '集货中', label: '国内集货', icon: '📦' },
  { key: '运输中', label: '国际发运', icon: '✈️' },
  { key: '待提货', label: '已到达', icon: '📍' },
  { key: '已提货', label: '已签收', icon: '✅' },
];

const STATUS_COLORS: Record<string, string> = {
  '待支付': 'bg-gray-300 text-gray-500',
  '集货中': 'bg-warning-light text-warning',
  '运输中': 'bg-brand-light text-brand',
  '待提货': 'bg-blue-100 text-blue-600',
  '已提货': 'bg-success-light text-success',
  '已取消': 'bg-gray-200 text-gray-400',
  '支付失败': 'bg-red-100 text-red-500',
};

function getStepIndex(status: string) {
  const idx = STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : -1;
}

export function OrderCard({ data }: { data: any }) {
  const orders = data.orders || [];

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-txt-muted shadow-sm">
        暂无订单
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order: any) => (
        <OrderItem key={order.orderId || order.orderNo} order={order} />
      ))}
      {data.total > orders.length && (
        <p className="text-center text-xs text-txt-muted">共 {data.total} 个订单</p>
      )}
    </div>
  );
}

function OrderItem({ order }: { order: any }) {
  const [status, setStatus] = useState(order.status);
  const [pickupCode, setPickupCode] = useState(order.pickupCode || '');
  const [showPickupInput, setShowPickupInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const currentIdx = getStepIndex(status);
  const orderId = order.orderId || order.id;

  const handlePay = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.payOrder(orderId);
      if (res.success) {
        setStatus('集货中');
      } else {
        setError(res.error?.message || '支付失败');
      }
    } catch (err: any) {
      setError(err.message || '支付失败');
    }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.cancelOrder(orderId);
      if (res.success) {
        setStatus('已取消');
      } else {
        setError(res.error?.message || '取消失败');
      }
    } catch (err: any) {
      setError(err.message || '取消失败');
    }
    setActionLoading(false);
  };

  const handleConfirmPickup = async () => {
    if (!pickupCode.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await api.confirmPickup(orderId, pickupCode.trim());
      if (res.success) {
        setStatus('已提货');
        setShowPickupInput(false);
      } else {
        setError(res.error?.message || '确认提货失败');
      }
    } catch (err: any) {
      setError(err.message || '确认提货失败');
    }
    setActionLoading(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs text-txt-muted">
          订单号 <span className="font-bold text-txt">{order.orderNo || order.order_no}</span>
        </span>
        <span className={`rounded-full px-2.5 py-[3px] text-[11px] font-bold ${STATUS_COLORS[status] || 'bg-warning-light text-warning'}`}>
          {status}
        </span>
      </div>

      <div className="p-4">
        {order.productName && (
          <p className="mb-3 text-sm text-txt line-clamp-1">{order.productName}</p>
        )}

        {/* Timeline */}
        {currentIdx >= 0 && (
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((step, i) => {
              const isActive = i <= currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={step.key} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    {i > 0 && (
                      <div className={`h-0.5 flex-1 ${i <= currentIdx ? 'bg-brand' : 'bg-border'}`} />
                    )}
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                      isActive ? 'bg-brand text-white' : 'bg-surface-2 text-txt-muted'
                    } ${isCurrent ? 'ring-2 ring-brand/30' : ''}`}>
                      {step.icon}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 ${i < currentIdx ? 'bg-brand' : 'bg-border'}`} />
                    )}
                  </div>
                  <span className={`mt-1 text-[10px] ${isActive ? 'font-semibold text-txt' : 'text-txt-muted'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-baseline justify-between rounded-lg bg-surface-2 px-3 py-2">
          <span className="text-sm font-bold text-accent">${order.totalAmount || Number(order.total_amount || 0).toFixed(2)}</span>
          <span className="text-xs text-txt-muted">
            {new Date(order.createdAt || order.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</div>
        )}

        {/* Actions */}
        {status === '待支付' && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={handlePay}
              disabled={actionLoading}
              className="flex-1 rounded-lg bg-brand py-2 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {actionLoading ? '处理中...' : '去支付'}
            </button>
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="rounded-lg border border-border px-3 py-2 text-xs text-txt-muted hover:bg-surface-2 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        )}

        {status === '待提货' && (
          <div className="mt-3">
            {order.pickupCode && (
              <p className="mb-2 text-xs text-txt-muted">
                取件码: <span className="font-mono font-bold text-brand">{order.pickupCode}</span>
              </p>
            )}
            {!showPickupInput ? (
              <button
                onClick={() => setShowPickupInput(true)}
                className="w-full rounded-lg bg-blue-500 py-2 text-xs font-bold text-white hover:bg-blue-600"
              >
                确认提货
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入取件码"
                  value={pickupCode}
                  onChange={(e) => setPickupCode(e.target.value)}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-xs"
                />
                <button
                  onClick={handleConfirmPickup}
                  disabled={actionLoading || !pickupCode.trim()}
                  className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  确认
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
