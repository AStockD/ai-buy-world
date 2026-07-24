'use client';

import { useState } from 'react';

export function AddressSelectCard({ data, onAction }: { data: any; onAction?: (action: string, payload?: any) => void }) {
  const addresses = data.addresses || [];
  const [selectedId, setSelectedId] = useState(data.selectedId || addresses[0]?.id);

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  if (addresses.length === 0) {
    return (
      <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
        <div className="border-b border-border px-4 py-3">
          <h4 className="text-[13px] font-semibold text-txt">选择收货地址</h4>
        </div>
        <div className="p-4 text-center">
          <p className="mb-3 text-sm text-txt-muted">暂无收货地址</p>
          <button
            onClick={() => onAction?.('add_new_address')}
            className="rounded-xl bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            添加新地址
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[420px] overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
      <div className="border-b border-border px-4 py-3">
        <h4 className="text-[13px] font-semibold text-txt">选择收货地址</h4>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {addresses.map((addr: any, i: number) => {
          const isSelected = selectedId === addr.id;
          return (
            <button
              key={addr.id}
              onClick={() => handleSelect(addr.id)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${
                i < addresses.length - 1 ? 'border-b border-border-light' : ''
              } ${isSelected ? 'bg-brand-light/40' : ''}`}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                isSelected ? 'border-brand bg-brand text-white' : 'border-border text-transparent'
              }`}>
                ✓
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-txt">{addr.recipientName || addr.recipient_name}</span>
                  <span className="text-[11px] text-txt-muted">{addr.phone}</span>
                  {addr.is_default && (
                    <span className="rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand">默认</span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] leading-normal text-txt-muted">{addr.formatted}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-border px-4 py-2.5">
        <button
          onClick={() => onAction?.('confirm_address', selectedId)}
          className="w-full rounded-xl bg-brand py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          确认地址
        </button>
        <button
          onClick={() => onAction?.('add_new_address')}
          className="mt-2 w-full rounded-xl border border-border py-2 text-[13px] text-txt-muted transition-colors hover:border-brand hover:text-brand"
        >
          添加新地址
        </button>
      </div>
    </div>
  );
}
