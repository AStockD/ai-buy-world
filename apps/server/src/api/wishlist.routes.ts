import { FastifyInstance, FastifyRequest } from 'fastify';
import { wishlistService } from '../services/wishlist/wishlist.service.js';
import { authMiddleware } from './middleware/auth.js';

export async function wishlistRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // 列表
  app.get('/', async (req: FastifyRequest<{ Querystring: { status?: string } }>) => {
    const userId = (req as any).userId;
    const items = await wishlistService.list(userId, req.query.status);
    return { success: true, data: items };
  });

  // 添加
  app.post('/', async (req: FastifyRequest<{ Body: { product_id: string; region?: string } }>) => {
    const userId = (req as any).userId;
    const item = await wishlistService.add(userId, req.body.product_id, req.body.region);
    return { success: true, data: item };
  });

  // 移除（软删除）
  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const userId = (req as any).userId;
    const item = await wishlistService.remove(userId, req.params.id);
    return { success: true, data: item };
  });
}
