import { toolRegistry, type ToolContext } from '../tool-registry.js';
import { productService } from '../../services/product/product.service.js';
import { conversationService } from '../../services/conversation/conversation.service.js';

toolRegistry.register({
  name: 'flylink_parse',
  description: '解析中国电商平台的商品链接或淘口令，返回标准化商品信息',
  parameters: {
    type: 'object',
    required: ['input'],
    properties: {
      input: { type: 'string', description: '商品URL、短链接或淘宝口令' },
    },
  },
  handler: async (params: { input: string }, context: ToolContext) => {
    const { emitSSE, conversationId } = context;

    emitSSE('tool_call', { tool: 'flylink_parse', status: 'running' });
    emitSSE('parse_step', { step: 1, label: '来源识别', status: 'done' });

    emitSSE('parse_step', { step: 2, label: '数据抓取', status: 'running' });
    const result = await productService.parseAndSave(params.input);
    emitSSE('parse_step', { step: 2, label: '数据抓取', status: 'done' });

    emitSSE('parse_step', { step: 3, label: '多语言资产生成', status: 'done' });
    emitSSE('parse_step', { step: 4, label: 'AI 质检核验', status: 'done' });
    emitSSE('parse_step', { step: 5, label: '创建可支付资产', status: 'done' });

    const product = result.product;
    const cardData = {
      productId: product.id,
      name: product.name,
      imageUrl: product.image_url,
      sourcePlatform: product.source_platform,
      price: {
        local: Number(product.source_price),
        currency: product.source_currency,
      },
      weightKg: product.weight_kg ? Number(product.weight_kg) : null,
      skuVariants: product.sku_variants,
      isNew: result.isNew,
    };

    emitSSE('card', { type: 'product_card', data: cardData });
    emitSSE('tool_result', { tool: 'flylink_parse', result: { productId: product.id } });

    await conversationService.setState(conversationId, {
      state: 'PRODUCT_VIEWED',
      context: {
        currentProduct: { productId: product.id, name: product.name },
        selectedSku: null,
      },
    });

    // 将会话标题更新为商品名称
    await conversationService.updateTitle(conversationId, product.name);
    emitSSE('conversation_title_update', { conversationId, title: product.name });

    return {
      productId: product.id,
      isNew: result.isNew,
      name: product.name,
      platform: product.source_platform,
      price: `${product.source_currency} ${product.source_price}`,
      image: product.image_url,
      skuCount: product.sku_variants?.skus?.length || 0,
    };
  },
});
