import { toolRegistry, type ToolContext } from '../tool-registry.js';
import { orderService } from '../../services/order/order.service.js';
import { prisma } from '../../lib/prisma.js';

toolRegistry.register({
  name: 'manage_order',
  description: '管理订单生命周期：支付、取消、确认提货。用户可通过对话触发这些操作',
  parameters: {
    type: 'object',
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['pay', 'cancel', 'confirm_pickup'],
        description: '操作类型：pay=支付, cancel=取消, confirm_pickup=确认提货',
      },
      orderId: {
        type: 'string',
        description: '订单 ID（不传则查找用户最新的待操作订单）',
      },
      pickupCode: {
        type: 'string',
        description: '取件码（confirm_pickup 时必须提供）',
      },
    },
  },
  handler: async (params: {
    action: 'pay' | 'cancel' | 'confirm_pickup';
    orderId?: string;
    pickupCode?: string;
  }, context: ToolContext) => {
    const { userId, emitSSE } = context;

    emitSSE('tool_call', { tool: 'manage_order', status: 'running' });

    let orderId = params.orderId;

    // 如果没有指定 orderId，查找用户最新的可操作订单
    if (!orderId) {
      const targetStatus = params.action === 'pay' ? '待支付'
        : params.action === 'cancel' ? '待支付'
        : '待提货';

      const order = await prisma.order.findFirst({
        where: { user_id: userId, status: targetStatus },
        orderBy: { created_at: 'desc' },
      });

      if (!order) {
        const actionLabels: Record<string, string> = {
          pay: '支付', cancel: '取消', confirm_pickup: '确认提货',
        };
        throw new Error(`没有找到可${actionLabels[params.action]}的订单`);
      }
      orderId = order.id;
    }

    switch (params.action) {
      case 'pay': {
        const order = await orderService.mockPayment(orderId, userId);
        emitSSE('card', {
          type: 'success_card',
          data: {
            orderNo: order.order_no,
            totalAmount: Number(order.total_amount),
            currency: order.currency,
            message: '支付成功，订单已进入集货阶段',
            estimatedShipDate: '预计本周五发货',
          },
        });
        emitSSE('tool_result', { tool: 'manage_order', result: { orderId, status: order.status } });
        return { orderId, status: order.status, message: '支付成功' };
      }

      case 'cancel': {
        const order = await orderService.cancelOrder(orderId, userId);
        emitSSE('tool_result', { tool: 'manage_order', result: { orderId, status: order.status } });
        return { orderId, status: order.status, message: '订单已取消' };
      }

      case 'confirm_pickup': {
        if (!params.pickupCode) {
          throw new Error('请提供取件码');
        }
        const order = await orderService.confirmPickup(orderId, userId, params.pickupCode);
        emitSSE('card', {
          type: 'success_card',
          data: {
            orderNo: order.order_no,
            message: '提货成功，感谢使用 AIBuyWorld！',
          },
        });
        emitSSE('tool_result', { tool: 'manage_order', result: { orderId, status: order.status } });
        return { orderId, status: order.status, message: '确认提货成功' };
      }

      default:
        throw new Error(`未知操作: ${params.action}`);
    }
  },
});
