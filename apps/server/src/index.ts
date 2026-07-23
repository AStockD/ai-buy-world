import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { config } from './lib/config.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { registerRoutes } from './api/routes.js';
import { createRateLimitMiddleware } from './api/middleware/rateLimit.js';
import { serviceRegistry, createServiceAdapter } from './services/registry.js';
import { closeAllWorkers, closeAllQueues } from './lib/queue.js';
import { startNotificationWorker, scheduleBatchDeadlineJob } from './workers/notification.worker.js';
import { startProductRefreshWorker, scheduleProductRefreshJob } from './workers/product-refresh.worker.js';
import { startExchangeRateWorker, scheduleExchangeRateJob } from './workers/exchange-rate.worker.js';
import { exchangeRateService } from './services/exchange/exchange-rate.service.js';
import { notificationService } from './services/notification/notification.service.js';
import { productService } from './services/product/product.service.js';
import { orderService } from './services/order/order.service.js';
import { discountService } from './services/discount/discount.service.js';
import { batchRecommendService } from './services/batch/batch-recommend.service.js';
import { batchService } from './services/batch/batch.service.js';
import { conversationService } from './services/conversation/conversation.service.js';
import { addressService } from './services/address/address.service.js';
import { authService } from './services/auth/auth.service.js';
import { wishlistService } from './services/wishlist/wishlist.service.js';

serviceRegistry.register(createServiceAdapter('exchange-rate', async () => {
  await exchangeRateService.getCurrentRate();
}));
serviceRegistry.register(createServiceAdapter('notification'));
serviceRegistry.register(createServiceAdapter('product'));
serviceRegistry.register(createServiceAdapter('order'));
serviceRegistry.register(createServiceAdapter('discount'));
serviceRegistry.register(createServiceAdapter('batch-recommend'));
serviceRegistry.register(createServiceAdapter('conversation'));
serviceRegistry.register(createServiceAdapter('address'));
serviceRegistry.register(createServiceAdapter('auth'));
serviceRegistry.register(createServiceAdapter('wishlist'));

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  },
});

// 全局错误处理
app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError) {
    return reply.code(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      },
    });
  }
  app.log.error(err);
  return reply.code(err.statusCode || 500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
  });
});

async function start() {
  await serviceRegistry.initAll();
  app.log.info(`Services initialized: ${serviceRegistry.list().join(', ')}`);

  startNotificationWorker();
  startProductRefreshWorker();
  startExchangeRateWorker();
  await scheduleBatchDeadlineJob();
  await scheduleProductRefreshJob();
  await scheduleExchangeRateJob();
  app.log.info('Workers started: notification, product-refresh, exchange-rate');

  // 批次物流推进：每 30 分钟检查到期批次
  const BATCH_INTERVAL = 30 * 60 * 1000;
  setInterval(async () => {
    try {
      const result = await batchService.processMatureBatches();
      if (result.shipped > 0 || result.arrived > 0) {
        app.log.info(`批次推进: ${result.shipped} 发运, ${result.arrived} 到达`);
      }
    } catch (err: any) {
      app.log.error(`批次推进失败: ${err.message}`);
    }
  }, BATCH_INTERVAL);
  app.log.info('Batch logistics scheduler started (every 30min)');

  const allowedOrigins = config.corsOrigin.split(',').map(s => s.trim());
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
  });

  // 全局限流（排除健康检查）
  const rateLimiter = createRateLimitMiddleware(120, 60);
  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/api/health') return;
    await rateLimiter(req, reply);
  });

  await registerRoutes(app);

  // 健康检查
  app.get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return {
      status: 'ok',
      services: serviceRegistry.list(),
      timestamp: new Date().toISOString(),
    };
  });

  const address = await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Server running at ${address}`);
}

// 优雅关闭
const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down gracefully...`);
  await serviceRegistry.destroyAll();
  await closeAllWorkers();
  await closeAllQueues();
  await app.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
