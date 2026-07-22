import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exchangeRateService } from '../services/exchange/exchange-rate.service';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

let testUserId: string;
let testProductId: string;
let testPricingId: string;
let testWishlistId: string;

beforeAll(async () => {
  // 创建测试用户
  const user = await prisma.user.create({
    data: {
      email: 'exrate-test@test.com',
      name: 'ExchangeRate Test',
      password_hash: 'test',
    },
  });
  testUserId = user.id;

  // 创建测试商品
  const product = await prisma.product.create({
    data: {
      name: '汇率测试商品',
      flylink_product_id: `fl-exrate-${Date.now()}`,
      flylink_url: 'https://example.com/exrate-test',
      source_url: 'https://example.com/exrate-test',
      source_platform: 'test',
      source_price: 715,
    },
  });
  testProductId = product.id;

  // 创建定价记录（旧汇率 7.00，与新汇率偏差 > 3%）
  const pricing = await prisma.productPricing.create({
    data: {
      product_id: testProductId,
      region: 'US',
      currency: 'USD',
      currency_symbol: '$',
      local_price: 102.14,
      shipping_rate_per_kg: 6.50,
      exchange_rate_snapshot: 7.00,
      exchange_rate_source: 'default',
      status: '生效',
    },
  });
  testPricingId = pricing.id;

  // 创建心愿单（用于测试通知）
  const wishlist = await prisma.wishlist.create({
    data: {
      user_id: testUserId,
      product_id: testProductId,
      status: '待购',
    },
  });
  testWishlistId = wishlist.id;

  // 清除缓存的汇率
  await redis.del('exchange:rate:current');
  await redis.del('exchange:rate:history');
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { user_id: testUserId } });
  await prisma.wishlist.deleteMany({ where: { id: testWishlistId } });
  await prisma.productPricing.deleteMany({ where: { id: testPricingId } });
  await prisma.product.deleteMany({ where: { id: testProductId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
  await redis.del('exchange:rate:current');
  await redis.del('exchange:rate:history');
});

describe('ExchangeRateService — 7 步算法', () => {
  it('fetchExchangeRate 返回 mock 汇率', async () => {
    const rate = await exchangeRateService.fetchExchangeRate();
    expect(rate).toBeGreaterThan(7.0);
    expect(rate).toBeLessThan(7.5);
  });

  it('fetch15DayHighRate 返回 15 日最高汇率', async () => {
    const high = await exchangeRateService.fetch15DayHighRate();
    expect(high).toBe(7.21);
  });

  it('updateExchangeRates 执行完整 7 步算法', async () => {
    const result = await exchangeRateService.updateExchangeRates();

    expect(result.effectiveRate).toBeGreaterThan(0);
    expect(result.source).toBeDefined();
    expect(result.currentRate).toBeGreaterThan(0);
    expect(result.highRate15Day).toBe(7.21);
    expect(result.deviation).toBeGreaterThanOrEqual(0);
    expect(result.pricingUpdated).toBeGreaterThanOrEqual(1);

    // Step 3: effectiveRate = max(currentRate, highRate15Day)
    expect(result.effectiveRate).toBeGreaterThanOrEqual(result.currentRate);

    // Step 5: 偏差 > 5% 时设地板价
    if (result.deviation > 0.05) {
      expect(result.source).toBe('当前+5%');
      expect(result.effectiveRate).toBeCloseTo(result.currentRate * 1.05, 4);
    } else {
      expect(result.source).toBe('15日最高');
      expect(result.effectiveRate).toBe(result.highRate15Day);
    }
  });

  it('Step 6: 更新 ProductPricing 汇率快照', async () => {
    await exchangeRateService.updateExchangeRates();

    const pricing = await prisma.productPricing.findUnique({ where: { id: testPricingId } });
    expect(pricing).not.toBeNull();
    expect(Number(pricing!.exchange_rate_snapshot)).toBeGreaterThan(7.0);
    expect(pricing!.exchange_rate_updated_at).not.toBeNull();
  });

  it('Step 7: 价格变动 > 3% 通知心愿单用户', async () => {
    // 重置定价为偏差大的值
    await prisma.productPricing.update({
      where: { id: testPricingId },
      data: { exchange_rate_snapshot: 6.50 },
    });

    await prisma.notification.deleteMany({ where: { user_id: testUserId } });

    const result = await exchangeRateService.updateExchangeRates();

    expect(result.notificationsSent).toBeGreaterThanOrEqual(1);

    const notifications = await prisma.notification.findMany({
      where: { user_id: testUserId, type: 'price_change' },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].title).toContain('上涨');
  });

  it('缓存更新：getCurrentRate 返回更新后的汇率', async () => {
    const result = await exchangeRateService.updateExchangeRates();
    const cached = await exchangeRateService.getCurrentRate();

    expect(cached.rate).toBe(result.effectiveRate);
    expect(cached.source).toBe(result.source);
  });

  it('历史记录：Redis 存储汇率历史', async () => {
    await redis.del('exchange:rate:history');
    await exchangeRateService.updateExchangeRates();

    const history = await redis.lrange('exchange:rate:history', 0, -1);
    expect(history.length).toBe(1);
    expect(Number(history[0])).toBeGreaterThan(7.0);
  });
});
