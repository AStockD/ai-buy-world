import { FastifyInstance, FastifyRequest } from 'fastify';
import { orderService } from '../services/order/order.service.js';
import { authMiddleware } from './middleware/auth.js';

export async function orderRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // 列表
  app.get('/', async (req: FastifyRequest<{ Querystring: { status?: string; page?: number } }>) => {
    const userId = (req as any).userId;
    const result = await orderService.listByUser(userId, req.query.status, req.query.page || 1);
    return { success: true, ...result };
  });

  // 详情
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const userId = (req as any).userId;
    try {
      const order = await orderService.getById(userId, req.params.id);
      return { success: true, data: order };
    } catch {
      return { success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } };
    }
  });
}
