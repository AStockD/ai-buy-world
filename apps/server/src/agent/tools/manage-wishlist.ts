import { toolRegistry, type ToolContext } from '../tool-registry.js';
import { wishlistService } from '../../services/wishlist/wishlist.service.js';

toolRegistry.register({
  name: 'manage_wishlist',
  description: '管理心愿单：添加、移除、查看',
  parameters: {
    type: 'object',
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'remove', 'list'],
      },
      productId: { type: 'string', description: 'add/remove时必填' },
    },
  },
  handler: async (params: { action: string; productId?: string }, context: ToolContext) => {
    const { userId, emitSSE, sessionState } = context;

    emitSSE('tool_call', { tool: 'manage_wishlist', status: 'running' });

    let result: any;

    switch (params.action) {
      case 'add': {
        const productId = params.productId || sessionState.context.currentProduct?.productId;
        if (!productId) throw new Error('需要指定商品ID');
        result = await wishlistService.add(userId, productId);
        break;
      }
      case 'remove': {
        if (!params.productId) throw new Error('需要指定心愿单ID');
        result = await wishlistService.remove(userId, params.productId);
        break;
      }
      case 'list':
      default: {
        result = await wishlistService.list(userId);
        break;
      }
    }

    const items = Array.isArray(result) ? result : [result];
    const cardData = {
      action: params.action,
      items: items.map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        status: item.status,
        product: item.product ? { name: item.product.name, imageUrl: item.product.image_url } : null,
      })),
    };

    emitSSE('card', { type: 'wishlist_card', data: cardData });
    emitSSE('tool_result', { tool: 'manage_wishlist', result: { action: params.action, count: items.length } });

    return cardData;
  },
});
