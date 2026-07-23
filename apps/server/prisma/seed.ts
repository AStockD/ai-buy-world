import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedTestUsers() {
  const password_hash = await bcrypt.hash('Test123456', 12);

  await prisma.user.upsert({
    where: { email: 'docker@test.com' },
    update: { password_hash },
    create: {
      name: '测试用户',
      email: 'docker@test.com',
      password_hash,
      region: 'US',
    },
  });

  console.log('✅ 测试账号: docker@test.com / Test123456');
}

async function seedAddressFormats() {
  const formats = [
    {
      country_code: 'US',
      country_name: '美国',
      postal_code_format: { pattern: '^\\d{5}(-\\d{4})?$', example: '90001' },
      fields: ['recipient_name', 'phone', 'street_address1', 'street_address2', 'admin_area1', 'admin_area2', 'postal_code'],
      display_order: ['recipient_name', 'phone', 'street_address1', 'street_address2', 'admin_area2', 'admin_area1', 'postal_code'],
      admin_area1_label: 'State',
      has_admin_area2: true,
      has_admin_area3: false,
      formatted_template: '{{recipient_name}}\n{{street_address1}}\n{{street_address2}}\n{{admin_area2}}, {{admin_area1}} {{postal_code}}',
    },
    {
      country_code: 'CA',
      country_name: '加拿大',
      postal_code_format: { pattern: '^[A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d$', example: 'K1A 0B1' },
      fields: ['recipient_name', 'phone', 'street_address1', 'street_address2', 'admin_area1', 'admin_area2', 'postal_code'],
      display_order: ['recipient_name', 'phone', 'street_address1', 'street_address2', 'admin_area2', 'admin_area1', 'postal_code'],
      admin_area1_label: 'Province',
      has_admin_area2: true,
      has_admin_area3: false,
      formatted_template: '{{recipient_name}}\n{{street_address1}}\n{{street_address2}}\n{{admin_area2}} {{admin_area1}} {{postal_code}}',
    },
    {
      country_code: 'AU',
      country_name: '澳大利亚',
      postal_code_format: { pattern: '^\\d{4}$', example: '2000' },
      fields: ['recipient_name', 'phone', 'street_address1', 'street_address2', 'admin_area1', 'admin_area2', 'postal_code'],
      display_order: ['recipient_name', 'phone', 'street_address1', 'street_address2', 'admin_area2', 'admin_area1', 'postal_code'],
      admin_area1_label: 'State',
      has_admin_area2: true,
      has_admin_area3: false,
      formatted_template: '{{recipient_name}}\n{{street_address1}}\n{{street_address2}}\n{{admin_area2}} {{admin_area1}} {{postal_code}}',
    },
    {
      country_code: 'JP',
      country_name: '日本',
      postal_code_format: { pattern: '^\\d{3}-\\d{4}$', example: '100-0001' },
      fields: ['recipient_name', 'phone', 'postal_code', 'admin_area1', 'admin_area2', 'street_address1', 'street_address2'],
      display_order: ['recipient_name', 'phone', 'postal_code', 'admin_area1', 'admin_area2', 'street_address1', 'street_address2'],
      admin_area1_label: '都道府県',
      has_admin_area2: true,
      has_admin_area3: false,
      formatted_template: '〒{{postal_code}} {{admin_area1}}{{admin_area2}}\n{{street_address1}}\n{{recipient_name}}',
    },
    {
      country_code: 'GB',
      country_name: '英国',
      postal_code_format: { pattern: '^[A-Z]{1,2}\\d[A-Z\\d]?\\s?\\d[A-Z]{2}$', example: 'SW1A 1AA' },
      fields: ['recipient_name', 'phone', 'street_address1', 'street_address2', 'admin_area2', 'postal_code'],
      display_order: ['recipient_name', 'phone', 'street_address1', 'street_address2', 'admin_area2', 'postal_code'],
      admin_area1_label: 'County',
      has_admin_area2: true,
      has_admin_area3: false,
      formatted_template: '{{recipient_name}}\n{{street_address1}}\n{{street_address2}}\n{{admin_area2}}\n{{postal_code}}',
    },
  ];

  for (const f of formats) {
    await prisma.addressFormat.upsert({
      where: { country_code: f.country_code },
      update: f,
      create: f,
    });
  }

  console.log(`✅ 地址格式: ${formats.length} 个国家 (${formats.map(f => f.country_code).join(', ')})`);
}

async function seedIntentConfigs() {
  const intents = [
    {
      intent_id: 'url_detect',
      patterns: ['taobao.com', 'tmall.com', 'jd.com', '口令', '链接', '淘宝', '京东', '天猫'],
      intent_name: '商品解析',
      tool_name: 'flylink_parse',
      priority: 1,
      context_guard: null,
    },
    {
      intent_id: 'sku_select',
      patterns: ['我要买这个', '选这个', '白色的', '黑色的', '买这个', '选规格'],
      intent_name: '规格选择',
      tool_name: 'select_sku',
      priority: 2,
      context_guard: 'has_product',
    },
    {
      intent_id: 'buy_now',
      patterns: ['立即购买', '下单', '购买', '我要买', '结算'],
      intent_name: '立即购买',
      tool_name: 'create_order',
      priority: 2,
      context_guard: 'has_product',
    },
    {
      intent_id: 'order_query',
      patterns: ['查看我的订单', '包裹到哪了', '物流', '订单', '我的包裹', '快递'],
      intent_name: '订单查询',
      tool_name: 'query_orders',
      priority: 5,
      context_guard: null,
    },
    {
      intent_id: 'wishlist',
      patterns: ['心愿单', '加入心愿单', '想买的', '收藏', '加心愿单'],
      intent_name: '心愿单管理',
      tool_name: 'manage_wishlist',
      priority: 5,
      context_guard: null,
    },
    {
      intent_id: 'recommend',
      patterns: ['推荐', '大家都在买', '有什么好', '热门', '爆款', '有什么推荐'],
      intent_name: '推荐',
      tool_name: 'get_recommendations',
      priority: 6,
      context_guard: null,
    },
    {
      intent_id: 'shipping',
      patterns: ['运费', '寄到', '邮费', '物流费', '运费多少'],
      intent_name: '运费查询',
      tool_name: 'calculate_shipping',
      priority: 6,
      context_guard: null,
    },
    {
      intent_id: 'address',
      patterns: ['我的地址', '添加地址', '改地址', '家庭地址', '收货地址'],
      intent_name: '地址管理',
      tool_name: 'manage_address',
      priority: 5,
      context_guard: null,
    },
    {
      intent_id: 'guide',
      patterns: ['怎么买', '购物流程', '如何购买', '怎么用', '新手指南'],
      intent_name: '购物指南',
      tool_name: null,
      priority: 8,
      context_guard: null,
    },
    {
      intent_id: 'greeting',
      patterns: ['你好', 'hello', 'hi', '嗨', '在吗'],
      intent_name: '问候',
      tool_name: null,
      priority: 10,
      context_guard: null,
    },
  ];

  for (const i of intents) {
    await prisma.intentConfig.upsert({
      where: { intent_id: i.intent_id },
      update: i,
      create: i,
    });
  }

  console.log(`✅ 意图配置: ${intents.length} 个意图`);
}

async function seedProducts() {
  const now = new Date();
  const products = [
    {
      flylink_product_id: 'FL-DEMO-001',
      flylink_url: 'https://astockd.com/product/FL-DEMO-001',
      source_platform: 'taobao',
      source_url: 'https://item.taobao.com/item.htm?id=100001',
      name: 'Apple AirPods Pro 2 (USB-C)',
      source_price: 1599.00,
      source_currency: 'CNY',
      weight_kg: 0.15,
      rating: 4.80,
      sales_count: 5230,
      stock_status: '有货',
      image_url: 'https://picsum.photos/seed/airpods/400/400',
      verified_status: '已核验',
    },
    {
      flylink_product_id: 'FL-DEMO-002',
      flylink_url: 'https://astockd.com/product/FL-DEMO-002',
      source_platform: 'taobao',
      source_url: 'https://item.taobao.com/item.htm?id=100002',
      name: 'Nintendo Switch OLED 马力欧红蓝',
      source_price: 2199.00,
      source_currency: 'CNY',
      weight_kg: 0.68,
      rating: 4.90,
      sales_count: 3120,
      stock_status: '有货',
      image_url: 'https://picsum.photos/seed/switch/400/400',
      verified_status: '已核验',
    },
    {
      flylink_product_id: 'FL-DEMO-003',
      flylink_url: 'https://astockd.com/product/FL-DEMO-003',
      source_platform: 'jd',
      source_url: 'https://item.jd.com/100003.html',
      name: '戴森 Dyson V15 Detect 无线吸尘器',
      source_price: 4490.00,
      source_currency: 'CNY',
      weight_kg: 3.10,
      rating: 4.70,
      sales_count: 1890,
      stock_status: '有货',
      image_url: 'https://picsum.photos/seed/dyson/400/400',
      verified_status: '已核验',
    },
    {
      flylink_product_id: 'FL-DEMO-004',
      flylink_url: 'https://astockd.com/product/FL-DEMO-004',
      source_platform: 'tmall',
      source_url: 'https://detail.tmall.com/item.htm?id=100004',
      name: 'LEGO 乐高 哈利波特 霍格沃茨城堡 76419',
      source_price: 3299.00,
      source_currency: 'CNY',
      weight_kg: 2.50,
      rating: 4.95,
      sales_count: 870,
      stock_status: '有货',
      image_url: 'https://picsum.photos/seed/lego/400/400',
      verified_status: '已核验',
    },
    {
      flylink_product_id: 'FL-DEMO-005',
      flylink_url: 'https://astockd.com/product/FL-DEMO-005',
      source_platform: 'taobao',
      source_url: 'https://item.taobao.com/item.htm?id=100005',
      name: 'SK-II 神仙水 230ml 护肤精华',
      source_price: 1190.00,
      source_currency: 'CNY',
      weight_kg: 0.35,
      rating: 4.60,
      sales_count: 8900,
      stock_status: '有货',
      image_url: 'https://picsum.photos/seed/skii/400/400',
      verified_status: '已核验',
    },
    {
      flylink_product_id: 'FL-DEMO-006',
      flylink_url: 'https://astockd.com/product/FL-DEMO-006',
      source_platform: 'jd',
      source_url: 'https://item.jd.com/100006.html',
      name: 'Sony WH-1000XM5 头戴式降噪耳机 黑色',
      source_price: 2299.00,
      source_currency: 'CNY',
      weight_kg: 0.25,
      rating: 4.75,
      sales_count: 4200,
      stock_status: '有货',
      image_url: 'https://picsum.photos/seed/sony/400/400',
      verified_status: '已核验',
    },
  ];

  const pricingData = [
    { region: 'US', currency: 'USD', currency_symbol: '$', exchange_rate: 7.250000, shipping_rate: 8.50 },
    { region: 'CA', currency: 'CAD', currency_symbol: 'C$', exchange_rate: 5.350000, shipping_rate: 9.00 },
    { region: 'AU', currency: 'AUD', currency_symbol: 'A$', exchange_rate: 4.800000, shipping_rate: 9.50 },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { flylink_product_id: p.flylink_product_id },
      update: p,
      create: p,
    });

    for (const pr of pricingData) {
      const localPrice = Number(p.source_price) / pr.exchange_rate;
      const shippingFee = Number(p.weight_kg ?? 0.5) * pr.shipping_rate;
      const markup = 1.05;

      await prisma.productPricing.upsert({
        where: {
          product_id_region_status: {
            product_id: product.id,
            region: pr.region,
            status: '生效',
          },
        },
        update: {
          currency: pr.currency,
          currency_symbol: pr.currency_symbol,
          local_price: Math.round(localPrice * markup * 100) / 100,
          shipping_rate_per_kg: pr.shipping_rate,
          estimated_shipping_fee: shippingFee,
          exchange_rate_snapshot: pr.exchange_rate,
          exchange_rate_source: 'seed',
          exchange_rate_updated_at: now,
          markup_rate: 0.05,
        },
        create: {
          product_id: product.id,
          region: pr.region,
          currency: pr.currency,
          currency_symbol: pr.currency_symbol,
          local_price: Math.round(localPrice * markup * 100) / 100,
          shipping_rate_per_kg: pr.shipping_rate,
          shipping_category: '普通',
          estimated_shipping_fee: shippingFee,
          exchange_rate_snapshot: pr.exchange_rate,
          exchange_rate_source: 'seed',
          exchange_rate_updated_at: now,
          markup_rate: 0.05,
        },
      });
    }
  }

  console.log(`✅ 商品: ${products.length} 个，每个 ${pricingData.length} 个区域定价`);
}

async function seedDeliveryBatches() {
  const now = new Date();
  const batches = [
    {
      batch_no: 'B240701A',
      region: 'US',
      area: '洛杉矶',
      pickup_address: { city: 'Los Angeles', address: '123 Main St, Los Angeles, CA 90001' },
      pickup_contact_name: '张经理',
      pickup_contact_phone: '+1-213-555-0101',
      current_orders: 18,
      current_value: 3200,
      order_deadline: new Date(now.getTime() + 3 * 24 * 3600 * 1000),
      ship_date: new Date(now.getTime() + 4 * 24 * 3600 * 1000),
      estimated_arrival: new Date(now.getTime() + 14 * 24 * 3600 * 1000),
      status: '集货中',
    },
    {
      batch_no: 'B240701B',
      region: 'US',
      area: '纽约',
      pickup_address: { city: 'New York', address: '456 Broadway, New York, NY 10013' },
      pickup_contact_name: '李经理',
      pickup_contact_phone: '+1-212-555-0202',
      current_orders: 12,
      current_value: 2800,
      order_deadline: new Date(now.getTime() + 5 * 24 * 3600 * 1000),
      ship_date: new Date(now.getTime() + 6 * 24 * 3600 * 1000),
      estimated_arrival: new Date(now.getTime() + 18 * 24 * 3600 * 1000),
      status: '集货中',
    },
    {
      batch_no: 'B240701C',
      region: 'US',
      area: '旧金山',
      pickup_address: { city: 'San Francisco', address: '789 Market St, San Francisco, CA 94103' },
      pickup_contact_name: '王经理',
      pickup_contact_phone: '+1-415-555-0303',
      current_orders: 8,
      current_value: 1500,
      order_deadline: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      ship_date: null,
      estimated_arrival: null,
      status: '集货中',
    },
  ];

  for (const b of batches) {
    await prisma.deliveryBatch.upsert({
      where: { batch_no: b.batch_no },
      update: b,
      create: b,
    });
  }

  console.log(`✅ 集运批次: ${batches.length} 个`);
}

async function main() {
  console.log('🌱 开始 seed...\n');

  await seedTestUsers();
  await seedAddressFormats();
  await seedIntentConfigs();
  await seedProducts();
  await seedDeliveryBatches();

  console.log('\n🎉 Seed 完成！');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
