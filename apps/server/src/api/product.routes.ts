import { FastifyInstance, FastifyRequest } from 'fastify';
import { productService } from '../services/product/product.service.js';
import { authMiddleware } from './middleware/auth.js';

export async function productRoutes(app: FastifyInstance) {
  // 商品列表（公开）
  app.get('/', async () => {
    const products = await productService.listRecent();
    return { success: true, data: products };
  });

  // 商品详情（公开）
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const product = await productService.getById(req.params.id);
    if (!product) return { success: false, error: { code: 'NOT_FOUND', message: '商品不存在' } };
    return { success: true, data: product };
  });

  // 解析链接（需认证）
  app.post('/parse', { onRequest: authMiddleware }, async (req, reply) => {
    const { url } = req.body as { url: string };
    if (!url) return { success: false, error: { code: 'MISSING_URL', message: '请提供商品链接' } };

    const result = await productService.parseAndSave(url);
    return { success: true, data: result };
  });
}
