import { Job } from 'bullmq';
import { createWorker, queues } from '../lib/queue.js';
import { flylinkClient } from '../services/flylink/flylink.client.js';
import { productRefreshService } from '../services/product/product-refresh.service.js';
import { prisma } from '../lib/prisma.js';

export function startProductRefreshWorker() {
  return createWorker({
    queueName: 'product-refresh',
    processor: async (job: Job) => {
      // 定时批量刷新任务
      if (job.name === 'stale-refresh') {
        const result = await productRefreshService.refreshStaleProducts();
        console.log(`[ProductRefresh] 批量刷新完成: enqueued=${result.enqueued}`);
        return result;
      }

      // 单商品刷新任务
      const { productId, sourceUrl } = job.data;
      const data = await flylinkClient.parseProduct(sourceUrl);

      await prisma.product.update({
        where: { id: productId },
        data: {
          name: data.title,
          source_price: data.source_price,
          image_url: data.image_url,
          weight_kg: data.weight_kg,
          sku_variants: data.sku_variants as any,
          raw_data: data.raw_data,
          updated_at: new Date(),
        },
      });

      return { productId, refreshed: true };
    },
  });
}

// 注册每 6 小时定时任务
export async function scheduleProductRefreshJob() {
  await queues['product-refresh'].add(
    'stale-refresh',
    {},
    {
      repeat: {
        pattern: '0 */6 * * *',
      },
    },
  );
  console.log('[ProductRefresh] 定时任务已注册: 每 6 小时');
}
