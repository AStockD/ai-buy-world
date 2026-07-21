import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { config } from './lib/config.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { registerRoutes } from './api/routes.js';
import { createRateLimitMiddleware } from './api/middleware/rateLimit.js';

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
  await app.register(cors, {
    origin: config.corsOrigin,
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
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  const address = await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Server running at ${address}`);
}

// 优雅关闭
const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down gracefully...`);
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
