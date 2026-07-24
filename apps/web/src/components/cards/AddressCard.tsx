export function AddressCard({ data }: { data: any }) {
  const addresses = data.addresses || [];

  if (addresses.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-txt-muted shadow-sm">
        暂无地址
      </div>
    );
  }

  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      {addresses.map((addr: any, i: number) => (
        <div key={addr.id} className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
          i < addresses.length - 1 ? 'border-b border-border-light' : ''
        }`}>
          <span className="mt-0.5 text-xl">📍</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-txt">{addr.recipientName}</span>
              {addr.isDefault && (
                <span className="rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand">默认</span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] leading-normal text-txt-muted">{addr.formatted}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
