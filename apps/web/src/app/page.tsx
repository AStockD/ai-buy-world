'use client';

import { useAuthStore } from '../lib/store-auth';
import { BottomTabs } from '../components/BottomTabs';
import { AuthPage } from '../components/AuthPage';
import { ChatPage } from '../components/ChatPage';

export default function Home() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <AuthPage />;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 pb-16">
        <ChatPage />
      </main>
      <BottomTabs />
    </div>
  );
}
