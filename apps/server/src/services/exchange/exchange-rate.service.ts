import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

const SHIPPING_RATES: Record<string, Record<string, number>> = {
  'US': { '普通': 6.50, '大件': 9.75, '精品易碎': 13.00 },
  'CA': { '普通': 7.00, '大件': 10.50, '精品易碎': 14.00 },
  'AU': { '普通': 8.00, '大件': 12.00, '精品易碎': 16.00 },
  'UK': { '普通': 7.50, '大件': 11.25, '精品易碎': 15.00 },
  'JP': { '普通': 5.50, '大件': 8.25, '精品易碎': 11.00 },
  'KR': { '普通': 5.00, '大件': 7.50, '精品易碎': 10.00 },
  'SG': { '普通': 5.50, '大件': 8.25, '精品易碎': 11.00 },
};

const DEFAULT_RATE = 7.15;

export class ExchangeRateService {
  async getCurrentRate(): Promise<{ rate: number; source: string; updatedAt: string }> {
    const cached = await redis.get('exchange:rate:current');
    if (cached) return JSON.parse(cached);

    const fallback = { rate: DEFAULT_RATE, source: 'default', updatedAt: new Date().toISOString() };
    await redis.set('exchange:rate:current', JSON.stringify(fallback), 'EX', 86400);
    return fallback;
  }

  async getShippingRate(region: string, category: string = '普通'): Promise<number> {
    return SHIPPING_RATES[region]?.[category] ?? SHIPPING_RATES['US']['普通'];
  }

  async calculatePrice(params: {
    sourcePriceCNY: number;
    weightKg: number;
    region: string;
    currency?: string;
    shippingCategory?: string;
  }): Promise<{
    exchangeRate: number;
    localProductPrice: number;
    shippingFee: number;
    totalAmount: number;
    currency: string;
  }> {
    const { rate } = await this.getCurrentRate();
    const currency = params.currency || 'USD';
    const shippingCategory = params.shippingCategory || '普通';

    const shippingRatePerKg = await this.getShippingRate(params.region, shippingCategory);
    const shippingFee = Math.round(shippingRatePerKg * params.weightKg * 100) / 100;

    const localProductPrice = Math.round((params.sourcePriceCNY / rate) * 100) / 100;
    const totalAmount = Math.round((localProductPrice + shippingFee) * 100) / 100;

    return {
      exchangeRate: rate,
      localProductPrice,
      shippingFee,
      totalAmount,
      currency,
    };
  }

  async getRateTable(): Promise<Array<{ region: string; rates: Record<string, number> }>> {
    return Object.entries(SHIPPING_RATES).map(([region, rates]) => ({ region, rates }));
  }
}

export const exchangeRateService = new ExchangeRateService();
