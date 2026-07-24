import { toolRegistry, type ToolContext } from '../tool-registry.js';
import { orderService } from '../../services/order/order.service.js';
import { productService } from '../../services/product/product.service.js';
import { conversationService } from '../../services/conversation/conversation.service.js';
import { flylinkClient } from '../../services/flylink/flylink.client.js';
import { prisma } from '../../lib/prisma.js';

toolRegistry.register({
  name: 'create_order',
  description: '创建订单。可自动使用会话上下文中的商品、用户默认地址和推荐批次',
  parameters: {
    type: 'object',
    required: [],
    properties: {
      productId: { type: 'string', description: '商品 ID（不传则使用会话上下文中当前商品）' },
      skuId: { type: 'string', description: '选中的 SKU ID（如有规格）' },
      addressId: { type: 'string', description: '地址 ID（不传则使用用户默认地址）' },
      batchId: { type: 'string', description: '批次 ID（不传则自动选择最优批次）' },
      willingToReceiveForOthers: { type: 'boolean', description: '是否愿意代他人收货' },
    },
  },
  handler: async (params: {
    productId?: string;
    skuId?: string;
    addressId?: string;
    batchId?: string;
    willingToReceiveForOthers?: boolean;
  }, context: ToolContext) => {
    const { userId, conversationId, emitSSE, sessionState } = context;
    const ctx = sessionState.context;

    emitSSE('tool_call', { tool: 'create_order', status: 'running' });

    // 1. Resolve product: param > session context
    const productId = params.productId || ctx.currentProduct?.productId;
    if (!productId) throw new Error('未找到商品，请先解析商品链接');

    const product = await productService.getById(productId);
    if (!product) throw new Error('商品不存在');

    // 2. Calculate price based on SKU
    let productPrice = Number(product.source_price);
    let weightKg = Number(product.weight_kg) || 0;
    const skuVariants = product.sku_variants as any;
    const skuId = params.skuId || ctx.selectedSku?.skuId;

    if (skuId && skuVariants?.skus) {
      const sku = skuVariants.skus.find((s: any) => s.sku_id === skuId || s.id === skuId);
      if (sku) {
        productPrice += sku.price_delta || 0;
        weightKg = sku.weight_kg || weightKg;
      }
    }

    // 3. Convert CNY to USD
    const exchangeRate = 7.2;
    const productPriceUSD = Math.round((productPrice / exchangeRate) * 1.05 * 100) / 100;

    // 4. Calculate shipping fee
    const shippingRatePerKg = 5.0;
    const shippingFee = Math.round(weightKg * shippingRatePerKg * 100) / 100;

    // 5. Total
    const willing = params.willingToReceiveForOthers || false;
    const totalAmount = Math.round((productPriceUSD + shippingFee) * 100) / 100;

    // 6. Resolve address: param > default address
    let address;
    if (params.addressId) {
      address = await prisma.userAddress.findFirst({
        where: { id: params.addressId, user_id: userId },
      });
    }
    if (!address) {
      address = await prisma.userAddress.findFirst({
        where: { user_id: userId, is_default: true },
      });
    }
    if (!address) {
      address = await prisma.userAddress.findFirst({
        where: { user_id: userId },
      });
    }
    if (!address) {
      // 没有地址时不中断流程，设置状态让 LLM 引导用户添加地址
      await conversationService.setState(conversationId, {
        state: 'ADDRESS_NEEDED',
        context: { ...ctx, pendingAction: 'create_order_after_address' },
      });

      emitSSE('tool_result', { tool: 'create_order', result: { needsAddress: true } });

      return {
        needsAddress: true,
        message: '用户尚未添加收货地址，请先引导用户提供收货地址（姓名、电话、州/省、城市、街道、邮编、国家），收到后再继续下单。',
      };
    }

    const homeAddress = {
      id: address.id,
      recipientName: address.recipient_name,
      phone: address.phone,
      formatted: address.formatted,
      countryCode: address.country_code,
      adminArea1: address.admin_area1,
      adminArea2: address.admin_area2,
      streetAddress1: address.street_address1,
      postalCode: address.postal_code,
    };

    // 7. Resolve batch: param > best available batch
    let batch;
    if (params.batchId) {
      batch = await prisma.deliveryBatch.findFirst({ where: { id: params.batchId } });
    }
    if (!batch) {
      batch = await prisma.deliveryBatch.findFirst({
        where: { status: '集货中', order_deadline: { gt: new Date() } },
        orderBy: { current_orders: 'desc' },
      });
    }
    if (!batch) throw new Error('暂无可用集运批次');

    // 8. Create local order
    const order = await orderService.create({
      user_id: userId,
      product_id: productId,
      selected_sku_id: skuId,
      product_price: productPriceUSD,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
      home_address: homeAddress,
      currency: 'USD',
      exchange_rate: exchangeRate,
      delivery_batch_id: batch.id,
      willing_to_receive_for_others: willing,
    });

    // 9. Call FlyLink to create order (mock or real)
    try {
      const flylinkOrder = await flylinkClient.createOrder({
        product_id: product.flylink_product_id,
        sku_id: skuId || 'default',
        quantity: 1,
        address: homeAddress,
      });
      await orderService.updateFlylinkInfo(order.id, flylinkOrder.flylink_order_id, flylinkOrder.payment_url);
    } catch (err: any) {
      console.error('FlyLink order creation failed:', err.message);
    }

    // 10. Update batch stats
    await prisma.deliveryBatch.update({
      where: { id: batch.id },
      data: {
        current_orders: { increment: 1 },
        current_value: { increment: totalAmount },
      },
    });

    // 11. Update session state
    await conversationService.setState(conversationId, {
      state: 'PAYMENT_INIT',
      context: {
        ...ctx,
        currentOrder: { orderId: order.id, orderNo: order.order_no },
      },
    });

    // 12. Emit payment card
    const orderData = {
      orderId: order.id,
      orderNo: order.order_no,
      productName: product.name,
      productImage: product.image_url,
      productPrice: productPriceUSD,
      shippingFee,
      totalAmount,
      currency: 'USD',
      status: order.status,
      batchArea: batch.area,
      batchContact: batch.pickup_contact_name,
      paymentUrl: order.flylink_payment_url,
    };

    emitSSE('card', { type: 'payment_card', data: orderData });
    emitSSE('tool_result', { tool: 'create_order', result: { orderId: order.id, orderNo: order.order_no } });

    return {
      orderId: order.id,
      orderNo: order.order_no,
      totalAmount,
      currency: 'USD',
      status: order.status,
      paymentUrl: order.flylink_payment_url,
    };
  },
});
