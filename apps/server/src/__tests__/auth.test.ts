import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { authRoutes } from '../api/auth.routes';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.errors.map(e => e.message).join('; ') },
      });
    }
    return reply.code(err.statusCode || 500).send({ success: false, error: { code: 'ERROR', message: err.message } });
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.ready();

  // 清理测试数据
  await prisma.user.deleteMany({ where: { email: 'authtest@example.com' } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: 'authtest@example.com' } });
  await app.close();
});

describe('Auth API', () => {
  it('POST /register — 注册成功', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'authtest@example.com', password: '123456', name: '测试' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    expect(body.data.user.email).toBe('authtest@example.com');
  });

  it('POST /register — 重复邮箱返回 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'authtest@example.com', password: '123456', name: '测试' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('EMAIL_EXISTS');
  });

  it('POST /login — 登录成功', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'authtest@example.com', password: '123456' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.accessToken).toBeTruthy();
  });

  it('POST /login — 错误密码返回 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'authtest@example.com', password: 'wrong' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /me — 带有效 token 返回用户信息', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'authtest@example.com', password: '123456' },
    });
    const token = loginRes.json().data.accessToken;

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.email).toBe('authtest@example.com');
  });

  it('GET /me — 无 token 返回 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('POST /register — 无效邮箱返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', password: '123456', name: '测试' },
    });

    expect(res.statusCode).toBe(400);
  });
});
