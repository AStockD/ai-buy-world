import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes.js';
import { addressRoutes } from './address.routes.js';

export async function registerRoutes(app: FastifyInstance) {
  // 认证路由（公开）
  await app.register(authRoutes, { prefix: '/api/auth' });

  // 地址管理（需认证）
  await app.register(addressRoutes, { prefix: '/api/addresses' });

  // 后续迭代逐步注册
  // app.register(orderRoutes, { prefix: '/api/orders' });
  // app.register(wishlistRoutes, { prefix: '/api/wishlist' });
  // app.register(chatRoutes, { prefix: '/api/chat' });
  // app.register(webhookRoutes, { prefix: '/api/webhooks' });
}
