import { redis } from '../lib/redis.js';

/**
 * 滑动窗口限流器
 * @param key Redis key（如 rate:limit:{userId}）
 * @param maxRequests 窗口内最大请求数
 * @param windowSeconds 窗口时长（秒）
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export async function rateLimit(
  key: string,
  maxRequests: number = 60,
  windowSeconds: number = 60,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, member);
  pipeline.zcard(key);
  pipeline.expire(key, windowSeconds);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) || 0;

  const resetAt = Math.ceil((windowStart + windowSeconds * 1000) / 1000);

  if (count > maxRequests) {
    await redis.zrem(key, member);
    return { allowed: false, remaining: 0, resetAt };
  }

  return { allowed: true, remaining: maxRequests - count, resetAt };
}

/**
 * 对话上下文缓存（最近 N 轮）
 */
export const ConversationCache = {
  key(conversationId: string) {
    return `conv:ctx:${conversationId}`;
  },

  async get(conversationId: string): Promise<string[]> {
    const data = await redis.lrange(this.key(conversationId), 0, -1);
    return data.map(d => JSON.parse(d));
  },

  async push(conversationId: string, message: string, maxRounds: number = 50): Promise<void> {
    const key = this.key(conversationId);
    await redis.rpush(key, JSON.stringify(message));
    const len = await redis.llen(key);
    if (len > maxRounds * 2) {
      await redis.ltrim(key, len - maxRounds * 2, -1);
    }
    await redis.expire(key, 1800); // 30min TTL
  },

  async clear(conversationId: string): Promise<void> {
    await redis.del(this.key(conversationId));
  },
};

/**
 * 会话状态机缓存
 */
export const SessionCache = {
  key(conversationId: string) {
    return `conv:state:${conversationId}`;
  },

  async get(conversationId: string): Promise<Record<string, string>> {
    return redis.hgetall(this.key(conversationId));
  },

  async set(conversationId: string, state: Record<string, string>): Promise<void> {
    const key = this.key(conversationId);
    if (Object.keys(state).length > 0) {
      await redis.hmset(key, state);
    }
    await redis.expire(key, 1800);
  },

  async clear(conversationId: string): Promise<void> {
    await redis.del(this.key(conversationId));
  },
};
