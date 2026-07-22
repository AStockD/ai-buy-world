import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistry, createServiceAdapter, IService } from '../services/registry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('register 和 get 正常工作', () => {
    const svc = createServiceAdapter('test-svc');
    registry.register(svc);
    expect(registry.get('test-svc')).toBe(svc);
  });

  it('get 未注册服务抛出错误', () => {
    expect(() => registry.get('nonexistent')).toThrow('Service "nonexistent" not registered');
  });

  it('has 检查服务是否存在', () => {
    registry.register(createServiceAdapter('a'));
    expect(registry.has('a')).toBe(true);
    expect(registry.has('b')).toBe(false);
  });

  it('list 返回所有注册的服务名', () => {
    registry.register(createServiceAdapter('alpha'));
    registry.register(createServiceAdapter('beta'));
    registry.register(createServiceAdapter('gamma'));
    expect(registry.list()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('initAll 按注册顺序调用 init', async () => {
    const order: string[] = [];
    registry.register(createServiceAdapter('first', async () => { order.push('first'); }));
    registry.register(createServiceAdapter('second', async () => { order.push('second'); }));
    registry.register(createServiceAdapter('third', async () => { order.push('third'); }));

    await registry.initAll();
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('destroyAll 按逆序调用 destroy', async () => {
    const order: string[] = [];
    registry.register(createServiceAdapter('a', undefined, async () => { order.push('a'); }));
    registry.register(createServiceAdapter('b', undefined, async () => { order.push('b'); }));
    registry.register(createServiceAdapter('c', undefined, async () => { order.push('c'); }));

    await registry.initAll();
    await registry.destroyAll();
    expect(order).toEqual(['c', 'b', 'a']);
  });

  it('initAll 后不允许再注册', async () => {
    registry.register(createServiceAdapter('locked'));
    await registry.initAll();
    expect(() => registry.register(createServiceAdapter('too-late'))).toThrow('after initAll');
  });

  it('destroyAll 后可以重新注册', async () => {
    registry.register(createServiceAdapter('temp'));
    await registry.initAll();
    await registry.destroyAll();
    registry.register(createServiceAdapter('new-svc'));
    expect(registry.has('new-svc')).toBe(true);
  });

  it('自定义 IService 实现正常工作', async () => {
    let initialized = false;
    let destroyed = false;

    const custom: IService = {
      name: 'custom',
      async init() { initialized = true; },
      async destroy() { destroyed = true; },
    };

    registry.register(custom);
    await registry.initAll();
    expect(initialized).toBe(true);

    await registry.destroyAll();
    expect(destroyed).toBe(true);
  });
});
