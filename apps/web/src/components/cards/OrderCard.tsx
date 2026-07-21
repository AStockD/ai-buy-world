export function OrderCard({ data }: { data: any }) {
  const orders = data.orders || [];

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center text-sm text-gray-400">
        暂无订单
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order: any) => (
        <div key={order.orderId} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{order.orderNo}</span>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-600">{order.status}</span>
          </div>
          {order.productName && <p className="mt-1 text-sm text-gray-700 line-clamp-1">{order.productName}</p>}
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-sm font-medium text-red-500">${order.totalAmount}</span>
            <span className="text-xs text-gray-400">
              {new Date(order.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      ))}
      {data.total > orders.length && (
        <p className="text-center text-xs text-gray-400">共 {data.total} 个订单</p>
      )}
    </div>
  );
}
