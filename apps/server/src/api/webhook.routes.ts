import { FastifyInstance } from 'fastify';
import { orderService } from '../services/order/order.service.js';
import { prisma } from '../lib/prisma.js';

export async function webhookRoutes(app: FastifyInstance) {
  // FlyLink Webhook — 不需要认证，通过签名验证
  app.post('/flylink', async (req, reply) => {
    const body = req.body as any;
    const signature = req.headers['x-flylink-signature'] as string;

    // Mock 模式下跳过签名验证
    // 生产环境需要验证: verifyWebhookSignature(signature, body)

    const { event, data } = body || {};

    if (!event || !data) {
      return reply.code(400).send({ error: 'Missing event or data' });
    }

    switch (event) {
      case 'payment.completed':
        await handlePaymentCompleted(data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      default:
        return reply.code(200).send({ received: true });
    }

    return reply.code(200).send({ received: true });
  });

  // Mock 支付确认端点（用于测试，模拟用户完成支付）
  app.post('/mock/payment-complete', async (req, reply) => {
    const { orderNo } = req.body as any;
    if (!orderNo) {
      return reply.code(400).send({ error: 'Missing orderNo' });
    }

    const order = await prisma.order.findFirst({
      where: { order_no: orderNo },
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found' });
    }

    await handlePaymentCompleted({
      order_id: order.flylink_order_id || order.id,
      transaction_id: `mock_txn_${Date.now()}`,
      amount: Number(order.total_amount),
      order_no: orderNo,
    });

    return reply.code(200).send({
      success: true,
      message: `订单 ${orderNo} 已模拟支付成功`,
    });
  });
}

async function handlePaymentCompleted(data: {
  order_id: string;
  transaction_id: string;
  amount: number;
  order_no?: string;
}) {
  // 幂等处理：通过 flylink_order_id 或 order_no 查找
  let order;
  if (data.order_no) {
    order = await prisma.order.findFirst({ where: { order_no: data.order_no } });
  }
  if (!order && data.order_id) {
    order = await prisma.order.findFirst({ where: { flylink_order_id: data.order_id } });
  }
  if (!order) {
    console.error('Payment completed but order not found:', data);
    return;
  }

  // 已支付则跳过（幂等）
  if (order.status !== '待支付') {
    console.log(`Order ${order.order_no} already in status: ${order.status}`);
    return;
  }

  // 更新为已支付
  await orderService.transitionStatus(order.id, '已支付');

  // 更新交易记录
  await prisma.transaction.create({
    data: {
      transaction_no: `TXN${Date.now()}`,
      order_ids: [order.id],
      user_id: order.user_id,
      payment_method: 'FlyLink',
      amount: data.amount,
      currency: order.currency,
      status: '已支付',
      gateway_transaction_id: data.transaction_id,
      paid_at: new Date(),
    },
  });

  // 自动流转到集货中
  await orderService.transitionStatus(order.id, '集货中');

  console.log(`Order ${order.order_no} payment completed, transitioned to 集货中`);
}

async function handlePaymentFailed(data: { order_id: string; reason?: string }) {
  const order = await prisma.order.findFirst({
    where: { flylink_order_id: data.order_id },
  });

  if (!order || order.status !== '待支付') return;

  await orderService.transitionStatus(order.id, '支付失败');
  console.log(`Order ${order.order_no} payment failed: ${data.reason || 'unknown'}`);
}
