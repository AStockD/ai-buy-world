import { toolRegistry, type ToolContext } from '../tool-registry.js';
import { productService } from '../../services/product/product.service.js';
import { conversationService } from '../../services/conversation/conversation.service.js';

toolRegistry.register({
  name: 'select_sku',
  description: '为商品选择规格（颜色/尺寸等），返回更新后的价格和重量',
  parameters: {
    type: 'object',
    required: ['productId', 'skuId'],
    properties: {
      productId: { type: 'string', description: '商品 ID' },
      skuId: { type: 'string', description: '选中的 SKU ID' },
    },
  },
  handler: async (params: { productId: string; skuId: string }, context: ToolContext) => {
    const { conversationId } = context;
    const product = await productService.getById(params.productId);
    if (!product) throw new Error('商品不存在');

    const skuVariants = product.sku_variants as any;
    if (!skuVariants?.skus) throw new Error('该商品无规格选项');

    const sku = skuVariants.skus.find((s: any) => s.sku_id === params.skuId || s.id === params.skuId);
    if (!sku) throw new Error('未找到指定规格');

    const basePrice = Number(product.source_price);
    const priceDelta = sku.price_delta || 0;
    const finalPrice = basePrice + priceDelta;
    const weightKg = sku.weight_kg || Number(product.weight_kg) || 0;

    // Update session state
    const state = await conversationService.getState(conversationId);
    await conversationService.setState(conversationId, {
      state: 'SKU_SELECTED',
      context: {
        ...state.context,
        currentProduct: { productId: product.id, name: product.name },
        selectedSku: { skuId: params.skuId, specs: sku.specs },
      },
    });

    return {
      productId: product.id,
      skuId: params.skuId,
      specs: sku.specs,
      price: finalPrice,
      currency: product.source_currency,
      weightKg,
      stock: sku.stock,
    };
  },
});
