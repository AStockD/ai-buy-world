import { prisma } from '../../lib/prisma.js';

export class NotificationService {
  async create(params: {
    userId: string;
    type: string;
    title: string;
    content: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    channel?: string;
  }) {
    return prisma.notification.create({
      data: {
        user_id: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        related_entity_type: params.relatedEntityType,
        related_entity_id: params.relatedEntityId,
        channel: params.channel || '对话内',
      },
    });
  }

  async listByUser(userId: string, unreadOnly = false, limit = 20) {
    return prisma.notification.findMany({
      where: {
        user_id: userId,
        ...(unreadOnly && { is_read: false }),
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { is_read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
  }

  async notifyOrderStatusChange(userId: string, orderId: string, newStatus: string) {
    const statusMessages: Record<string, { title: string; content: string }> = {
      '已支付': { title: '支付成功', content: '您的订单已支付成功，等待集货中。' },
      '集货中': { title: '集货中', content: '您的订单正在集货中，请耐心等待。' },
      '运输中': { title: '运输中', content: '您的订单正在运输途中。' },
      '待提货': { title: '待提货', content: '您的订单已到达提货点，请及时取件。' },
    };

    const msg = statusMessages[newStatus];
    if (!msg) return;

    return this.create({
      userId,
      type: 'order_status',
      title: msg.title,
      content: msg.content,
      relatedEntityType: 'order',
      relatedEntityId: orderId,
    });
  }

  async notifyPriceChange(userId: string, productId: string, changePercent: string, direction: string) {
    return this.create({
      userId,
      type: 'price_change',
      title: `心愿单商品${direction}`,
      content: `您关注的商品价格${direction}了 ${changePercent}%，快去看看吧！`,
      relatedEntityType: 'product',
      relatedEntityId: productId,
    });
  }
}

export const notificationService = new NotificationService();
