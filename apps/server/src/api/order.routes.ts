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

  // Mock 支付
  app.post('/:id/pay', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const userId = (req as any).userId;
    try {
      const order = await orderService.mockPayment(req.params.id, userId);
      return { success: true, data: order };
    } catch (err: any) {
      const code = err.message.startsWith('INVALID_TRANSITION') ? 'INVALID_TRANSITION' : 'ERROR';
      return { success: false, error: { code, message: err.message } };
    }
  });

  // 取消订单
  app.post('/:id/cancel', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const userId = (req as any).userId;
    try {
      const order = await orderService.cancelOrder(req.params.id, userId);
      return { success: true, data: order };
    } catch (err: any) {
      const code = err.message.startsWith('INVALID_TRANSITION') ? 'INVALID_TRANSITION' : 'ERROR';
      return { success: false, error: { code, message: err.message } };
    }
  });

  // 确认提货
  app.post('/:id/confirm-pickup', async (req: FastifyRequest<{ Params: { id: string }; Body: { code: string } }>) => {
    const userId = (req as any).userId;
    const { code } = req.body || {} as any;
    if (!code) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: '请提供取件码' } };
    }
    try {
      const order = await orderService.confirmPickup(req.params.id, userId, code);
      return { success: true, data: order };
    } catch (err: any) {
      const code = err.message.startsWith('INVALID_TRANSITION') ? 'INVALID_TRANSITION'
        : err.message.startsWith('INVALID_PICKUP_CODE') ? 'INVALID_PICKUP_CODE'
        : 'ERROR';
      return { success: false, error: { code, message: err.message } };
    }
  });
}
