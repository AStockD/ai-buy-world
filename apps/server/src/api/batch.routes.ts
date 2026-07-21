import { FastifyInstance, FastifyRequest } from 'fastify';
import { authMiddleware } from './middleware/auth.js';
import { batchRecommendService } from '../services/batch/batch-recommend.service.js';

export async function batchRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // 获取推荐批次列表
  app.get('/recommend', async (req: FastifyRequest<{ Querystring: { limit?: string } }>) => {
    const userId = (req as any).userId;
    const limit = parseInt(req.query.limit || '3', 10);

    const recommendations = await batchRecommendService.recommendForUser(userId, limit);
    return { success: true, data: recommendations };
  });
}
