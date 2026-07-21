import { config } from '../../lib/config.js';
import { redis } from '../../lib/redis.js';
import crypto from 'crypto';

export class FlylinkClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.flylink.apiUrl;
    this.apiKey = config.flylink.apiKey;
  }

  async parseProduct(url: string): Promise<FlylinkProductData> {
    const cacheKey = `flylink:parse:${crypto.createHash('md5').update(url).digest('hex')}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let data: FlylinkProductData;

    if (!this.apiKey || this.apiKey === 'dev-flylink-key') {
      data = this.mockParse(url);
    } else {
      // Step 1: Convert
      const convertRes = await fetch(`${this.baseUrl}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!convertRes.ok) throw new Error(`FLYLINK_CONVERT_ERROR: ${convertRes.status}`);
      const convertResult = await convertRes.json() as any;

      if (!convertResult.success) {
        throw new Error(convertResult.error || '商品解析失败');
      }

      // Step 2: Publish (optional - convert result already has all product data)
      let imageUrls: string[] = [];
      let productTitle = '未知商品';
      try {
        const rawData = typeof convertResult.raw === 'string'
          ? JSON.parse(convertResult.raw)
          : convertResult.raw;
        imageUrls = rawData?.images || [];
        productTitle = rawData?.title || rawData?.name || productTitle;
      } catch (e) {
        console.warn('Failed to parse raw data:', e);
      }

      let publishResult: any = null;
      try {
        const publishRes = await fetch(`${this.baseUrl}/publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            convert_result: convertResult,
            image_urls: imageUrls,
          }),
        });

        if (publishRes.ok) {
          const contentType = publishRes.headers.get('content-type') || '';
          if (contentType.includes('text/event-stream')) {
            const text = await publishRes.text();
            const dataLines = text.split('\n').filter(l => l.startsWith('data: '));
            for (const line of dataLines) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.success !== undefined) { publishResult = parsed; break; }
              } catch { /* skip */ }
            }
          } else {
            publishResult = await publishRes.json() as any;
          }
        }
      } catch (e) {
        console.warn('Publish step failed (non-critical):', e);
      }

      const pricing = convertResult.pricing || {};
      const skus = convertResult.skus || convertResult.raw?.sku_infos;
      const skuEntries = convertResult.raw?.sku_entries || [];
      const skuProps = convertResult.raw?.sku_props || [];

      let flylinkId = publishResult?.product_id || '';
      if (!flylinkId && convertResult.flylink_json) {
        try { flylinkId = JSON.parse(convertResult.flylink_json).flylink_id; } catch { /* skip */ }
      }

      const rawPriceMoney = convertResult.raw?.price_money;
      const sourcePrice = pricing.cny
        || pricing.original_price
        || (rawPriceMoney ? Number(rawPriceMoney) / 100 : 0);

      data = {
        flylink_product_id: flylinkId || convertResult.spu?.source_url || url,
        source_platform: convertResult.spu?.source_platform
          || (convertResult.source_url?.includes('taobao') ? 'taobao' : 'unknown'),
        source_url: convertResult.source_url || url,
        title: productTitle,
        source_price: sourcePrice,
        source_currency: 'CNY',
        image_url: imageUrls[0],
        sku_variants: (skuProps.length || skuEntries.length) ? {
          dimensions: skuProps.map((p: any) => p.name),
          skus: skuEntries.map((entry: any) => {
            const info = skus?.[String(entry.sku_id)] || {};
            const specs: Record<string, string> = {};
            const pathParts = (entry.prop_path || '').split(':');
            for (let i = 0; i + 1 < pathParts.length; i += 2) {
              const pid = pathParts[i];
              const vid = pathParts[i + 1];
              const prop = skuProps.find((p: any) => String(p.pid) === pid) || skuProps[i / 2];
              if (prop) {
                const v = prop.values?.find((vv: any) => String(vv.vid) === vid);
                specs[prop.name] = v?.name || vid;
              }
            }
            return {
              sku_id: String(entry.sku_id),
              specs,
              price_delta: info.price_money ? Number(info.price_money) / 100 : 0,
              stock: info.quantity || 0,
            };
          }),
        } : undefined,
        raw_data: convertResult,
      };
    }

    await redis.set(cacheKey, JSON.stringify(data), 'EX', 3600);
    return data;
  }

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
