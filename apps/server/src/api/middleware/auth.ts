import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../../services/auth/auth.service.js';

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '请先登录' },
    });
  }

  try {
    const token = authHeader.slice(7);
    const payload = authService.verifyAccessToken(token);
    (req as any).userId = payload.userId;
    (req as any).userEmail = payload.email;
  } catch {
    return reply.code(401).send({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Token 无效或已过期' },
    });
  }
}
