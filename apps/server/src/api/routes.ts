import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes.js';
import { addressRoutes } from './address.routes.js';
import { productRoutes } from './product.routes.js';
import { wishlistRoutes } from './wishlist.routes.js';
import { orderRoutes } from './order.routes.js';
import { chatRoutes } from './chat.routes.js';
import { notificationRoutes } from './notification.routes.js';

export async function registerRoutes(app: FastifyInstance) {
  // 认证路由（公开）
  await app.register(authRoutes, { prefix: '/api/auth' });

  // 地址管理（需认证）
  await app.register(addressRoutes, { prefix: '/api/addresses' });

  // 商品（公开列表/详情，解析需认证）
  await app.register(productRoutes, { prefix: '/api/products' });

  // 心愿单（需认证）
  await app.register(wishlistRoutes, { prefix: '/api/wishlist' });

  // 订单（需认证）
  await app.register(orderRoutes, { prefix: '/api/orders' });

  // AI 对话（需认证）
  await app.register(chatRoutes, { prefix: '/api/chat' });

  // 通知（需认证）
  await app.register(notificationRoutes, { prefix: '/api/notifications' });

  // 后续迭代逐步注册
  // app.register(webhookRoutes, { prefix: '/api/webhooks' });
}
