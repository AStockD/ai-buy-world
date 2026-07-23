'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { AddressForm } from '../../components/cards/AddressForm';
import { Sidebar } from '../../components/Sidebar';
import { Drawer } from '../../components/Drawer';

type Address = {
  id: string;
  recipient_name: string;
  phone: string;
  country_code: string;
  admin_area1: string;
  admin_area2?: string;
  street_address1: string;
  street_address2?: string;
  postal_code?: string;
  formatted: string;
  is_default: boolean;
  label?: string;
};

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listAddresses();
      setAddresses(res.items || res || []);
    } catch (err: any) {
      setError(err.message || '加载地址失败');
    }
    setLoading(false);
  };

  const handleAdd = async (formData: any) => {
    setError('');
    try {
      await api.createAddress(formData);
      setShowForm(false);
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || '添加地址失败');
    }
  };

  const handleUpdate = async (formData: any) => {
    if (!editingAddress) return;
    setError('');
    try {
      await api.updateAddress(editingAddress.id, formData);
      setEditingAddress(null);
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || '更新地址失败');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setError('');
    try {
      await api.deleteAddress(deletingId);
      setDeletingId(null);
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || '删除地址失败');
    }
  };

  const handleSetDefault = async (id: string) => {
    setError('');
    try {
      await api.setDefaultAddress(id);
      await loadAddresses();
    } catch (err: any) {
      setError(err.message || '设置默认地址失败');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bg">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <Drawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
        <Sidebar onMobileClose={() => setMobileMenuOpen(false)} />
      </Drawer>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-border bg-surface px-5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="mr-3 flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-txt-muted transition-colors hover:bg-surface-2 hover:text-brand md:hidden"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button onClick={() => router.back()} className="mr-3 flex h-[34px] w-[34px] items-center justify-center rounded-lg text-txt-muted transition-colors hover:bg-surface-2 hover:text-brand">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[15px] font-semibold text-txt">收货地址</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto max-w-[760px]">
            {error && (
              <div className="mb-3 rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">
                {error}
                <button onClick={() => setError('')} className="ml-2 font-semibold underline">关闭</button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            ) : showForm ? (
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-txt">添加新地址</h3>
                <AddressForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
              </div>
            ) : editingAddress ? (
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-txt">编辑地址</h3>
                <AddressForm
                  countryCode={editingAddress.country_code}
                  initialData={editingAddress}
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingAddress(null)}
                />
              </div>
            ) : (
              <>
                {addresses.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
                      <span className="text-2xl">📍</span>
                    </div>
                    <p className="mb-4 text-sm text-txt-muted">暂无收货地址</p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="rounded-xl bg-brand px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
                    >
                      添加第一个地址
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <div key={addr.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-txt">{addr.recipient_name}</span>
                              <span className="text-[11px] text-txt-muted">{addr.phone}</span>
                              {addr.is_default && (
                                <span className="rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand">默认</span>
                              )}
                              {addr.label && (
                                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-txt-muted">{addr.label}</span>
                              )}
                            </div>
                            <p className="mt-1 text-[12px] leading-normal text-txt-muted">{addr.formatted}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2 border-t border-border-light pt-3">
                          {!addr.is_default && (
                            <button
                              onClick={() => handleSetDefault(addr.id)}
                              className="rounded-lg px-2.5 py-1 text-[11px] text-txt-muted transition-colors hover:bg-surface-2 hover:text-brand"
                            >
                              设为默认
                            </button>
                          )}
                          <button
                            onClick={() => setEditingAddress(addr)}
                            className="rounded-lg px-2.5 py-1 text-[11px] text-txt-muted transition-colors hover:bg-surface-2 hover:text-brand"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => setDeletingId(addr.id)}
                            className="rounded-lg px-2.5 py-1 text-[11px] text-txt-muted transition-colors hover:bg-surface-2 hover:text-danger"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => setShowForm(true)}
                      className="w-full rounded-2xl border border-dashed border-border py-3 text-[13px] text-txt-muted transition-colors hover:border-brand hover:text-brand"
                    >
                      + 添加新地址
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* 删除确认 BottomSheet */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-[420px] rounded-t-2xl bg-surface p-5 shadow-lg md:rounded-2xl">
            <h3 className="text-[15px] font-semibold text-txt">确认删除</h3>
            <p className="mt-2 text-sm text-txt-muted">确定要删除这个收货地址吗？此操作不可撤销。</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-[13px] font-medium text-txt-2 transition-colors hover:bg-surface-2"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-danger py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-danger/90"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
