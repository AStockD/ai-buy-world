import { config } from '../../lib/config.js';
import { redis } from '../../lib/redis.js';
import crypto from 'crypto';

/**
 * FlyLink API 客户端封装
 * 开发环境无 API Key 时返回 mock 数据
 */
export class FlylinkClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.flylink.apiUrl;
    this.apiKey = config.flylink.apiKey;
  }

  /**
   * 解析商品链接 → 返回商品数据
   */
  async parseProduct(url: string): Promise<FlylinkProductData> {
    // 缓存检查
    const cacheKey = `flylink:parse:${crypto.createHash('md5').update(url).digest('hex')}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let data: FlylinkProductData;

    if (!this.apiKey || this.apiKey === 'dev-flylink-key') {
      // 开发环境 mock
      data = this.mockParse(url);
    } else {
      const res = await fetch(`${this.baseUrl}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) throw new Error(`FLYLINK_PARSE_ERROR: ${res.status}`);
      data = await res.json() as FlylinkProductData;
    }

    // 缓存 1 小时
    await redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);
    return data;
  }

  /**
   * 创建订单
   */
  async createOrder(params: { product_id: string; sku_id: string; quantity: number; address: any }): Promise<FlylinkOrderData> {
    if (!this.apiKey || this.apiKey === 'dev-flylink-key') {
      return this.mockCreateOrder(params);
    }

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error(`FLYLINK_ORDER_ERROR: ${res.status}`);
    return await res.json() as FlylinkOrderData;
  }

  /**
   * 同步订单状态到 FlyLink
   */
  async syncOrderStatus(flylinkOrderId: string, status: string): Promise<void> {
    if (!this.apiKey || this.apiKey === 'dev-flylink-key') return;

    await fetch(`${this.baseUrl}/orders/${flylinkOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ status }),
    });
  }

  private mockParse(url: string): FlylinkProductData {
    const isTaobao = url.includes('taobao') || url.includes('tmall');
    return {
      flylink_product_id: `fp_${crypto.randomBytes(8).toString('hex')}`,
      source_platform: isTaobao ? 'taobao' : 'unknown',
      source_url: url,
      title: `测试商品 - ${url.slice(0, 30)}...`,
      source_price: 99.00,
      source_currency: 'CNY',
      weight_kg: 0.5,
      image_url: 'https://via.placeholder.com/400x400.png?text=Product',
      sku_variants: {
        dimensions: ['颜色', '尺码'],
        skus: [
          { sku_id: 'sku_1', specs: { '颜色': '白色', '尺码': 'M' }, price_delta: 0, stock: 100, weight_kg: 0.5 },
          { sku_id: 'sku_2', specs: { '颜色': '黑色', '尺码': 'L' }, price_delta: 10, stock: 50, weight_kg: 0.6 },
        ],
      },
      raw_data: { mock: true },
    };
  }

  private mockCreateOrder(params: any): FlylinkOrderData {
    return {
      flylink_order_id: `fo_${crypto.randomBytes(8).toString('hex')}`,
      payment_url: `https://pay.flylink.example.com/mock/${Date.now()}`,
      status: 'pending',
      amount: 99.00,
      currency: 'USD',
    };
  }
}

export interface FlylinkProductData {
  flylink_product_id: string;
  source_platform: string;
  source_url: string;
  title: string;
  source_price: number;
  source_currency: string;
  weight_kg?: number;
  image_url?: string;
  sku_variants?: {
    dimensions: string[];
    skus: Array<{
      sku_id: string;
      specs: Record<string, string>;
      price_delta: number;
      stock: number;
      weight_kg?: number;
    }>;
  };
  raw_data?: any;
}

export interface FlylinkOrderData {
  flylink_order_id: string;
  payment_url: string;
  status: string;
  amount: number;
  currency: string;
}

export const flylinkClient = new FlylinkClient();
