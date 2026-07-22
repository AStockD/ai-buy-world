import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { notificationService } from '../services/notification/notification.service';
import { prisma } from '../lib/prisma';

let testUserId: string;
let testBatchId: string;
let testProductId: string;
let testOrderId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: 'notify-test@test.com',
      name: 'Notify Test',
      password_hash: 'test',
    },
  });
  testUserId = user.id;

  const product = await prisma.product.create({
    data: {
      name: '通知测试商品',
      flylink_product_id: `fl-notify-${Date.now()}`,
      flylink_url: 'https://example.com/notify-test',
      source_url: 'https://example.com/notify-test',
      source_platform: 'test',
      source_price: 100,
    },
  });
  testProductId = product.id;

  // 创建一个 12 小时后截止的批次
  const batch = await prisma.deliveryBatch.create({
    data: {
      batch_no: `BT${Date.now()}`,
      region: 'US',
      area: 'Los Angeles',
      pickup_address: { street: '123 Test St' },
      pickup_contact_name: 'Test Contact',
      pickup_contact_phone: '1234567890',
      order_deadline: new Date(Date.now() + 12 * 3600 * 1000),
      status: '集货中',
    },
  });
  testBatchId = batch.id;

  // 创建关联订单
  const order = await prisma.order.create({
    data: {
      order_no: `NT${Date.now()}`,
      user_id: testUserId,
      product_id: testProductId,
      product_price: 100,
      shipping_fee: 6.5,
      total_amount: 106.5,
      home_address: { street: '456 User St' },
      status: '待支付',
      delivery_batch_id: testBatchId,
    },
  });
  testOrderId = order.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user_id: testUserId } });
  await prisma.order.deleteMany({ where: { id: testOrderId } });
  await prisma.deliveryBatch.deleteMany({ where: { id: testBatchId } });
  await prisma.product.deleteMany({ where: { id: testProductId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
});

describe('NotificationService — 批次截止提醒', () => {
  it('notifyBatchDeadline 找到即将截止批次并通知用户', async () => {
    const result = await notificationService.notifyBatchDeadline();

    expect(result.batchesChecked).toBe(1);
    expect(result.notificationsSent).toBe(1);

    const notifications = await prisma.notification.findMany({
      where: { user_id: testUserId, type: 'batch_reminder' },
    });
    expect(notifications.length).toBe(1);
    expect(notifications[0].title).toBe('批次即将截止');
    expect(notifications[0].content).toContain('Los Angeles');
  });

  it('notifyBatchDeadline 不通知已过截止日期的批次', async () => {
    // 创建一个已过截止日期的批次
    const expiredBatch = await prisma.deliveryBatch.create({
      data: {
        batch_no: `EX${Date.now()}`,
        region: 'US',
        area: 'Expired Area',
        pickup_address: { street: '789 Old St' },
        pickup_contact_name: 'Old Contact',
        pickup_contact_phone: '0987654321',
        order_deadline: new Date(Date.now() - 1 * 3600 * 1000),
        status: '集货中',
      },
    });

    await prisma.notification.deleteMany({ where: { user_id: testUserId } });

    const result = await notificationService.notifyBatchDeadline();
    // 只应找到 12 小时后截止的那个批次
    expect(result.batchesChecked).toBe(1);

    await prisma.deliveryBatch.delete({ where: { id: expiredBatch.id } });
  });

  it('notifyBatchDeadline 不通知超过 24h 截止的批次', async () => {
    const futureBatch = await prisma.deliveryBatch.create({
      data: {
        batch_no: `FU${Date.now()}`,
        region: 'US',
        area: 'Future area',
        pickup_address: { street: '101 Future St' },
        pickup_contact_name: 'Future Contact',
        pickup_contact_phone: '1111111111',
        order_deadline: new Date(Date.now() + 48 * 3600 * 1000),
        status: '集货中',
      },
    });

    await prisma.notification.deleteMany({ where: { user_id: testUserId } });

    const result = await notificationService.notifyBatchDeadline();
    expect(result.batchesChecked).toBe(1); // 只匹配 12h 那个

    await prisma.deliveryBatch.delete({ where: { id: futureBatch.id } });
  });
});
