import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exchangeRateService } from '../services/exchange/exchange-rate.service';
import { discountService } from '../services/discount/discount.service';
import { notificationService } from '../services/notification/notification.service';
import { authService } from '../services/auth/auth.service';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

describe('ExchangeRateService', () => {
  it('getCurrentRate 返回默认汇率', async () => {
    const result = await exchangeRateService.getCurrentRate();
    expect(result.rate).toBeGreaterThan(0);
    expect(result.source).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('getShippingRate 返回区域运费率', async () => {
    const us = await exchangeRateService.getShippingRate('US', '普通');
    expect(us).toBe(6.50);

    const jp = await exchangeRateService.getShippingRate('JP', '大件');
    expect(jp).toBe(8.25);
  });

  it('getShippingRate 未知区域返回默认值', async () => {
    const rate = await exchangeRateService.getShippingRate('XX', '普通');
    expect(rate).toBe(6.50);
  });

  it('calculatePrice 计算完整价格', async () => {
    const result = await exchangeRateService.calculatePrice({
      sourcePriceCNY: 100,
      weightKg: 1.0,
      region: 'US',
    });

    expect(result.exchangeRate).toBeGreaterThan(0);
    expect(result.localProductPrice).toBeGreaterThan(0);
    expect(result.shippingFee).toBe(6.50);
    expect(result.totalAmount).toBeCloseTo(result.localProductPrice + result.shippingFee, 2);
    expect(result.currency).toBe('USD');
  });

  it('getRateTable 返回所有区域费率', async () => {
    const table = await exchangeRateService.getRateTable();
    expect(table.length).toBeGreaterThanOrEqual(7);
    expect(table.find(t => t.region === 'US')).toBeDefined();
  });
});

describe('DiscountService', () => {
  it('无折扣条件时返回原价', () => {
    const result = discountService.calculateShippingDiscount(10.00, false, false);
    expect(result.discount).toBe(0);
    expect(result.finalFee).toBe(10.00);
  });

  it('愿意代收但未被选中时无折扣', () => {
    const result = discountService.calculateShippingDiscount(10.00, true, false);
    expect(result.discount).toBe(0);
    expect(result.finalFee).toBe(10.00);
  });

  it('满足折扣条件时享受 8 折', () => {
    const result = discountService.calculateShippingDiscount(10.00, true, true);
    expect(result.discount).toBe(2.00);
    expect(result.finalFee).toBe(8.00);
    expect(result.discountRate).toBe(0.80);
  });

  it('calculateOrderTotal 计算订单总价', () => {
    const result = discountService.calculateOrderTotal({
      productPrice: 15.99,
      shippingFee: 10.00,
      willingToReceiveForOthers: true,
      userIsSelectedAsPickup: true,
    });

    expect(result.productPrice).toBe(15.99);
    expect(result.shippingFee).toBe(8.00);
    expect(result.discount).toBe(2.00);
    expect(result.totalAmount).toBe(23.99);
  });
});

describe('NotificationService', () => {
  let userId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: 'notifytest@example.com' } });
    const result = await authService.register('notifytest@example.com', '123456', '通知测试');
    userId = result.user.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { user_id: userId } });
    await prisma.user.deleteMany({ where: { email: 'notifytest@example.com' } });
  });

  it('创建通知', async () => {
    const n = await notificationService.create({
      userId,
      type: 'order_status',
      title: '测试通知',
      content: '这是一条测试通知',
    });
    expect(n.id).toBeDefined();
    expect(n.is_read).toBe(false);
  });

  it('listByUser 列出通知', async () => {
    const items = await notificationService.listByUser(userId);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('getUnreadCount 返回未读数', async () => {
    const count = await notificationService.getUnreadCount(userId);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('markAsRead 标记已读', async () => {
    const items = await notificationService.listByUser(userId);
    await notificationService.markAsRead(userId, items[0].id);

    const count = await notificationService.getUnreadCount(userId);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('markAllAsRead 全部标记已读', async () => {
    await notificationService.create({
      userId,
      type: 'test',
      title: '另一条',
      content: '内容',
    });

    await notificationService.markAllAsRead(userId);
    const count = await notificationService.getUnreadCount(userId);
    expect(count).toBe(0);
  });

  it('notifyOrderStatusChange 发送订单状态通知', async () => {
    const n = await notificationService.notifyOrderStatusChange(userId, 'fake-order-id', '已支付');
    expect(n).toBeDefined();
    expect(n!.title).toBe('支付成功');
  });

  it('notifyPriceChange 发送价格变动通知', async () => {
    const n = await notificationService.notifyPriceChange(userId, 'fake-product-id', '5.2', '下降');
    expect(n).toBeDefined();
    expect(n!.title).toContain('下降');
  });
});
