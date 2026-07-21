import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth/auth.service.js';
import { registerSchema, loginSchema, refreshSchema } from '../services/auth/auth.schema.js';
import { prisma } from '../lib/prisma.js';

export async function authRoutes(app: FastifyInstance) {
  // 注册
  app.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = registerSchema.parse(req.body);

    try {
      const result = await authService.register(body.email, body.password, body.name);
      return reply.code(201).send({ success: true, data: result });
    } catch (err: any) {
      if (err.message === 'EMAIL_EXISTS') {
        return reply.code(409).send({ success: false, error: { code: 'EMAIL_EXISTS', message: '该邮箱已注册' } });
      }
      throw err;
    }
  });

  // 登录
  app.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(req.body);

    try {
      const result = await authService.login(body.email, body.password);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      if (err.message === 'INVALID_CREDENTIALS') {
        return reply.code(401).send({ success: false, error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' } });
      }
      throw err;
    }
  });

  // 刷新 Token
  app.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = refreshSchema.parse(req.body);

    try {
      const result = await authService.refresh(body.refreshToken);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.code(401).send({
        success: false,
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token 无效或已过期' },
      });
    }
  });

  // 获取当前用户（需认证）
  app.get('/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });
    }

    try {
      const token = authHeader.slice(7);
      const payload = authService.verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, email: true, avatar_url: true, region: true, created_at: true },
      });

      if (!user) {
        return reply.code(401).send({ success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } });
      }

      return reply.send({ success: true, data: user });
    } catch {
      return reply.code(401).send({ success: false, error: { code: 'TOKEN_INVALID', message: 'Token 无效或已过期' } });
    }
  });
}
