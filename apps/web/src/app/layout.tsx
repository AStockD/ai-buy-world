'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../lib/store-auth';
import { api } from '../lib/api';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const restore = useAuthStore((s) => s.restore);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) api.setToken(token);
    restore();
  }, [restore]);

  if (isLoading) {
    return (
      <html lang="zh-CN">
        <body className="bg-gray-50">
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
