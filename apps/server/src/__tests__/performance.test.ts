import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { registerRoutes } from '../api/routes';
import { authService } from '../services/auth/auth.service';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

let app: FastifyInstance;
let authToken: string;
let userId: string;
let conversationId: string;

const RED_LINE_MS = 500;
const WARN_MS = 200;

async function measure(fn: () => Promise<any>): Promise<{ result: any; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms };
}

beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    return reply.code(err.statusCode || 500).send({ success: false, error: { code: 'ERROR', message: err.message } });
  });
  await registerRoutes(app);

  // 清理并注册测试用户
  const existingIds = await prisma.user.findMany({ where: { email: 'perf-test@test.com' }, select: { id: true } }).then(u => u.map(x => x.id));
  await prisma.wishlist.deleteMany({ where: { user_id: { in: existingIds } } });
  await prisma.notification.deleteMany({ where: { user_id: { in: existingIds } } });
  await prisma.transaction.deleteMany({ where: { user_id: { in: existingIds } } });
  await prisma.order.deleteMany({ where: { user_id: { in: existingIds } } });
  await prisma.user.deleteMany({ where: { email: 'perf-test@test.com' } });

  const result = await authService.register('perf-test@test.com', '123456', 'Perf Test');
  authToken = result.accessToken;
  userId = result.user.id;

  // 创建测试会话
  const convRes = await app.inject({
    method: 'POST',
    url: '/api/chat/conversations',
    headers: { authorization: `Bearer ${authToken}` },
    payload: { title: 'Perf Test' },
  });
  conversationId = convRes.json().data.id;
});

afterAll(async () => {
  await prisma.message.deleteMany({ where: { conversation_id: conversationId } });
  await prisma.conversation.deleteMany({ where: { id: conversationId } });
  await prisma.wishlist.deleteMany({ where: { user_id: userId } });
  await prisma.notification.deleteMany({ where: { user_id: userId } });
  await prisma.order.deleteMany({ where: { user_id: userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await app.close();
});

describe('性能基准验证', () => {
  it('GET /api/health — 响应时间 < 100ms', async () => {
    const { ms } = await measure(() => app.inject({
      method: 'GET',
      url: '/api/health',
    }));
    console.log(`  health: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(100);
  });

  it('POST /api/chat/message — 响应时间 < 500ms', async () => {
    const { ms } = await measure(() => app.inject({
      method: 'POST',
      url: '/api/chat/message',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { conversationId, content: '你好' },
    }));
    console.log(`  chat message: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(RED_LINE_MS);
  });

  it('POST /api/chat/message (商品链接) — 响应时间 < 500ms', async () => {
    const { ms } = await measure(() => app.inject({
      method: 'POST',
      url: '/api/chat/message',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { conversationId, content: '帮我看看 https://item.taobao.com/perf-test' },
    }));
    console.log(`  product parse: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(RED_LINE_MS);
  });

  it('GET /api/products/recent — 响应时间 < 200ms', async () => {
    const { ms } = await measure(() => app.inject({
      method: 'GET',
      url: '/api/products/recent',
    }));
    console.log(`  products recent: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(WARN_MS);
  });

  it('GET /api/exchange-rate/current — 响应时间 < 100ms', async () => {
    const { ms } = await measure(() => app.inject({
      method: 'GET',
      url: '/api/exchange-rate/current',
    }));
    console.log(`  exchange rate: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(100);
  });

  it('POST /api/chat/message (批量 10 次) — 平均响应时间 < 500ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const { ms } = await measure(() => app.inject({
        method: 'POST',
        url: '/api/chat/message',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { conversationId, content: `测试消息 ${i}` },
      }));
      times.push(ms);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    console.log(`  batch 10x: avg=${avg.toFixed(1)}ms, p95=${p95.toFixed(1)}ms`);
    expect(avg).toBeLessThan(RED_LINE_MS);
  });
});
