export function RecommendationCard({ data }: { data: any }) {
  const items = data.items || [];

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-txt-muted shadow-sm">
        暂无推荐
      </div>
    );
  }

  return (
    <div className="max-w-[420px]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-txt">🌟 热门好物推荐</span>
        <span className="text-[11px] font-semibold text-brand">查看全部</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((item: any) => (
          <div key={item.productId} className="cursor-pointer overflow-hidden rounded-xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
            {item.imageUrl && (
              <div className="flex h-[110px] items-center justify-center bg-gradient-to-br from-[#F3F0FF] to-[#FFF7ED]">
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="p-2.5">
              <p className="text-xs font-semibold text-txt line-clamp-2 leading-snug">{item.name}</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-accent">
                  {item.currency === 'CNY' ? '¥' : '$'}{item.price}
                </span>
                {item.originalPrice && (
                  <span className="text-[11px] text-txt-muted line-through">{item.originalPrice}</span>
                )}
              </div>
              {item.salesCount > 0 && (
                <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-txt-muted">
                  🔥 已售 {item.salesCount}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
