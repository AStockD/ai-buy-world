import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { productRoutes } from '../api/product.routes';
import { wishlistRoutes } from '../api/wishlist.routes';
import { orderRoutes } from '../api/order.routes';
import { authService } from '../services/auth/auth.service';
import { orderService } from '../services/order/order.service';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

let app: FastifyInstance;
let token: string;
let userId: string;
let productId: string;
let wishlistId: string;
let orderId: string;

beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
    }
    return reply.code(err.statusCode || 500).send({ success: false, error: { code: 'ERROR', message: err.message } });
  });

  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(wishlistRoutes, { prefix: '/api/wishlist' });
  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.ready();

  await prisma.user.deleteMany({ where: { email: 'prodttest@example.com' } });
  const result = await authService.register('prodttest@example.com', '123456', '商品测试');
  token = result.accessToken;
  userId = result.user.id;
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { user_id: userId } });
  await prisma.wishlist.deleteMany({ where: { user_id: userId } });
  if (productId) await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.user.deleteMany({ where: { email: 'prodttest@example.com' } });

  const keys = await redis.keys('order:seq:*');
  if (keys.length) await redis.del(...keys);

  await app.close();
});

const authHeaders = () => ({ authorization: `Bearer ${token}` });

describe('Product API', () => {
  it('GET / — 公开商品列表', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products' });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('POST /parse — 解析链接（需认证）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products/parse',
      headers: authHeaders(),
      payload: { url: 'https://item.taobao.com/test-product-123' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.isNew).toBe(true);
    expect(body.data.product.name).toContain('测试商品');
    productId = body.data.product.id;
  });

  it('POST /parse — 重复解析返回 isNew=false', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products/parse',
      headers: authHeaders(),
      payload: { url: 'https://item.taobao.com/test-product-123' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.isNew).toBe(false);
  });

  it('POST /parse — 无 token 返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/products/parse',
      payload: { url: 'https://item.taobao.com/test' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /:id — 商品详情', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/products/${productId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(productId);
  });
});

describe('Wishlist API', () => {
  it('POST / — 添加心愿单', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: authHeaders(),
      payload: { product_id: productId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.product_id).toBe(productId);
    expect(body.data.status).toBe('待购');
    wishlistId = body.data.id;
  });

  it('GET / — 心愿单列表', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
    expect(res.json().data[0].product).toBeDefined();
  });

  it('POST / — 重复添加不报错', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: authHeaders(),
      payload: { product_id: productId },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(wishlistId);
  });

  it('DELETE /:id — 软删除心愿单', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${wishlistId}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('已过期');
  });

  it('POST / — 恢复已删除的心愿单', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: authHeaders(),
      payload: { product_id: productId },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('待购');
  });
});

describe('Order API', () => {
  it('订单号生成格式正确', async () => {
    const orderNo = await orderService.generateOrderNo();
    expect(orderNo).toMatch(/^AB\d{6}\d{4}$/);
  });

  it('订单号递增不重复', async () => {
    const no1 = await orderService.generateOrderNo();
    const no2 = await orderService.generateOrderNo();
    expect(no1).not.toBe(no2);
  });

  it('通过 service 创建订单后 GET /:id 可查', async () => {
    const order = await orderService.create({
      user_id: userId,
      product_id: productId,
      product_price: 15.99,
      shipping_fee: 5.00,
      total_amount: 20.99,
      home_address: { formatted: '123 Test St' },
    });
    orderId = order.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/${orderId}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.order_no).toMatch(/^AB/);
    expect(res.json().data.status).toBe('待支付');
  });

  it('GET / — 订单列表分页', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.page).toBe(1);
  });

  it('GET /:id — 他人订单不可见', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await app.inject({
      method: 'GET',
      url: `/api/orders/${fakeId}`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(false);
  });
});
