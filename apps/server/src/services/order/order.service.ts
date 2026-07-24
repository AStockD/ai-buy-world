import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

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

  async updateStatus(orderId: string, status: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
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

  async transitionStatus(orderId: string, newStatus: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('ORDER_NOT_FOUND');

    await this.updateStatus(orderId, newStatus);

    if (order.flylink_order_id) {
      try {
        const { flylinkClient } = await import('../../services/flylink/flylink.client.js');
        const statusMap: Record<string, string> = {
          '待支付': 'pending',
          '已支付': 'paid',
          '集货中': 'processing',
          '运输中': 'shipped',
          '待提货': 'arrived',
          '已提货': 'delivered',
        };
        await flylinkClient.syncOrderStatus(order.flylink_order_id, statusMap[newStatus] || 'unknown');
      } catch (err: any) {
        console.error(`FlyLink sync failed for order ${orderId}:`, err.message);
      }
    }

    if (newStatus === '待提货' && !order.pickup_code) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await prisma.order.update({
        where: { id: orderId },
        data: { pickup_code: code },
      });
    }
  }
}

export const orderService = new OrderService();
