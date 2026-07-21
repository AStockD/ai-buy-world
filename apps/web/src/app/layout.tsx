'use client';

import './globals.css';
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

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, [restore]);

  if (isLoading) {
    return (
      <html lang="zh-CN">
        <body>
          <div className="flex min-h-screen items-center justify-center bg-surface-bg">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
