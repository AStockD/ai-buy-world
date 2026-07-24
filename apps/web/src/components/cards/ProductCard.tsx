export function ProductCard({ data }: { data: any }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
      {data.imageUrl && (
        <div className="flex h-32 items-center justify-center bg-gray-100">
          <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-3">
        <h3 className="text-sm font-medium leading-tight text-gray-800 line-clamp-2">{data.name}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-red-500">
            {data.price?.currency === 'CNY' ? '¥' : '$'}{data.price?.local}
          </span>
          {data.price?.original && (
            <span className="text-xs text-gray-400 line-through">
              {data.price?.originalCurrency === 'CNY' ? '¥' : ''}{data.price?.original}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-500">
          {data.sourcePlatform && <span>来源: {data.sourcePlatform}</span>}
          {data.weightKg && <span>重量: {data.weightKg}kg</span>}
        </div>
        {data.skuVariants?.skus && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.skuVariants.skus.slice(0, 3).map((sku: any) => (
              <span key={sku.sku_id} className="rounded bg-white px-2 py-0.5 text-xs text-gray-600 border border-gray-200">
                {Object.values(sku.specs || {}).join(' / ')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
