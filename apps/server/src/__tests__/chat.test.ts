import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { chatRoutes } from '../api/chat.routes';
import { authService } from '../services/auth/auth.service';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

let app: FastifyInstance;
let token: string;
let userId: string;
let conversationId: string;

beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    return reply.code(err.statusCode || 500).send({ success: false, error: { code: 'ERROR', message: err.message } });
  });

  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.ready();

  await prisma.user.deleteMany({ where: { email: 'chattest@example.com' } });
  const result = await authService.register('chattest@example.com', '123456', '对话测试');
  token = result.accessToken;
  userId = result.user.id;
});

afterAll(async () => {
  const convs = await prisma.conversation.findMany({ where: { user_id: userId } });
  for (const c of convs) {
    await prisma.message.deleteMany({ where: { conversation_id: c.id } });
  }
  await prisma.conversation.deleteMany({ where: { user_id: userId } });
  await prisma.user.deleteMany({ where: { email: 'chattest@example.com' } });

  const ctxKeys = await redis.keys('conv:ctx:*');
  if (ctxKeys.length) await redis.del(...ctxKeys);
  const stateKeys = await redis.keys('conv:state:*');
  if (stateKeys.length) await redis.del(...stateKeys);

  await app.close();
});

const authHeaders = () => ({ authorization: `Bearer ${token}` });

describe('Chat — Conversation CRUD', () => {
  it('POST /conversations — 创建对话', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations',
      headers: authHeaders(),
      payload: { title: '测试对话' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('测试对话');
    conversationId = body.data.id;
  });

  it('GET /conversations — 对话列表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations',
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /conversations/:id — 对话详情', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${conversationId}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(conversationId);
    expect(res.json().data.messages).toEqual([]);
  });

  it('无 token 返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Chat — Agent 消息处理', () => {
  it('POST /message — 发送问候消息', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      headers: authHeaders(),
      payload: { conversationId, content: '你好' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.text).toContain('AIBuyWorld');
  });

  it('POST /message — 发送链接触发商品解析', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      headers: authHeaders(),
      payload: { conversationId, content: '帮我看看这个 https://item.taobao.com/test-chat-product' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const cards = body.data.cards;
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards[0].type).toBe('product_card');
  });

  it('POST /message — 查询订单', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      headers: authHeaders(),
      payload: { conversationId, content: '查看我的订单' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const cards = body.data.cards;
    expect(cards.some((c: any) => c.type === 'order_card')).toBe(true);
  });

  it('POST /message — 查询运费', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      headers: authHeaders(),
      payload: { conversationId, content: '运费怎么算' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const cards = body.data.cards;
    expect(cards.some((c: any) => c.type === 'shipping_card')).toBe(true);
  });

  it('GET /conversations/:id — 消息已持久化', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${conversationId}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const messages = res.json().data.messages;
    expect(messages.length).toBeGreaterThanOrEqual(4);
    expect(messages.some((m: any) => m.role === 'user')).toBe(true);
    expect(messages.some((m: any) => m.role === 'assistant')).toBe(true);
  });
});

describe('Chat — 对话删除', () => {
  it('DELETE /conversations/:id — 软删除对话', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations',
      headers: authHeaders(),
      payload: { title: '待删除' },
    });
    const deleteId = create.json().data.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/chat/conversations/${deleteId}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);

    const get = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${deleteId}`,
      headers: authHeaders(),
    });
    expect(get.json().success).toBe(false);
  });
});
