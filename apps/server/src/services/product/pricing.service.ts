import { prisma } from '../../lib/prisma.js';

export class ProductPricingService {
  async ensureForRegion(productId: string, region: string): Promise<any> {
    const existing = await prisma.productPricing.findFirst({
      where: { product_id: productId, region, status: '生效' },
    });

    if (existing) return existing;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    const { exchangeRateService } = await import('../exchange/exchange-rate.service.js');
    const { exchangeRate, localProductPrice, shippingFee } = await exchangeRateService.calculatePrice({
      sourcePriceCNY: Number(product.source_price),
      weightKg: product.weight_kg ? Number(product.weight_kg) : 0.5,
      region,
    });

    const currencySymbols: Record<string, string> = {
      'US': '$', 'CA': 'C$', 'AU': 'A$', 'UK': '£', 'JP': '¥', 'KR': '₩', 'SG': 'S$',
    };

    return prisma.productPricing.create({
      data: {
        product_id: productId,
        region,
        currency: 'USD',
        currency_symbol: currencySymbols[region] || '$',
        local_price: localProductPrice,
        shipping_rate_per_kg: shippingFee / (product.weight_kg ? Number(product.weight_kg) : 0.5),
        shipping_category: '普通',
        estimated_shipping_fee: shippingFee,
        exchange_rate_snapshot: exchangeRate,
        exchange_rate_source: 'default',
        markup_rate: 0.05,
        status: '生效',
      },
    });
  }

  async getByRegion(productId: string, region: string) {
    return prisma.productPricing.findFirst({
      where: { product_id: productId, region, status: '生效' },
    });
  }
}

export const productPricingService = new ProductPricingService();
