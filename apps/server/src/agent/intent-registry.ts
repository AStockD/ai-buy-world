import { prisma } from '../lib/prisma.js';

export interface IntentConfig {
  id: string;
  patterns: string[];
  intent: string;
  tool?: string;
  priority: number;
  contextGuard?: string;
}

const DEFAULT_INTENTS: IntentConfig[] = [
  { id: 'url_detect', patterns: ['taobao.com', 'tmall.com', 'jd.com', '口令', '链接'], intent: '商品解析', tool: 'flylink_parse', priority: 1 },
  { id: 'sku_select', patterns: ['我要买这个', '选这个', '白色的', '黑色的', '买这个'], intent: '规格选择', tool: 'select_sku', priority: 2, contextGuard: 'has_product' },
  { id: 'buy_now', patterns: ['立即购买', '下单', '购买', '我要买'], intent: '立即购买', tool: 'create_order', priority: 2, contextGuard: 'has_product' },
  { id: 'order_query', patterns: ['查看我的订单', '包裹到哪了', '物流', '订单'], intent: '订单查询', tool: 'query_orders', priority: 5 },
  { id: 'wishlist', patterns: ['心愿单', '加入心愿单', '想买的', '收藏'], intent: '心愿单管理', tool: 'manage_wishlist', priority: 5 },
  { id: 'recommend', patterns: ['推荐', '大家都在买', '有什么好', '热门'], intent: '推荐', tool: 'get_recommendations', priority: 6 },
  { id: 'shipping', patterns: ['运费', '寄到', '邮费', '物流费'], intent: '运费查询', tool: 'calculate_shipping', priority: 6 },
  { id: 'address', patterns: ['我的地址', '添加地址', '改地址', '家庭地址'], intent: '地址管理', tool: 'manage_address', priority: 5 },
  { id: 'guide', patterns: ['怎么买', '购物流程', '如何购买', '怎么用'], intent: '购物指南', priority: 8 },
  { id: 'greeting', patterns: ['你好', 'hello', 'hi', '嗨'], intent: '问候', priority: 10 },
];

export class IntentRegistry {
  private intents: IntentConfig[] = [];
  private loaded = false;

  async load(): Promise<void> {
    try {
      const configs = await prisma.intentConfig.findMany({
        where: { is_active: true },
        orderBy: { priority: 'asc' },
      });

      if (configs.length > 0) {
        this.intents = configs.map((c: any) => ({
          id: c.intent_id,
          patterns: c.patterns as string[],
          intent: c.intent_name,
          tool: c.tool_name ?? undefined,
          priority: c.priority,
          contextGuard: c.context_guard ?? undefined,
        }));
      } else {
        this.intents = DEFAULT_INTENTS;
      }
    } catch {
      this.intents = DEFAULT_INTENTS;
    }
    this.loaded = true;
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.load();
  }

  match(input: string, contextGuard?: string): IntentConfig | null {
    const lower = input.toLowerCase();
    return this.intents
      .filter(i => !i.contextGuard || i.contextGuard === contextGuard)
      .find(i => i.patterns.some(p => lower.includes(p.toLowerCase()))) ?? null;
  }

  async reload(): Promise<void> {
    this.loaded = false;
    await this.load();
  }
}

export const intentRegistry = new IntentRegistry();
