import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { orderRoutes } from '../api/order.routes';
import { authService } from '../services/auth/auth.service';
import { orderService } from '../services/order/order.service';
import { batchService } from '../services/batch/batch.service';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

let app: FastifyInstance;
let token: string;
let userId: string;
let productId: string;
let orderId: string;
let batchId: string;

beforeAll(async () => {
  app = Fastify();
  app.setErrorHandler((err, req, reply) => {
    return reply.code(err.statusCode || 500).send({ success: false, error: { message: err.message } });
  });

  await app.register(orderRoutes, { prefix: '/api/orders' });
  await app.ready();

  await prisma.user.deleteMany({ where: { email: 'lifecycle@test.com' } });
  const result = await authService.register('lifecycle@test.com', '123456', '生命周期测试');
  token = result.accessToken;
  userId = result.user.id;

  // 创建测试商品
  const product = await prisma.product.create({
    data: {
      flylink_product_id: `LIFECYCLE-${Date.now()}`,
      flylink_url: 'https://test.com/lifecycle',
      source_platform: 'taobao',
      source_url: 'https://item.taobao.com/lifecycle',
      name: '生命周期测试商品',
      source_price: 100,
      source_currency: 'CNY',
      weight_kg: 0.5,
      stock_status: '有货',
      verified_status: '已核验',
    },
  });
  productId = product.id;

  // 创建测试批次
  const now = new Date();
  const batch = await prisma.deliveryBatch.create({
    data: {
      batch_no: `LT${Date.now()}`,
      region: 'US',
      area: '测试区域',
      pickup_address: { city: 'Test', address: '123 Test St' },
      pickup_contact_name: '测试代收人',
      pickup_contact_phone: '+1-555-0000',
      current_orders: 0,
      current_value: 0,
      order_deadline: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      ship_date: new Date(now.getTime() + 8 * 24 * 3600 * 1000),
      estimated_arrival: new Date(now.getTime() + 20 * 24 * 3600 * 1000),
      status: '集货中',
    },
  });
  batchId = batch.id;
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { user_id: userId } });
  await prisma.notification.deleteMany({ where: { user_id: userId } });
  await prisma.transaction.deleteMany({ where: { user_id: userId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.deliveryBatch.deleteMany({ where: { id: batchId } });
  await prisma.user.deleteMany({ where: { email: 'lifecycle@test.com' } });

  const keys = await redis.keys('order:seq:*');
  if (keys.length) await redis.del(...keys);

  await app.close();
});

const authHeaders = () => ({ authorization: `Bearer ${token}` });

let orderSeq = 0;
async function createTestOrder(status = '待支付'): Promise<string> {
  orderSeq++;
  const order = await prisma.order.create({
    data: {
      order_no: `LT${Date.now()}${orderSeq.toString().padStart(4, '0')}`,
      user_id: userId,
      product_id: productId,
      product_price: 15.00,
      shipping_fee: 2.50,
      total_amount: 17.50,
      home_address: { formatted: '123 Test St' },
      delivery_batch_id: batchId,
      status,
    },
  });
  return order.id;
}

describe('订单状态机', () => {
  it('canTransition — 合法转换返回 true', () => {
    expect(orderService.canTransition('待支付', '已支付')).toBe(true);
    expect(orderService.canTransition('待支付', '已取消')).toBe(true);
    expect(orderService.canTransition('已支付', '集货中')).toBe(true);
    expect(orderService.canTransition('集货中', '运输中')).toBe(true);
    expect(orderService.canTransition('运输中', '待提货')).toBe(true);
    expect(orderService.canTransition('待提货', '已提货')).toBe(true);
  });

  it('canTransition — 非法转换返回 false', () => {
    expect(orderService.canTransition('待支付', '运输中')).toBe(false);
    expect(orderService.canTransition('已提货', '待支付')).toBe(false);
    expect(orderService.canTransition('已取消', '待支付')).toBe(false);
    expect(orderService.canTransition('集货中', '待支付')).toBe(false);
  });

  it('transitionStatus — 非法转换抛错', async () => {
    const oid = await createTestOrder();
    await expect(orderService.transitionStatus(oid, '运输中'))
      .rejects.toThrow('INVALID_TRANSITION');
    // 清理
    await orderService.transitionStatus(oid, '已取消');
  });
});

describe('Mock 支付', () => {
  it('POST /:id/pay — 待支付 → 集货中', async () => {
    const oid = await createTestOrder();

    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${oid}/pay`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('集货中');

    // 验证交易记录
    const txns = await prisma.transaction.findMany({
      where: { order_ids: { has: oid } },
    });
    expect(txns.length).toBe(1);
    expect(txns[0].status).toBe('已支付');

    orderId = oid;
  });

  it('POST /:id/pay — 非待支付订单返回错误', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/pay`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe('INVALID_TRANSITION');
  });
});

describe('取消订单', () => {
  it('POST /:id/cancel — 待支付订单可取消', async () => {
    const oid = await createTestOrder();

    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${oid}/cancel`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.status).toBe('已取消');
  });

  it('POST /:id/cancel — 非待支付订单不可取消', async () => {
    // orderId 已在支付测试中变为集货中
    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${orderId}/cancel`,
      headers: authHeaders(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(false);
  });
});

describe('确认提货', () => {
  it('待提货订单 → 输入正确取件码 → 已提货', async () => {
    const oid = await createTestOrder();

    // 手动推进到待提货
    await prisma.order.update({ where: { id: oid }, data: { status: '待提货', pickup_code: 'ABC123' } });

    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${oid}/confirm-pickup`,
      headers: authHeaders(),
      payload: { code: 'ABC123' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.status).toBe('已提货');
  });

  it('取件码错误 → 返回错误', async () => {
    const oid = await createTestOrder();
    await prisma.order.update({ where: { id: oid }, data: { status: '待提货', pickup_code: 'XYZ789' } });

    const res = await app.inject({
      method: 'POST',
      url: `/api/orders/${oid}/confirm-pickup`,
      headers: authHeaders(),
      payload: { code: 'WRONG' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(false);
    expect(res.json().error.code).toBe('INVALID_PICKUP_CODE');
  });
});

describe('批次推进', () => {
  it('advanceBatch — 集货中 → 已发运，订单变为运输中', async () => {
    // 创建订单并设为集货中
    const oid = await createTestOrder();
    await prisma.order.update({ where: { id: oid }, data: { status: '集货中' } });

    const result = await batchService.advanceBatch(batchId);
    expect(result.batchStatus).toBe('已发运');
    expect(result.ordersAffected).toBeGreaterThanOrEqual(1);

    const order = await prisma.order.findUnique({ where: { id: oid } });
    expect(order!.status).toBe('运输中');
  });

  it('advanceBatch — 已发运 → 已到达，订单变为待提货', async () => {
    const result = await batchService.advanceBatch(batchId);
    expect(result.batchStatus).toBe('已到达');

    // 查找批次内的订单
    const orders = await prisma.order.findMany({
      where: { delivery_batch_id: batchId, status: '待提货' },
    });
    expect(orders.length).toBeGreaterThanOrEqual(1);
    // 验证取件码已生成
    expect(orders[0].pickup_code).toBeTruthy();
  });

  it('advanceBatch — 已完成状态不可再推进', async () => {
    await prisma.deliveryBatch.update({ where: { id: batchId }, data: { status: '已完成' } });
    await expect(batchService.advanceBatch(batchId)).rejects.toThrow('INVALID_BATCH_TRANSITION');
  });
});

describe('通知', () => {
  it('状态变更产生通知记录', async () => {
    const oid = await createTestOrder();

    // 支付会触发 已支付 + 集货中 两次通知
    await orderService.mockPayment(oid, userId);

    const notifications = await prisma.notification.findMany({
      where: { user_id: userId, related_entity_id: oid, type: 'order_status' },
      orderBy: { created_at: 'desc' },
    });

    expect(notifications.length).toBeGreaterThanOrEqual(2);
    const statuses = notifications.map(n => n.title);
    expect(statuses).toContain('支付成功');
    expect(statuses).toContain('集货中');
  });
});
