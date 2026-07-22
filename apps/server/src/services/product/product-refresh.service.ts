import { prisma } from '../../lib/prisma.js';
import { addJob } from '../../lib/queue.js';

const STALE_THRESHOLD_HOURS = 6;
const BATCH_SIZE = 500;

export class ProductRefreshService {
  // 查找过期商品并批量入队刷新
  async refreshStaleProducts(): Promise<{ enqueued: number; total: number }> {
    const threshold = new Date(Date.now() - STALE_THRESHOLD_HOURS * 3600 * 1000);

    const staleProducts = await prisma.product.findMany({
      where: {
        updated_at: { lt: threshold },
      },
      select: { id: true, source_url: true },
      take: BATCH_SIZE,
    });

    let enqueued = 0;
    for (const product of staleProducts) {
      await addJob('product-refresh', 'refresh', {
        productId: product.id,
        sourceUrl: product.source_url,
      });
      enqueued++;
    }

    return { enqueued, total: staleProducts.length };
  }

  // 刷新单个商品
  async refreshSingle(productId: string): Promise<{ refreshed: boolean }> {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    await addJob('product-refresh', 'refresh', {
      productId: product.id,
      sourceUrl: product.source_url,
    });

    return { refreshed: true };
  }
}

export const productRefreshService = new ProductRefreshService();
