import { prisma } from '../../lib/prisma.js';

export class WishlistService {
  async list(userId: string, status?: string) {
    return prisma.wishlist.findMany({
      where: {
        user_id: userId,
        ...(status && { status }),
      },
      include: { product: true },
      orderBy: { added_at: 'desc' },
    });
  }

  async add(userId: string, productId: string, region = 'US') {
    // 检查是否已存在
    const existing = await prisma.wishlist.findUnique({
      where: { user_id_product_id: { user_id: userId, product_id: productId } },
    });

    if (existing) {
      // 恢复已删除的
      if (existing.status === '已过期') {
        return prisma.wishlist.update({
          where: { id: existing.id },
          data: { status: '待购' },
        });
      }
      return existing;
    }

    return prisma.wishlist.create({
      data: { user_id: userId, product_id: productId, region },
    });
  }

  async remove(userId: string, wishlistId: string) {
    const item = await prisma.wishlist.findFirst({
      where: { id: wishlistId, user_id: userId },
    });
    if (!item) throw new Error('NOT_FOUND');

    return prisma.wishlist.update({
      where: { id: wishlistId },
      data: { status: '已过期' },
    });
  }

  async markPurchased(userId: string, wishlistId: string) {
    return prisma.wishlist.updateMany({
      where: { id: wishlistId, user_id: userId },
      data: { status: '已购' },
    });
  }
}

export const wishlistService = new WishlistService();
