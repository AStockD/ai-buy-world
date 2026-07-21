import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './lib/config.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { registerRoutes } from './api/routes.js';

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  },
});

async function start() {
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
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
