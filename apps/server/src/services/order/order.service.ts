import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

export class OrderService {
  /**
   * 生成订单号: AB + YYMMDD + 4位序号
   */
  async generateOrderNo(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const key = `order:seq:${dateStr}`;

    const seq = await redis.incr(key);
    await redis.expire(key, 48 * 3600); // 48h TTL

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
  }) {
    const order_no = await this.generateOrderNo();

    return prisma.order.create({
      data: {
        order_no,
        ...params,
        status: '待支付',
        currency: params.currency || 'USD',
      },
    });
  }

  async listByUser(userId: string, status?: string, page = 1, pageSize = 20) {
    const where = {
      user_id: userId,
      ...(status && { status }),
    };

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
}

export const orderService = new OrderService();
