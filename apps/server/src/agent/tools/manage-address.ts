import { toolRegistry, type ToolContext } from '../tool-registry.js';
import { prisma } from '../../lib/prisma.js';

toolRegistry.register({
  name: 'manage_address',
  description: '管理用户家庭地址：查看、添加、设为默认',
  parameters: {
    type: 'object',
    required: ['action'],
    properties: {
      action: { type: 'string', enum: ['list', 'add', 'set_default'] },
      address: { type: 'object', description: 'add时必填，Address结构' },
      addressId: { type: 'string', description: 'set_default时必填' },
    },
  },
  handler: async (params: { action: string; address?: any; addressId?: string }, context: ToolContext) => {
    const { userId, emitSSE } = context;
    emitSSE('tool_call', { tool: 'manage_address', status: 'running' });

    let result: any;

    switch (params.action) {
      case 'list': {
        result = await prisma.userAddress.findMany({
          where: { user_id: userId },
          orderBy: { is_default: 'desc' },
        });
        break;
      }
      case 'add': {
        if (!params.address) throw new Error('地址信息不能为空');
        const addr = params.address;
        const formatted = [addr.street_address1, addr.admin_area2, addr.admin_area1, addr.postal_code, addr.country_code]
          .filter(Boolean).join(', ');
        result = await prisma.userAddress.create({
          data: {
            user_id: userId,
            country_code: addr.country_code || 'US',
            recipient_name: addr.recipient_name || '',
            phone: addr.phone || '',
            admin_area1: addr.admin_area1 || '',
            admin_area2: addr.admin_area2 || '',
            street_address1: addr.street_address1 || '',
            street_address2: addr.street_address2,
            postal_code: addr.postal_code,
            formatted,
          },
        });
        break;
      }
      case 'set_default': {
        if (!params.addressId) throw new Error('需要指定地址ID');
        await prisma.userAddress.updateMany({
          where: { user_id: userId },
          data: { is_default: false },
        });
        result = await prisma.userAddress.update({
          where: { id: params.addressId },
          data: { is_default: true },
        });
        break;
      }
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }

    const items = Array.isArray(result) ? result : [result];
    const cardData = {
      action: params.action,
      addresses: items.map((a: any) => ({
        id: a.id,
        formatted: a.formatted,
        isDefault: a.is_default,
        recipientName: a.recipient_name,
      })),
    };

    emitSSE('card', { type: 'address_card', data: cardData });
    emitSSE('tool_result', { tool: 'manage_address', result: { action: params.action } });

    return cardData;
  },
});
