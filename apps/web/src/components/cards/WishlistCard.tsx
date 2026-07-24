export function WishlistCard({ data }: { data: any }) {
  const items = data.items || [];

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-txt-muted shadow-sm">
        心愿单为空
      </div>
    );
  }

  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-txt">❤️ 心愿单</span>
        <span className="text-[11px] text-txt-muted">{items.length} 件商品</span>
      </div>
      {items.map((item: any, i: number) => (
        <div key={item.id} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 ${
          i < items.length - 1 ? 'border-b border-border-light' : ''
        }`}>
          {item.product?.imageUrl && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-2">
              <img src={item.product.imageUrl} alt="" className="h-full w-full rounded-lg object-cover" />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-[13px] font-semibold text-txt">{item.product?.name || '商品'}</p>
            <p className="mt-0.5 text-[13px] font-bold text-accent">{item.product?.price || ''}</p>
          </div>
          <div className="flex gap-1.5">
            <button className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white">购买</button>
            <button className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-txt-muted">移除</button>
          </div>
        </div>
      ))}
    </div>
  );
}
