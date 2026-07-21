export function ShippingCard({ data }: { data: any }) {
  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border bg-gradient-to-br from-brand-light to-accent-light px-4 py-3">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-brand-dark">✈️ 运费费率计算</span>
      </div>
      <div className="p-3.5">
        {data.calculatedFee != null && (
          <div className="mb-3 rounded-xl bg-brand-light p-3 text-center">
            <p className="text-xs text-txt-muted">预估运费</p>
            <p className="text-[22px] font-extrabold text-accent">${data.calculatedFee}</p>
            <p className="text-xs text-txt-muted">{data.weightKg}kg · {data.region} · {data.category}</p>
          </div>
        )}
        <div className="space-y-1.5">
          {data.rateTable?.slice(0, 5).map((r: any) => (
            <div key={r.region} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-xs">
              <div>
                <div className="font-bold text-txt">{r.region}</div>
                <div className="text-[10px] text-txt-muted">{r.time || ''}</div>
              </div>
              <span className="font-bold text-accent">${r.ratePerKg}/kg</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
