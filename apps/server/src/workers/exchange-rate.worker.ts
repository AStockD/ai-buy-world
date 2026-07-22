import { Job } from 'bullmq';
import { createWorker, queues } from '../lib/queue.js';
import { exchangeRateService } from '../services/exchange/exchange-rate.service.js';

export function startExchangeRateWorker() {
  const worker = createWorker({
    queueName: 'exchange-rate',
    processor: async (job: Job) => {
      const result = await exchangeRateService.updateExchangeRates();
      console.log(`[ExchangeRate] 更新完成: rate=${result.effectiveRate}, source=${result.source}, pricing=${result.pricingUpdated}, notifications=${result.notificationsSent}`);
      return result;
    },
  });

  return worker;
}

// 注册每日定时任务（UTC 00:00 = 北京 08:00）
export async function scheduleExchangeRateJob() {
  await queues['exchange-rate'].add(
    'daily-update',
    {},
    {
      repeat: {
        pattern: '0 0 * * *',
      },
    },
  );
  console.log('[ExchangeRate] 定时任务已注册: 每天 UTC 00:00');
}
