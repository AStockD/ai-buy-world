'use client';

export function BatchSelectCard({ data, onAction }: { data: any; onAction?: (action: string, payload?: any) => void }) {
  const batches = data.batches || [];

  const handleSelect = (id: string) => {
    onAction?.('select_batch', id);
  };

  if (batches.length === 0) {
    return (
      <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
        <div className="border-b border-border px-4 py-3">
          <h4 className="text-[13px] font-semibold text-txt">选择集运批次</h4>
        </div>
        <div className="p-4 text-center text-sm text-txt-muted">暂无可用批次</div>
      </div>
    );
  }

  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <div className="border-b border-border px-4 py-3">
        <h4 className="text-[13px] font-semibold text-txt">选择集运批次</h4>
        <p className="mt-0.5 text-[11px] text-txt-muted">同批次集中发货，运费更优</p>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {batches.map((batch: any, i: number) => (
          <button
            key={batch.batchId}
            onClick={() => handleSelect(batch.batchId)}
            className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
              i < batches.length - 1 ? 'border-b border-border-light' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-txt">{batch.area}</span>
                <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand">
                  {batch.recommendLabel}
                </span>
              </div>
              <span className="text-xs text-txt-muted">{batch.batchNo}</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-txt-muted">
              <span>已集 {batch.currentOrders} 件</span>
              <span>货值 ${batch.currentValue?.toLocaleString()}</span>
              <span>提货人: {batch.pickupContactName}</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-txt-muted">
              {batch.shipDate && <span>预计发货: {new Date(batch.shipDate).toLocaleDateString('zh-CN')}</span>}
              <span>截止下单: {new Date(batch.orderDeadline).toLocaleDateString('zh-CN')}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
