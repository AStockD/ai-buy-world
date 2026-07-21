import { FastifyInstance, FastifyRequest } from 'fastify';
import { authMiddleware } from './middleware/auth.js';
import { notificationService } from '../services/notification/notification.service.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/', async (req: FastifyRequest<{ Querystring: { unread_only?: string; limit?: number } }>) => {
    const userId = (req as any).userId;
    const unreadOnly = req.query.unread_only === 'true';
    const limit = req.query.limit || 20;
    const items = await notificationService.listByUser(userId, unreadOnly, limit);
    const unreadCount = await notificationService.getUnreadCount(userId);
    return { success: true, data: items, unreadCount };
  });

  app.patch('/:id/read', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const userId = (req as any).userId;
    await notificationService.markAsRead(userId, req.params.id);
    return { success: true };
  });

  app.patch('/read-all', async (req) => {
    const userId = (req as any).userId;
    await notificationService.markAllAsRead(userId);
    return { success: true };
  });
}
