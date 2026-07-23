import { FastifyInstance, FastifyRequest } from 'fastify';
import { authMiddleware } from './middleware/auth.js';
import { batchRecommendService } from '../services/batch/batch-recommend.service.js';
import { batchService } from '../services/batch/batch.service.js';

export async function batchRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // 获取推荐批次列表
  app.get('/recommend', async (req: FastifyRequest<{ Querystring: { limit?: string } }>) => {
    const userId = (req as any).userId;
    const limit = parseInt(req.query.limit || '3', 10);

    const recommendations = await batchRecommendService.recommendForUser(userId, limit);
    return { success: true, data: recommendations };
  });

  // 手动推进批次（管理员/系统调用）
  app.post('/:id/advance', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    try {
      const result = await batchService.advanceBatch(req.params.id);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: { code: 'ERROR', message: err.message } };
    }
  });

  // 处理到期批次（系统调用）
  app.post('/process-mature', async () => {
    const result = await batchService.processMatureBatches();
    return { success: true, data: result };
  });
}
