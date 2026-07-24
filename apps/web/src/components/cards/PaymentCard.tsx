'use client';

export function PaymentCard({ data, onAction }: { data: any; onAction?: (action: string, payload?: any) => void }) {
  const handlePay = () => {
    onAction?.('pay');
  };

  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-txt">确认订单</h4>
          <span className={`rounded-full px-2.5 py-[3px] text-[11px] font-bold ${
            data.status === '已支付' ? 'bg-success-light text-success' :
            data.status === '待支付' ? 'bg-warning-light text-warning' :
            'bg-brand-light text-brand'
          }`}>
            {data.status || '待支付'}
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Product info */}
        <div className="mb-3 flex gap-3">
          {data.productImage && (
            <img src={data.productImage} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          )}
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-txt line-clamp-2">{data.productName}</p>
            <p className="mt-0.5 text-[11px] text-txt-muted">订单号: {data.orderNo}</p>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="mb-3 space-y-1.5 rounded-lg bg-surface-2 px-3 py-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-txt-muted">商品金额</span>
            <span className="font-semibold text-txt">${data.productPrice?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-txt-muted">运费</span>
            <span className="font-semibold text-txt">${data.shippingFee?.toFixed(2)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between text-success">
              <span>代收货折扣</span>
              <span>-${data.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1.5">
            <span className="font-bold text-txt">合计</span>
            <span className="text-lg font-extrabold text-accent">${data.totalAmount?.toFixed(2)}</span>
          </div>
        </div>

        {/* Batch info */}
        {data.batchArea && (
          <div className="mb-3 flex items-center gap-2 text-[11px] text-txt-muted">
            <span>📦</span>
            <span>集运批次: {data.batchArea}</span>
            {data.batchContact && <span>· 提货人: {data.batchContact}</span>}
          </div>
        )}

        {/* Pay button */}
        {(data.status === '待支付' || !data.status) && (
          <button
            onClick={handlePay}
            className="w-full rounded-xl bg-brand py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-brand-dark"
          >
            立即支付 ${data.totalAmount?.toFixed(2)}
          </button>
        )}

        {data.status === '已支付' && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-success-light py-2.5 text-[14px] font-bold text-success">
            <span>✓</span>
            <span>支付成功</span>
          </div>
        )}
      </div>
    </div>
  );
}
