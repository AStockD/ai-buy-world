'use client';

import { useState } from 'react';

export function ProductCard({ data, onAction }: { data: any; onAction?: (action: string, payload?: any) => void }) {
  const currency = data.price?.currency === 'CNY' ? '¥' : '$';
  const origCurrency = data.price?.originalCurrency === 'CNY' ? '¥' : '';
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({});

  const handleSpecSelect = (dimension: string, value: string) => {
    const newSpecs = { ...selectedSpecs, [dimension]: value };
    setSelectedSpecs(newSpecs);
    
    // Find matching SKU
    const selectedSku = data.skuVariants?.skus?.find((sku: any) => {
      return Object.entries(newSpecs).every(([dim, val]) => sku.specs?.[dim] === val);
    });
    
    if (selectedSku) {
      console.log('Selected SKU:', selectedSku);
      // TODO: Update conversation context with selected SKU
    }
  };

  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      {data.imageUrl && (
        <div className="relative h-[200px] overflow-hidden bg-gradient-to-br from-[#F3F0FF] to-[#FFF7ED]">
          <img src={data.imageUrl} alt={data.name} className="h-full w-full object-cover" />
          {data.sourcePlatform && (
            <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-2 py-[3px] text-[10px] font-semibold text-white backdrop-blur-[8px]">
              {data.sourcePlatform}
            </span>
          )}
          {data.verified && (
            <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-success px-2 py-[3px] text-[10px] font-semibold text-white">
              ✓ 已验货
            </span>
          )}
        </div>
      )}
      {!data.imageUrl && data.emoji && (
        <div className="flex h-[200px] items-center justify-center bg-gradient-to-br from-[#F3F0FF] to-[#FFF7ED] text-[80px]">
          {data.emoji}
        </div>
      )}
      <div className="p-3.5">
        <h3 className="mb-2 text-sm font-semibold leading-snug text-txt">{data.name}</h3>
        <div className="mb-2.5 flex items-baseline gap-2">
          <span className="text-[22px] font-extrabold text-accent">
            {currency}{data.price?.local}
          </span>
          {data.price?.original && (
            <span className="text-xs text-txt-muted line-through">
              {origCurrency}{data.price.original}
            </span>
          )}
        </div>
        <div className="mb-3.5 flex gap-3 text-[11px] text-txt-2">
          {data.rating && <span>★ {data.rating}</span>}
          {data.sales && <span>已售 {data.sales}</span>}
          {data.weightKg && <span>{data.weightKg}kg</span>}
        </div>

        {/* Shipping info */}
        {(data.shipping || data.weightKg) && (
          <div className="mb-3 rounded-lg border border-border-light bg-surface-2 p-2.5">
            {data.weightKg && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-txt-muted">预估重量</span>
                <span className="font-semibold text-txt">{data.weightKg} kg</span>
              </div>
            )}
            {data.shipping && (
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-txt-muted">预估运费</span>
                <span className="font-semibold text-txt">${data.shipping}</span>
              </div>
            )}
            {data.shipping && data.weightKg && (
              <div className="mt-1.5 flex items-center justify-between text-[13px]">
                <span className="font-bold text-txt">合计</span>
                <span className="font-bold text-accent">${(Number(data.price?.local || 0) + Number(data.shipping)).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* SKU variants */}
        {data.skuVariants?.skus && data.skuVariants.skus.length > 0 && (
          <div className="mb-3 rounded-xl border border-border-light bg-surface-2 p-3">
            <div className="mb-2.5 text-xs font-semibold text-txt">选择规格</div>
            {data.skuVariants.dimensions?.map((dim: string, di: number) => {
              const values = [...new Set(data.skuVariants.skus.map((s: any) => s.specs?.[dim]).filter(Boolean))] as string[];
              return (
                <div key={di} className="mb-2 last:mb-0">
                  <div className="mb-1 text-[11px] text-txt-muted">{dim}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((val: string, vi: number) => {
                      const isSelected = selectedSpecs[dim] === val;
                      return (
                        <button
                          key={vi}
                          onClick={() => handleSpecSelect(dim, val)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            isSelected
                              ? 'border-brand bg-brand-light font-semibold text-brand'
                              : 'border-border bg-surface text-txt-2 hover:border-brand hover:text-brand'
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => onAction?.('wishlist', { productId: data.productId })} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark">
            ❤️ 加入心愿单
          </button>
          <button onClick={() => onAction?.('buy', { productId: data.productId })} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-transparent px-3 py-2.5 text-[13px] font-semibold text-txt-2 transition-colors hover:border-brand hover:bg-brand-light hover:text-brand">
            直接购买
          </button>
        </div>
        <button
          onClick={() => {
            const url = data.sourceUrl || data.flylinkUrl || '';
            if (url && navigator.clipboard) {
              navigator.clipboard.writeText(url);
            }
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border-light bg-surface-2 px-3 py-2 text-[11px] text-txt-muted transition-colors hover:border-brand hover:text-brand"
        >
          🔗 分享商品
        </button>
      </div>
    </div>
  );
}
