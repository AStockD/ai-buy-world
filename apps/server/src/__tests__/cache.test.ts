import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, ConversationCache, SessionCache } from '../lib/cache';
import { redis } from '../lib/redis';

describe('rateLimit', () => {
  beforeEach(async () => {
    const keys = await redis.keys('test:rate*');
    if (keys.length > 0) await redis.del(...keys);
  });

  it('允许请求在限制内', async () => {
    const result = await rateLimit('test:rate', 5, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('超过限制后拒绝请求', async () => {
    for (let i = 0; i < 6; i++) {
      await rateLimit('test:rate:full', 5, 60);
    }
    const result = await rateLimit('test:rate:full', 5, 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('ConversationCache', () => {
  beforeEach(async () => {
    const keys = await redis.keys('conv:ctx:*');
    if (keys.length > 0) await redis.del(...keys);
  });

  it('push 和 get 消息', async () => {
    await ConversationCache.push('conv1', { role: 'user', content: '你好' });
    await ConversationCache.push('conv1', { role: 'assistant', content: '你好呀' });

    const messages = await ConversationCache.get('conv1');
    expect(messages).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好呀' },
    ]);
  });

  it('超过 maxRounds 自动裁剪', async () => {
    for (let i = 0; i < 10; i++) {
      await ConversationCache.push('conv2', { role: 'user', content: `msg${i}` }, 3);
    }

    const messages = await ConversationCache.get('conv2');
    expect(messages.length).toBeLessThanOrEqual(6); // 3 rounds * 2 (user+assistant)
  });

  it('clear 清除缓存', async () => {
    await ConversationCache.push('conv3', { role: 'user', content: 'test' });
    await ConversationCache.clear('conv3');

    const messages = await ConversationCache.get('conv3');
    expect(messages).toEqual([]);
  });
});

describe('SessionCache', () => {
  beforeEach(async () => {
    const keys = await redis.keys('conv:state:*');
    if (keys.length > 0) await redis.del(...keys);
  });

  it('set 和 get 状态', async () => {
    await SessionCache.set('conv1', { stage: 'SKU_SELECTED', productId: 'p123' });
    const state = await SessionCache.get('conv1');

    expect(state.stage).toBe('SKU_SELECTED');
    expect(state.productId).toBe('p123');
  });

  it('clear 清除状态', async () => {
    await SessionCache.set('conv2', { stage: 'IDLE' });
    await SessionCache.clear('conv2');

    const state = await SessionCache.get('conv2');
    expect(state).toBeNull();
  });
});
