'use client';

export function SuccessCard({ data }: { data: any }) {
  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <div className="flex flex-col items-center px-4 py-6">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-3xl">
          ✓
        </div>
        <h4 className="mb-1 text-[15px] font-bold text-txt">支付成功</h4>
        <p className="mb-4 text-[12px] text-txt-muted">
          订单 <span className="font-semibold text-txt">{data.orderNo}</span> 已确认
        </p>

        <div className="w-full space-y-2 rounded-lg bg-surface-2 px-3 py-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-txt-muted">支付金额</span>
            <span className="font-bold text-accent">${data.totalAmount?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-txt-muted">集运批次</span>
            <span className="font-semibold text-txt">{data.batchArea || '-'}</span>
          </div>
          {data.estimatedArrival && (
            <div className="flex justify-between">
              <span className="text-txt-muted">预计到达</span>
              <span className="font-semibold text-txt">
                {new Date(data.estimatedArrival).toLocaleDateString('zh-CN')}
              </span>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-txt-muted">
          商品正在集货中，发货后会自动通知您
        </p>
      </div>
    </div>
  );
}
