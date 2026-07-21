'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../lib/store-chat';
import { ProductCard } from './cards/ProductCard';
import { OrderCard } from './cards/OrderCard';
import { WishlistCard } from './cards/WishlistCard';
import { ShippingCard } from './cards/ShippingCard';
import { AddressCard } from './cards/AddressCard';
import { RecommendationCard } from './cards/RecommendationCard';

export function ChatPage() {
  const { messages, isStreaming, sendMessage } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-center border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-primary-600">AIBuyWorld</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-5xl">🛒</div>
            <h2 className="text-lg font-medium text-gray-700">你好，我是 AI 购物助手</h2>
            <p className="mt-2 max-w-xs text-sm text-gray-400">
              把淘宝、天猫的商品链接发给我，我来帮你完成跨境购物
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['帮我看看这个链接', '查看我的订单', '运费怎么算', '有什么推荐'].map((hint) => (
                <button
                  key={hint}
                  onClick={() => sendMessage(hint)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-800 shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.cards?.map((card, j) => (
                <div key={j} className="mt-2">
                  <CardRenderer type={card.type} data={card.data} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="flex space-x-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息或粘贴商品链接..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function CardRenderer({ type, data }: { type: string; data: any }) {
  switch (type) {
    case 'product_card': return <ProductCard data={data} />;
    case 'order_card': return <OrderCard data={data} />;
    case 'wishlist_card': return <WishlistCard data={data} />;
    case 'shipping_card': return <ShippingCard data={data} />;
    case 'address_card': return <AddressCard data={data} />;
    case 'recommendation_card': return <RecommendationCard data={data} />;
    default: return <pre className="overflow-x-auto text-xs">{JSON.stringify(data, null, 2)}</pre>;
  }
}
