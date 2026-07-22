import { describe, it, expect, afterAll } from 'vitest';
import { queues, addJob, createWorker, closeAllWorkers, closeAllQueues } from '../lib/queue';
import { redis } from '../lib/redis';

describe('BullMQ Queue Infrastructure', () => {
  afterAll(async () => {
    await closeAllWorkers();
    await closeAllQueues();
  });

  it('queues 对象包含 5 个队列', () => {
    expect(Object.keys(queues)).toEqual([
      'notification', 'product-refresh', 'flylink-parse', 'order-sync', 'exchange-rate',
    ]);
  });

  it('每个队列实例存在', () => {
    for (const [name, q] of Object.entries(queues)) {
      expect(q).toBeDefined();
      expect(q.name).toBe(name);
    }
  });

  it('addJob 将任务加入队列', async () => {
    const job = await addJob('notification', 'test', { userId: 'u1', title: '测试' });
    expect(job.id).toBeDefined();
    expect(job.data.title).toBe('测试');

    await queues.notification.obliterate({ force: true });
  });

  it('addJob 不存在的队列抛出错误', async () => {
    await expect(addJob('nonexistent' as any, 'test', {})).rejects.toThrow('not found');
  });

  it('createWorker 创建 worker 并处理任务', async () => {
    let processed = false;
    const worker = createWorker({
      queueName: 'flylink-parse',
      processor: async (job) => {
        processed = true;
        return { done: true };
      },
    });

    await addJob('flylink-parse', 'parse', { url: 'https://test.com' });

    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(processed).toBe(true);

    await worker.close();
    await queues['flylink-parse'].obliterate({ force: true });
  });

  it('Redis 中队列 key 存在', async () => {
    await addJob('order-sync', 'sync', { orderId: 'o1' });
    const keys = await redis.keys('bull:order-sync:*');
    expect(keys.length).toBeGreaterThan(0);

    await queues['order-sync'].obliterate({ force: true });
  });
});
