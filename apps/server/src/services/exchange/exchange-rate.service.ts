import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { config } from '../../lib/config.js';

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
const DEVIATION_THRESHOLD = 0.05;
const PRICE_CHANGE_THRESHOLD = 0.03;

// 模拟汇率数据（无真实 API 时使用）
const MOCK_DAILY_RATES = [7.12, 7.15, 7.18, 7.10, 7.20, 7.14, 7.16, 7.19, 7.11, 7.17, 7.13, 7.21, 7.15, 7.18, 7.14];

export interface ExchangeRateUpdateResult {
  effectiveRate: number;
  source: string;
  currentRate: number;
  highRate15Day: number;
  deviation: number;
  pricingUpdated: number;
  notificationsSent: number;
}

export class ExchangeRateService {
  // Step 1: 获取当前市场汇率
  async fetchExchangeRate(): Promise<number> {
    if (config.llm.apiKey === '' || config.nodeEnv === 'test') {
      // Mock 模式：基于默认汇率加小幅波动
      const dayIndex = new Date().getDate() % MOCK_DAILY_RATES.length;
      return MOCK_DAILY_RATES[dayIndex];
    }
    // 真实模式：调用外部汇率 API
    try {
      const resp = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await resp.json() as any;
      return data?.rates?.CNY ? 1 / (data.rates.CNY / 100) : DEFAULT_RATE;
    } catch {
      return DEFAULT_RATE;
    }
  }

  // Step 2: 获取过去 15 天每日最高汇率
  async fetch15DayHighRate(): Promise<number> {
    if (config.llm.apiKey === '' || config.nodeEnv === 'test') {
      return Math.max(...MOCK_DAILY_RATES);
    }
    // 真实模式：从缓存的历史数据中取最高
    const history = await redis.lrange('exchange:rate:history', 0, 14);
    if (history.length === 0) return this.fetchExchangeRate();
    return Math.max(...history.map(Number));
  }

  // 7 步汇率更新算法（TECH_DESIGN §9.10.3）
  async updateExchangeRates(): Promise<ExchangeRateUpdateResult> {
    // Step 1: 获取当前市场汇率
    const currentRate = await this.fetchExchangeRate();

    // Step 2: 获取过去 15 天每日最高汇率
    const highRate15Day = await this.fetch15DayHighRate();

    // Step 3: 选择对用户最优的汇率（1 USD 换更多 CNY = 商品更便宜）
    const bestRate = Math.max(currentRate, highRate15Day);

    // Step 4: 计算偏差率
    const deviation = Math.abs(bestRate - currentRate) / currentRate;

    // Step 5: 偏差 > 5% 时设置地板价
    const effectiveRate = deviation > DEVIATION_THRESHOLD
      ? currentRate * (1 + DEVIATION_THRESHOLD)
      : bestRate;

    const source = deviation > DEVIATION_THRESHOLD ? '当前+5%' : '15日最高';

    // Step 6: 更新所有生效的 ProductPricing
    const pricingRecords = await prisma.productPricing.findMany({
      where: { status: '生效' },
    });

    let pricingUpdated = 0;
    let notificationsSent = 0;

    for (const pricing of pricingRecords) {
      const oldRate = Number(pricing.exchange_rate_snapshot);
      const rateChange = oldRate > 0 ? Math.abs(effectiveRate - oldRate) / oldRate : 0;

      // 重新计算本地价格
      const product = await prisma.product.findUnique({ where: { id: pricing.product_id } });
      const newLocalPrice = product
        ? Math.round((Number(product.source_price) / effectiveRate) * 100) / 100
        : Number(pricing.local_price);

      await prisma.productPricing.update({
        where: { id: pricing.id },
        data: {
          exchange_rate_snapshot: effectiveRate,
          exchange_rate_source: source,
          exchange_rate_updated_at: new Date(),
          local_price: newLocalPrice,
        },
      });
      pricingUpdated++;

      // Step 7: 价格变动 > 3% → 通知心愿单用户
      if (rateChange > PRICE_CHANGE_THRESHOLD) {
        const sent = await this.notifyWishlistUsers(
          pricing.product_id,
          rateChange,
          effectiveRate,
        );
        notificationsSent += sent;
      }
    }

    // 缓存更新
    await redis.set('exchange:rate:current', JSON.stringify({
      rate: effectiveRate,
      source,
      updatedAt: new Date().toISOString(),
    }), 'EX', 86400);

    // 记录历史（用于 15 日最高计算）
    await redis.lpush('exchange:rate:history', String(effectiveRate));
    await redis.ltrim('exchange:rate:history', 0, 14);

    return {
      effectiveRate,
      source,
      currentRate,
      highRate15Day,
      deviation,
      pricingUpdated,
      notificationsSent,
    };
  }

  // Step 7 辅助：通知心愿单用户价格变动
  private async notifyWishlistUsers(productId: string, rateChange: number, newRate: number): Promise<number> {
    const wishlistItems = await prisma.wishlist.findMany({
      where: { product_id: productId, status: '待购' },
    });

    const { notificationService } = await import('../notification/notification.service.js');
    const direction = rateChange > 0 ? '上涨' : '下降';
    const changePercent = (rateChange * 100).toFixed(1);

    for (const item of wishlistItems) {
      await notificationService.notifyPriceChange(
        item.user_id,
        productId,
        changePercent,
        direction,
      );
    }

    return wishlistItems.length;
  }

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
