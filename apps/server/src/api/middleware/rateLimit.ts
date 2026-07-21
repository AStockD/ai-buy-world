import { FastifyRequest, FastifyReply } from 'fastify';
import { rateLimit } from '../../lib/cache.js';

/**
 * 通用限流中间件
 * 默认: 60 次/分钟 (按 IP)
 */
export function createRateLimitMiddleware(maxRequests = 60, windowSeconds = 60) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).userId || req.ip;
    const key = `rate:limit:${userId}`;

    const result = await rateLimit(key, maxRequests, windowSeconds);

    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', result.resetAt);

    if (!result.allowed) {
      return reply.code(429).send({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试' },
      });
    }
  };
}
