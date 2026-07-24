'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '../lib/store-chat';
import { useAuthStore } from '../lib/store-auth';
import { getCardComponent } from '../lib/card-registry';
import { api } from '../lib/api';
import { Sidebar } from './Sidebar';
import { Drawer } from './Drawer';

export function ChatPage() {
  const router = useRouter();
  const { messages, isStreaming, sendMessage, error, clearError } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<number, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFeedback = (msgIndex: number, value: number) => {
    setFeedbacks((prev) => ({ ...prev, [msgIndex]: prev[msgIndex] === value ? 0 : value }));
  };

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

  const handleTextareaInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bg">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      <Drawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
        <Sidebar onMobileClose={() => setMobileMenuOpen(false)} />
      </Drawer>

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center border-b border-border bg-surface px-5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="mr-3 flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-txt-muted transition-colors hover:bg-surface-2 hover:text-brand md:hidden"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 text-[15px] font-semibold text-txt">AI购物助手</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-success-light px-2.5 py-1 text-[11px] font-semibold text-success">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              <span>Flylink 已就绪</span>
            </div>
            <button className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-txt-muted transition-colors hover:bg-surface-2 hover:text-brand" title="分享">
              🔗
            </button>
            <button onClick={() => router.push('/settings')} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border text-txt-muted transition-colors hover:bg-surface-2 hover:text-brand" title="设置">
              ⚙️
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-6">
          <div className="mx-auto max-w-[760px] px-5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center px-5 pb-8 pt-12">
                <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-gradient-to-br from-brand to-accent text-4xl shadow-[0_8px_32px_rgba(124,58,237,0.35)]">
                  🛍️
                </div>
                <h2 className="mb-2 text-2xl font-bold tracking-tight text-txt">
                  您好，我是 AIBuyWorld 购物助手
                </h2>
                <p className="max-w-[380px] text-center text-sm leading-relaxed text-txt-muted">
                  粘贴任意淘宝、京东商品链接，我会帮您一键转化、比价、下单，并安排集运直送到您家门口
                </p>

                <div className="mt-8 grid w-full max-w-[560px] grid-cols-2 gap-3">
                  <WelcomeCard icon="🔗" title="粘贴商品链接" desc="支持淘宝、天猫、京东、拼多多链接一键解析" onClick={() => !isStreaming && sendMessage('帮我看看这个链接')} />
                  <WelcomeCard icon="📦" title="查询我的订单" desc="实时追踪订单状态与集运进度" onClick={() => !isStreaming && sendMessage('查看我的订单')} />
                  <WelcomeCard icon="❤️" title="查看心愿单" desc="已收藏 3 件商品，等待您下单" onClick={() => !isStreaming && sendMessage('查看心愿单')} />
                  <WelcomeCard icon="🌟" title="社区好物推荐" desc="美国华人社区本周热购榜单" onClick={() => !isStreaming && sendMessage('有什么推荐')} />
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-[11px] text-txt-muted">
                  <span>💡</span>
                  <span>支持直接发送淘宝口令，例如：¥AbCd1234¥</span>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`mb-6 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-sm">
                      🛍️
                    </div>
                    <span className="text-xs font-semibold text-txt-2">AI购物助手</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-bubble px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-brand to-brand-dark text-white rounded-br-md'
                      : 'border border-border bg-surface text-txt rounded-bl-md'
                  }`}
                >
                  <p className="mb-2 last:mb-0 whitespace-pre-wrap">{msg.content}</p>
                  {msg.cards?.map((card, j) => (
                    <div key={j} className="mt-2">
                      <CardRenderer
                        type={card.type}
                        data={card.data}
                        onAction={async (action, payload) => {
                          if (isStreaming) return;

                          // 支付动作直接调用 API
                          if (action === 'pay' && payload?.orderId) {
                            try {
                              await api.payOrder(payload.orderId);
                              sendMessage(`订单 ${payload.orderNo || ''} 已支付成功`);
                            } catch (err: any) {
                              sendMessage(`支付失败：${err.message || '请稍后重试'}`);
                            }
                            return;
                          }

                          const pid = payload?.productId ? ` [productId:${payload.productId}]` : '';
                          const addressId = typeof payload === 'string' ? payload : payload?.addressId;
                          const aid = addressId ? ` [addressId:${addressId}]` : '';
                          const actionMessages: Record<string, string> = {
                            wishlist: `把这个商品加入心愿单${pid}`,
                            buy: `帮我下单${pid}`,
                            select_address: `选择地址${aid}`,
                            confirm_address: `确认使用地址${aid}`,
                            add_new_address: '我要添加一个新的收货地址',
                            select_batch: `选择批次 ${payload || ''}`,
                            willing_yes: '我愿意代他人收货',
                            willing_no: '不太方便，还是算了',
                            remove_wishlist: `从心愿单移除这个商品${pid}`,
                          };
                          const text = actionMessages[action];
                          if (text) sendMessage(text);
                        }}
                      />
                    </div>
                  ))}
                </div>
                {msg.role === 'assistant' && msg.content && (
                  <div className="mt-1 flex items-center gap-1 px-1">
                    <button
                      onClick={() => handleFeedback(i, 1)}
                      className={`rounded p-1 text-xs transition-colors ${feedbacks[i] === 1 ? 'text-brand' : 'text-txt-muted hover:text-brand'}`}
                      title="有帮助"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleFeedback(i, -1)}
                      className={`rounded p-1 text-xs transition-colors ${feedbacks[i] === -1 ? 'text-danger' : 'text-txt-muted hover:text-danger'}`}
                      title="没帮助"
                    >
                      👎
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="mb-6 flex items-start gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-sm">
                  🛍️
                </div>
                <div className="inline-flex items-center gap-1 rounded-bubble rounded-bl-md border border-border bg-surface px-4 py-3">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand opacity-40" style={{ animationDelay: '0ms' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand opacity-40" style={{ animationDelay: '200ms' }} />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand opacity-40" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 border-b border-danger/20 bg-danger/10 px-5 py-2">
            <span className="flex-1 text-xs text-danger">{error}</span>
            <button onClick={clearError} className="text-xs text-danger/70 hover:text-danger">关闭</button>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-surface px-5 pb-[env(safe-area-inset-bottom)] pt-4">
          <div className="mx-auto max-w-[760px]">
            {/* Quick Chips */}
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              <Chip icon="📦" label="查看订单" onClick={() => !isStreaming && sendMessage('查看我的订单')} />
              <Chip icon="⭐" label="好物推荐" onClick={() => !isStreaming && sendMessage('有什么推荐')} />
              <Chip icon="✈️" label="计算运费" onClick={() => !isStreaming && sendMessage('运费怎么算')} />
              <Chip icon="🔗" label="淘宝测试" onClick={() => !isStreaming && sendMessage('https://item.taobao.com/item.htm?id=623675070331')} />
              <Chip icon="🔗" label="京东测试" onClick={() => !isStreaming && sendMessage('https://item.jd.com/100056338181.html')} />
              <Chip icon="🔗" label="1688测试" onClick={() => !isStreaming && sendMessage('https://detail.1688.com/offer/1031641480452.html')} />
            </div>

            {/* Input Box */}
            <div className="flex items-end gap-2.5 rounded-xl border-2 border-border bg-surface-bg px-4 py-3 transition-colors focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onInput={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="粘贴淘宝/京东链接，或输入您的问题…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-txt outline-none placeholder:text-txt-muted"
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <button className="flex h-8 w-8 items-center justify-center rounded-full text-txt-muted transition-colors hover:bg-brand-light hover:text-brand" title="上传图片">
                  📷
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-all hover:bg-brand-dark hover:scale-105 disabled:cursor-not-allowed disabled:bg-border disabled:scale-100"
                >
                  ➤
                </button>
              </div>
            </div>

            <div className="mt-2 text-center text-[11px] text-txt-muted">
              AI 生成内容仅供参考，下单前请核实商品信息 · 区域集运每周统一发货
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function WelcomeCard({ icon, title, desc, onClick }: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-all hover:-translate-y-px hover:border-brand hover:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]"
    >
      <span className="shrink-0 text-2xl leading-none">{icon}</span>
      <div>
        <div className="text-[13px] font-semibold text-txt">{title}</div>
        <div className="text-[11px] leading-snug text-txt-muted">{desc}</div>
      </div>
    </button>
  );
}

function Chip({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="whitespace-nowrap rounded-full border border-border bg-surface px-3 py-1 text-xs text-txt-2 transition-colors hover:border-brand hover:bg-brand-light hover:text-brand"
    >
      {icon} {label}
    </button>
  );
}

function CardRenderer({ type, data, onAction }: { type: string; data: any; onAction?: (action: string, payload?: any) => void }) {
  const Component = getCardComponent(type);
  if (!Component) {
    return <pre className="overflow-x-auto rounded-lg bg-surface-2 p-2 text-xs">{JSON.stringify(data, null, 2)}</pre>;
  }
  return <Component data={data} onAction={onAction} />;
}
