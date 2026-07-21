'use client';

export function WillingCard({ data, onAction }: { data: any; onAction?: (action: string, payload?: any) => void }) {
  const handleSelect = (willing: boolean) => {
    onAction?.(willing ? 'willing_yes' : 'willing_no');
  };

  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <div className="border-b border-border px-4 py-3">
        <h4 className="text-[13px] font-semibold text-txt">代他人收货</h4>
      </div>
      <div className="p-4">
        <p className="mb-4 text-[13px] leading-relaxed text-txt-2">
          如果您的地址方便代收邻居或朋友的包裹，运费可享 <span className="font-bold text-accent">8 折</span> 优惠。
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => handleSelect(true)}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 border-border bg-surface px-4 py-3 transition-all hover:border-brand hover:bg-brand-light"
          >
            <span className="text-2xl">🤝</span>
            <span className="text-[13px] font-semibold text-txt">愿意</span>
            <span className="text-[11px] text-txt-muted">运费 8 折</span>
          </button>
          <button
            onClick={() => handleSelect(false)}
            className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 border-border bg-surface px-4 py-3 transition-all hover:border-brand hover:bg-brand-light"
          >
            <span className="text-2xl">🏠</span>
            <span className="text-[13px] font-semibold text-txt">不方便</span>
            <span className="text-[11px] text-txt-muted">原价运费</span>
          </button>
        </div>
      </div>
    </div>
  );
}
