import { FastifyInstance } from 'fastify';

export async function registerRoutes(app: FastifyInstance) {
  // 后续迭代逐步注册路由模块
  // app.register(authRoutes, { prefix: '/api/auth' });
  // app.register(userRoutes, { prefix: '/api/users' });
  // app.register(addressRoutes, { prefix: '/api/addresses' });
  // app.register(orderRoutes, { prefix: '/api/orders' });
  // app.register(wishlistRoutes, { prefix: '/api/wishlist' });
  // app.register(chatRoutes, { prefix: '/api/chat' });
  // app.register(webhookRoutes, { prefix: '/api/webhooks' });

  app.get('/api/ping', async () => {
    return { message: 'pong', timestamp: new Date().toISOString() };
  });
}
