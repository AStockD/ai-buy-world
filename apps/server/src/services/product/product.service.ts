import { prisma } from '../../lib/prisma.js';
import { flylinkClient, FlylinkProductData } from '../flylink/flylink.client.js';

export class ProductService {
  /**
   * 通过 FlyLink 解析链接并保存商品
   */
  async parseAndSave(url: string): Promise<{ product: any; isNew: boolean }> {
    const data = await flylinkClient.parseProduct(url);

    // 检查是否已存在
    const existing = await prisma.product.findUnique({
      where: { flylink_product_id: data.flylink_product_id },
    });

    if (existing) {
      // 更新
      const updated = await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: data.title,
          source_price: data.source_price,
          image_url: data.image_url,
          weight_kg: data.weight_kg,
          sku_variants: data.sku_variants as any,
          raw_data: data.raw_data,
          updated_at: new Date(),
        },
      });
      return { product: updated, isNew: false };
    }

    // 新建
    const product = await prisma.product.create({
      data: {
        flylink_product_id: data.flylink_product_id,
        flylink_url: url,
        source_platform: data.source_platform,
        source_url: data.source_url,
        name: data.title,
        source_price: data.source_price,
        source_currency: data.source_currency,
        weight_kg: data.weight_kg,
        image_url: data.image_url,
        sku_variants: data.sku_variants as any,
        raw_data: data.raw_data,
      },
    });

    return { product, isNew: true };
  }

  async getById(id: string) {
    return prisma.product.findUnique({ where: { id } });
  }

  async getByFlylinkId(flylinkProductId: string) {
    return prisma.product.findUnique({ where: { flylink_product_id: flylinkProductId } });
  }

  async listRecent(limit = 20) {
    return prisma.product.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}

export const productService = new ProductService();
