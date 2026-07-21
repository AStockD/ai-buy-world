import { toolRegistry, type ToolContext } from '../tool-registry.js';
import { orderService } from '../../services/order/order.service.js';

toolRegistry.register({
  name: 'query_orders',
  description: '查询用户订单列表，支持按状态筛选',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['待支付', '集货中', '运输中', '待提货', '已提货', '全部'],
        description: '订单状态筛选，默认全部',
      },
      limit: { type: 'integer', default: 10 },
    },
  },
  handler: async (params: { status?: string; limit?: number }, context: ToolContext) => {
    const { userId, emitSSE } = context;

    emitSSE('tool_call', { tool: 'query_orders', status: 'running' });

    const status = params.status === '全部' ? undefined : params.status;
    const result = await orderService.listByUser(userId, status, 1, params.limit || 10);

    const cardData = {
      orders: result.items.map(o => ({
        orderId: o.id,
        orderNo: o.order_no,
        status: o.status,
        productName: (o as any).product?.name,
        totalAmount: Number(o.total_amount),
        currency: o.currency,
        createdAt: o.created_at,
      })),
      total: result.total,
    };

    emitSSE('card', { type: 'order_card', data: cardData });
    emitSSE('tool_result', { tool: 'query_orders', result: { total: result.total } });

    return cardData;
  },
});
