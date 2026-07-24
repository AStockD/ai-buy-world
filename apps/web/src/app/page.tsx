'use client';

import { useAuthStore } from '../lib/store-auth';
import { AuthPage } from '../components/AuthPage';
import { ChatPage } from '../components/ChatPage';

export default function Home() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <AuthPage />;

  return <ChatPage />;
}
