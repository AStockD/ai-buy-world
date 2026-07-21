import { toolRegistry, type ToolContext } from '../tool-registry.js';

toolRegistry.register({
  name: 'get_recommendations',
  description: '获取社区好物推荐榜单',
  parameters: {
    type: 'object',
    properties: {
      source: { type: 'string', enum: ['order_history', 'nearby_buyers', 'platform', 'personal', 'all'], default: 'all' },
      limit: { type: 'integer', default: 8 },
    },
  },
  handler: async (params: { source?: string; limit?: number }, context: ToolContext) => {
    const { emitSSE, userRegion } = context;
    emitSSE('tool_call', { tool: 'get_recommendations', status: 'running' });

    // MVP: 返回最近商品作为推荐
    const { prisma } = await import('../../lib/prisma.js');
    const products = await prisma.product.findMany({
      orderBy: { created_at: 'desc' },
      take: params.limit || 8,
    });

    const cardData = {
      source: params.source || 'all',
      items: products.map(p => ({
        productId: p.id,
        name: p.name,
        imageUrl: p.image_url,
        price: Number(p.source_price),
        currency: p.source_currency,
        rating: p.rating ? Number(p.rating) : null,
        salesCount: p.sales_count || 0,
      })),
      region: userRegion,
    };

    emitSSE('card', { type: 'recommendation_card', data: cardData });
    emitSSE('tool_result', { tool: 'get_recommendations', result: { count: products.length } });

    return cardData;
  },
});
