export function RecommendationCard({ data }: { data: any }) {
  const items = data.items || [];

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center text-sm text-gray-400">
        暂无推荐
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-gray-700">热门好物推荐</h4>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item: any) => (
          <div key={item.productId} className="overflow-hidden rounded-lg border border-gray-100 bg-white">
            {item.imageUrl && (
              <div className="flex h-24 items-center justify-center bg-gray-50">
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="p-2">
              <p className="text-xs text-gray-700 line-clamp-2">{item.name}</p>
              <p className="mt-1 text-sm font-bold text-red-500">
                {item.currency === 'CNY' ? '¥' : '$'}{item.price}
              </p>
              {item.salesCount > 0 && (
                <p className="text-xs text-gray-400">已售 {item.salesCount}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
