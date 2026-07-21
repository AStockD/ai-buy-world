'use client';

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
};

function getStepIndex(status: string) {
  return STEPS.findIndex(s => s.key === status);
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
      {orders.map((order: any) => {
        const currentIdx = getStepIndex(order.status);
        return (
          <div key={order.orderId || order.orderNo} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-xs text-txt-muted">
                订单号 <span className="font-bold text-txt">{order.orderNo}</span>
              </span>
              <span className={`rounded-full px-2.5 py-[3px] text-[11px] font-bold ${STATUS_COLORS[order.status] || 'bg-warning-light text-warning'}`}>
                {order.status}
              </span>
            </div>

            <div className="p-4">
              {order.productName && (
                <p className="mb-3 text-sm text-txt line-clamp-1">{order.productName}</p>
              )}

              {/* Timeline */}
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

              <div className="flex items-baseline justify-between rounded-lg bg-surface-2 px-3 py-2">
                <span className="text-sm font-bold text-accent">${order.totalAmount}</span>
                <span className="text-xs text-txt-muted">
                  {new Date(order.createdAt || order.created_at).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {data.total > orders.length && (
        <p className="text-center text-xs text-txt-muted">共 {data.total} 个订单</p>
      )}
    </div>
  );
}
