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
        <div key={order.orderId} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-xs text-txt-muted">订单号 <span className="font-bold text-txt">{order.orderNo}</span></span>
            <span className={`rounded-full px-2.5 py-[3px] text-[11px] font-bold ${
              order.status === '已提货' ? 'bg-success-light text-success' :
              order.status === '运输中' ? 'bg-brand-light text-brand' :
              'bg-warning-light text-warning'
            }`}>{order.status}</span>
          </div>
          <div className="p-4">
            {order.productName && <p className="text-sm text-txt line-clamp-1">{order.productName}</p>}
            <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 text-xs">
              <span className="text-txt-muted">{order.orderNo}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-sm font-bold text-accent">${order.totalAmount}</span>
              <span className="text-xs text-txt-muted">
                {new Date(order.createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>
        </div>
      ))}
      {data.total > orders.length && (
        <p className="text-center text-xs text-txt-muted">共 {data.total} 个订单</p>
      )}
    </div>
  );
}
