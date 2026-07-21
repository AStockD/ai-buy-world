import { toolRegistry, type ToolContext } from '../tool-registry.js';

const SHIPPING_RATES: Record<string, number> = {
  'US': 6.50,
  'CA': 7.00,
  'AU': 8.00,
  'UK': 7.50,
  'JP': 5.50,
  'KR': 5.00,
  'SG': 5.50,
};

const CATEGORY_MULTIPLIER: Record<string, number> = {
  '普通': 1.0,
  '大件': 1.5,
  '精品易碎': 2.0,
  '不可邮': 0,
};

toolRegistry.register({
  name: 'calculate_shipping',
  description: '计算集运运费，展示费率体系',
  parameters: {
    type: 'object',
    properties: {
      weightKg: { type: 'number', description: '商品重量(kg)，不填则展示费率表' },
      region: { type: 'string', default: 'US' },
      category: { type: 'string', enum: ['普通', '大件', '精品易碎', '不可邮'], default: '普通' },
    },
  },
  handler: async (params: { weightKg?: number; region?: string; category?: string }, context: ToolContext) => {
    const { emitSSE } = context;
    emitSSE('tool_call', { tool: 'calculate_shipping', status: 'running' });

    const region = params.region || 'US';
    const category = params.category || '普通';
    const baseRate = SHIPPING_RATES[region] || 6.50;
    const multiplier = CATEGORY_MULTIPLIER[category] || 1.0;

    const rateTable = Object.entries(SHIPPING_RATES).map(([r, rate]) => ({
      region: r,
      ratePerKg: rate,
    }));

    let calculatedFee: number | null = null;
    if (params.weightKg != null && multiplier > 0) {
      calculatedFee = Math.round(baseRate * multiplier * params.weightKg * 100) / 100;
    }

    const cardData = {
      rateTable,
      calculatedFee,
      weightKg: params.weightKg ?? null,
      region,
      category,
      ratePerKg: baseRate * multiplier,
    };

    emitSSE('card', { type: 'shipping_card', data: cardData });
    emitSSE('tool_result', { tool: 'calculate_shipping', result: { calculatedFee } });

    return cardData;
  },
});
