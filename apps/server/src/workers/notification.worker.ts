import { Job } from 'bullmq';
import { createWorker, queues } from '../lib/queue.js';
import { notificationService } from '../services/notification/notification.service.js';

export function startNotificationWorker() {
  return createWorker({
    queueName: 'notification',
    processor: async (job: Job) => {
      // 定时批次截止提醒
      if (job.name === 'batch-deadline-check') {
        const result = await notificationService.notifyBatchDeadline();
        console.log(`[Notification] 批次提醒完成: batches=${result.batchesChecked}, sent=${result.notificationsSent}`);
        return result;
      }

      const { type, data } = job.data;

      switch (type) {
        case 'order-status':
          await notificationService.notifyOrderStatusChange(
            data.userId, data.orderId, data.newStatus,
          );
          break;

        case 'price-change':
          await notificationService.notifyPriceChange(
            data.userId, data.productId, data.changePercent, data.direction,
          );
          break;

        case 'batch-deadline':
          await notificationService.create({
            userId: data.userId,
            type: 'batch_reminder',
            title: '批次即将截止',
            content: `您加入的批次即将截止下单，请尽快确认。`,
            relatedEntityType: 'batch',
            relatedEntityId: data.batchId,
          });
          break;

        case 'custom':
          await notificationService.create({
            userId: data.userId,
            type: data.notificationType || 'system',
            title: data.title,
            content: data.content,
            relatedEntityType: data.relatedEntityType,
            relatedEntityId: data.relatedEntityId,
          });
          break;

        default:
          console.warn(`Unknown notification type: ${type}`);
      }
    },
  });
}

// 注册批次截止提醒定时任务（每天 UTC 18:00，周日到周五）
export async function scheduleBatchDeadlineJob() {
  await queues.notification.add(
    'batch-deadline-check',
    {},
    {
      repeat: {
        pattern: '0 18 * * 0-5',
      },
    },
  );
  console.log('[Notification] 批次提醒定时任务已注册: 每天 UTC 18:00');
}
