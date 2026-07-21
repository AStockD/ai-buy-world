import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes.js';

export async function registerRoutes(app: FastifyInstance) {
  // 认证路由（公开）
  await app.register(authRoutes, { prefix: '/api/auth' });

  // 后续迭代逐步注册
  // app.register(addressRoutes, { prefix: '/api/addresses' });
  // app.register(orderRoutes, { prefix: '/api/orders' });
  // app.register(wishlistRoutes, { prefix: '/api/wishlist' });
  // app.register(chatRoutes, { prefix: '/api/chat' });
  // app.register(webhookRoutes, { prefix: '/api/webhooks' });
}
