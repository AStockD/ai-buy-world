import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { addressRoutes } from '../api/address.routes';
import { authService } from '../services/auth/auth.service';
import { prisma } from '../lib/prisma';

let app: FastifyInstance;
let token: string;
let userId: string;
let addressId: string;

beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    return reply.code(err.statusCode || 500).send({ success: false, error: { code: 'ERROR', message: err.message } });
  });

  await app.register(addressRoutes, { prefix: '/api/addresses' });
  await app.ready();

  // 创建测试用户并获取 token
  await prisma.user.deleteMany({ where: { email: 'addrtest@example.com' } });
  const result = await authService.register('addrtest@example.com', '123456', '地址测试');
  token = result.accessToken;
  userId = result.user.id;
});

afterAll(async () => {
  await prisma.userAddress.deleteMany({ where: { user_id: userId } });
  await prisma.user.deleteMany({ where: { email: 'addrtest@example.com' } });
  await app.close();
});

const authHeaders = () => ({ authorization: `Bearer ${token}` });

describe('Address API', () => {
  it('POST / — 创建地址', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/addresses',
      headers: authHeaders(),
      payload: {
        recipient_name: '张三',
        phone: '+1-234567890',
        country_code: 'US',
        admin_area1: 'California',
        admin_area2: 'Los Angeles',
        street_address1: '123 Main St',
        postal_code: '90001',
        is_default: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.recipient_name).toBe('张三');
    expect(body.data.is_default).toBe(true);
    addressId = body.data.id;
  });

  it('GET / — 列出地址', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/addresses',
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /:id — 获取地址详情', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/addresses/${addressId}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(addressId);
  });

  it('PATCH /:id — 更新地址', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/addresses/${addressId}`,
      headers: authHeaders(),
      payload: { phone: '+1-999999999' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.phone).toBe('+1-999999999');
  });

  it('POST / — 创建第二个地址并设为默认', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/addresses',
      headers: authHeaders(),
      payload: {
        recipient_name: '李四',
        phone: '+1-111111111',
        country_code: 'US',
        admin_area1: 'New York',
        street_address1: '456 Broadway',
        is_default: true,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.is_default).toBe(true);

    // 验证第一个地址不再是默认
    const first = await app.inject({
      method: 'GET',
      url: `/api/addresses/${addressId}`,
      headers: authHeaders(),
    });
    expect(first.json().data.is_default).toBe(false);
  });

  it('DELETE /:id — 删除地址', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/addresses/${addressId}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);

    // 验证已删除
    const get = await app.inject({
      method: 'GET',
      url: `/api/addresses/${addressId}`,
      headers: authHeaders(),
    });
    expect(get.statusCode).toBe(404);
  });

  it('无 token 返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/addresses',
    });

    expect(res.statusCode).toBe(401);
  });
});
