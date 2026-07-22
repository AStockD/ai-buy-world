import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { productRefreshService } from '../services/product/product-refresh.service';
import { prisma } from '../lib/prisma';
import { queues, closeAllWorkers, closeAllQueues } from '../lib/queue';

let testProductId: string;
let testUserId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: 'refresh-test@test.com',
      name: 'Refresh Test',
      password_hash: 'test',
    },
  });
  testUserId = user.id;

  // 创建一个 updated_at 在 7 小时前的商品（过期）
  const product = await prisma.product.create({
    data: {
      name: '刷新测试商品',
      flylink_product_id: `fl-refresh-${Date.now()}`,
      flylink_url: 'https://item.taobao.com/refresh-test',
      source_url: 'https://item.taobao.com/refresh-test',
      source_platform: 'taobao',
      source_price: 100,
    },
  });
  testProductId = product.id;

  // 手动将 updated_at 设为 7 小时前
  await prisma.product.update({
    where: { id: testProductId },
    data: { updated_at: new Date(Date.now() - 7 * 3600 * 1000) },
  });
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: testProductId } });
  await prisma.user.deleteMany({ where: { id: testUserId } });
  await queues['product-refresh'].obliterate({ force: true });
  await closeAllWorkers();
  await closeAllQueues();
});

describe('ProductRefreshService', () => {
  it('refreshStaleProducts 找到过期商品并入队', async () => {
    const result = await productRefreshService.refreshStaleProducts();

    expect(result.enqueued).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);

    // 验证队列中有任务
    const waiting = await queues['product-refresh'].getWaiting();
    expect(waiting.length).toBeGreaterThanOrEqual(1);
  });

  it('refreshSingle 将单个商品入队', async () => {
    const result = await productRefreshService.refreshSingle(testProductId);
    expect(result.refreshed).toBe(true);
  });

  it('refreshSingle 不存在的商品抛出错误', async () => {
    await expect(
      productRefreshService.refreshSingle('nonexistent-id'),
    ).rejects.toThrow('PRODUCT_NOT_FOUND');
  });
});
