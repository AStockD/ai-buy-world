import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from './config.js';

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const workerConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const RETRY_CONFIG = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 },
};

export const queues = {
  notification: new Queue('notification', { connection }),
  'product-refresh': new Queue('product-refresh', { connection }),
  'flylink-parse': new Queue('flylink-parse', { connection }),
  'order-sync': new Queue('order-sync', { connection }),
  'exchange-rate': new Queue('exchange-rate', { connection }),
};

export async function addJob<T = any>(
  queueName: keyof typeof queues,
  name: string,
  data: T,
  opts?: { priority?: number; delay?: number },
): Promise<Job<T>> {
  const queue = queues[queueName];
  if (!queue) throw new Error(`Queue "${queueName}" not found`);
  return queue.add(name, data, { ...RETRY_CONFIG, ...opts }) as Promise<Job<T>>;
}

export interface WorkerDefinition {
  queueName: string;
  processor: (job: Job) => Promise<any>;
}

const workers: Worker[] = [];

export function createWorker(def: WorkerDefinition): Worker {
  const worker = new Worker(def.queueName, def.processor, {
    connection: workerConnection.duplicate(),
    ...RETRY_CONFIG,
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${def.queueName}] Job ${job?.id} failed:`, err.message);
    if (job && job.attemptsMade >= (RETRY_CONFIG.attempts)) {
      console.error(`[Worker:${def.queueName}] Job ${job.id} moved to dead letter (max retries reached)`);
    }
  });

  worker.on('completed', (job) => {
    console.log(`[Worker:${def.queueName}] Job ${job.id} completed`);
  });

  workers.push(worker);
  return worker;
}

export async function closeAllWorkers(): Promise<void> {
  await Promise.all(workers.map(w => w.close()));
  workers.length = 0;
  await workerConnection.quit();
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map(q => q.close()));
  await connection.quit();
}
