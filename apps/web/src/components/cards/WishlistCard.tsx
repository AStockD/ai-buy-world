export function WishlistCard({ data }: { data: any }) {
  const items = data.items || [];

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center text-sm text-gray-400">
        心愿单为空
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item: any) => (
        <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
          {item.product?.imageUrl && (
            <img src={item.product.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
          )}
          <div className="flex-1">
            <p className="text-sm text-gray-700 line-clamp-1">{item.product?.name || '商品'}</p>
            <span className="text-xs text-gray-400">{item.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
