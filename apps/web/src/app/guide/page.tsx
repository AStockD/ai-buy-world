'use client';

import { useRouter } from 'next/navigation';

const STEPS = [
  {
    num: 1,
    icon: '🔗',
    title: '粘贴商品链接',
    desc: '复制淘宝、天猫、京东、拼多多的商品链接，发送给我即可自动解析',
    example: '帮我看看 https://item.taobao.com/item.htm?id=...',
  },
  {
    num: 2,
    icon: '🎨',
    title: '选择规格',
    desc: '查看商品详情，选择颜色、尺寸等规格，确认价格',
    example: '选红色 XL 码',
  },
  {
    num: 3,
    icon: '📍',
    title: '确认地址与批次',
    desc: '选择收货地址，加入最优集运批次，享受社区拼团运费折扣',
    example: '用默认地址，选第一个批次',
  },
  {
    num: 4,
    icon: '💳',
    title: '支付下单',
    desc: '确认订单金额，一键支付，实时追踪物流状态直到签收',
    example: '确认支付',
  },
];

export default function GuidePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-5 py-3">
        <div className="mx-auto flex max-w-[760px] items-center gap-3">
          <button onClick={() => router.back()} className="text-txt-muted hover:text-brand">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[15px] font-semibold text-txt">购物指南</h1>
        </div>
      </header>

      <div className="mx-auto max-w-[760px] px-5 py-6">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-accent text-3xl shadow-lg">
            🛍️
          </div>
          <h2 className="text-xl font-bold text-txt">4 步轻松海淘</h2>
          <p className="mt-1 text-sm text-txt-muted">从粘贴链接到签收，全程 AI 助手帮您搞定</p>
        </div>

        <div className="space-y-4">
          {STEPS.map((step) => (
            <div key={step.num} className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-light text-2xl">
                  {step.icon}
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                      {step.num}
                    </span>
                    <h3 className="text-[14px] font-semibold text-txt">{step.title}</h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-txt-2">{step.desc}</p>
                  <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-txt-muted">
                    💬 &ldquo;{step.example}&rdquo;
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-brand/20 bg-brand-light/30 p-4 text-center">
          <p className="text-[13px] text-txt-2">
            💡 <span className="font-semibold text-brand">小贴士</span>：代他人收货可享运费 8 折优惠
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="mt-6 w-full rounded-xl bg-brand py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          开始购物
        </button>
      </div>
    </div>
  );
}
