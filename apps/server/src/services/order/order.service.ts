import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { notificationService } from '../notification/notification.service.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  '待支付': ['已支付', '已取消', '支付失败'],
  '支付失败': ['待支付'],
  '已支付': ['集货中'],
  '集货中': ['运输中'],
  '运输中': ['待提货'],
  '待提货': ['已提货'],
  '已提货': [],
  '已取消': [],
};

const FLYLINK_STATUS_MAP: Record<string, string> = {
  '待支付': 'pending',
  '支付失败': 'failed',
  '已支付': 'paid',
  '集货中': 'processing',
  '运输中': 'shipped',
  '待提货': 'arrived',
  '已提货': 'delivered',
  '已取消': 'cancelled',
};

export class OrderService {
  async generateOrderNo(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const key = `order:seq:${dateStr}`;

    const seq = await redis.incr(key);
    await redis.expire(key, 48 * 3600);

    return `AB${dateStr}${seq.toString().padStart(4, '0')}`;
  }

  async create(params: {
    user_id: string;
    product_id: string;
    selected_sku_id?: string;
    product_price: number;
    shipping_fee: number;
    total_amount: number;
    home_address: any;
    currency?: string;
    exchange_rate?: number;
    delivery_batch_id?: string;
    willing_to_receive_for_others?: boolean;
  }) {
    const order_no = await this.generateOrderNo();

    return prisma.order.create({
      data: {
        order_no,
        user_id: params.user_id,
        product_id: params.product_id,
        selected_sku_id: params.selected_sku_id,
        product_price: params.product_price,
        shipping_fee: params.shipping_fee,
        total_amount: params.total_amount,
        home_address: params.home_address,
        currency: params.currency || 'USD',
        exchange_rate: params.exchange_rate,
        status: '待支付',
        delivery_batch_id: params.delivery_batch_id,
        willing_to_receive_for_others: params.willing_to_receive_for_others || false,
      },
    });
  }

  async listByUser(userId: string, status?: string, page = 1, pageSize = 20) {
    const where: any = { user_id: userId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { product: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getById(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, user_id: userId },
      include: { product: true },
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');
    return order;
  }

  async updateFlylinkInfo(orderId: string, flylinkOrderId: string, paymentUrl: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        flylink_order_id: flylinkOrderId,
        flylink_payment_url: paymentUrl,
      },
    });
  }

  canTransition(fromStatus: string, toStatus: string): boolean {
    const allowed = VALID_TRANSITIONS[fromStatus];
    return allowed ? allowed.includes(toStatus) : false;
  }

  async transitionStatus(orderId: string, newStatus: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('ORDER_NOT_FOUND');

    if (!this.canTransition(order.status, newStatus)) {
      throw new Error(`INVALID_TRANSITION: ${order.status} → ${newStatus}`);
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    // 待提货时生成取件码
    if (newStatus === '待提货' && !order.pickup_code) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await prisma.order.update({
        where: { id: orderId },
        data: { pickup_code: code },
      });
      updated.pickup_code = code;
    }

    // 通知用户（失败不阻塞）
    try {
      await notificationService.notifyOrderStatusChange(order.user_id, orderId, newStatus);
    } catch (err: any) {
      console.error(`Notification failed for order ${orderId}:`, err.message);
    }

    // 同步 FlyLink（失败不阻塞）
    if (order.flylink_order_id) {
      try {
        const { flylinkClient } = await import('../../services/flylink/flylink.client.js');
        const flylinkStatus = FLYLINK_STATUS_MAP[newStatus];
        if (flylinkStatus) {
          await flylinkClient.syncOrderStatus(order.flylink_order_id, flylinkStatus);
        }
      } catch (err: any) {
        console.error(`FlyLink sync failed for order ${orderId}:`, err.message);
      }
    }

    return updated;
  }

  async cancelOrder(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, user_id: userId },
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');

    if (order.status !== '待支付') {
      throw new Error(`INVALID_TRANSITION: 只有待支付订单可以取消，当前状态: ${order.status}`);
    }

    return this.transitionStatus(orderId, '已取消');
  }

  async confirmPickup(orderId: string, userId: string, code: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, user_id: userId },
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');

    if (order.status !== '待提货') {
      throw new Error(`INVALID_TRANSITION: 只有待提货订单可以确认提货，当前状态: ${order.status}`);
    }

    if (!order.pickup_code || order.pickup_code !== code.toUpperCase()) {
      throw new Error('INVALID_PICKUP_CODE: 取件码不正确');
    }

    return this.transitionStatus(orderId, '已提货');
  }

  async mockPayment(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, user_id: userId },
    });
    if (!order) throw new Error('ORDER_NOT_FOUND');

    if (order.status !== '待支付') {
      throw new Error(`INVALID_TRANSITION: 只有待支付订单可以支付，当前状态: ${order.status}`);
    }

    // 待支付 → 已支付
    await this.transitionStatus(orderId, '已支付');

    // 创建交易记录
    await prisma.transaction.create({
      data: {
        transaction_no: `TXN${Date.now()}`,
        order_ids: [order.id],
        user_id: userId,
        payment_method: 'Mock',
        amount: Number(order.total_amount),
        currency: order.currency,
        status: '已支付',
        gateway_transaction_id: `mock_txn_${Date.now()}`,
        paid_at: new Date(),
      },
    });

    // 已支付 → 集货中（自动流转）
    await this.transitionStatus(orderId, '集货中');

    return prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  }
}

export const orderService = new OrderService();
