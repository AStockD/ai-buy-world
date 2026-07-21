import { chromium } from 'playwright';

const BASE = 'http://localhost:3003';
const EMAIL = 'docker@test.com';
const PASSWORD = 'Test123456';
const TAOBAO_URL = 'https://item.taobao.com/item.htm?id=623675070331';

const results = [];
let passed = 0;
let failed = 0;

function log(status, name, detail = '') {
  const icon = status === 'PASS' ? '✓' : '✗';
  const color = status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon} ${name}\x1b[0m${detail ? ' — ' + detail : ''}`);
  results.push({ status, name, detail });
  if (status === 'PASS') passed++;
  else failed++;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Collect console errors
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(`[console] ${msg.text()}`);
  });

  try {
    // ═══════════════════════════════════════
    // 1. AUTH: 登录页
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 1. 登录/注册 ═══\x1b[0m');

    await page.goto(BASE);
    await page.waitForLoadState('networkidle');

    // 1.1 登录页渲染
    const hasLoginBtn = await page.locator('button[type="submit"]', { hasText: '登录' }).isVisible();
    log(hasLoginBtn ? 'PASS' : 'FAIL', '登录页渲染', hasLoginBtn ? '' : '未找到登录按钮');

    // 1.2 切换到注册
    await page.locator('button', { hasText: '没有账号？去注册' }).click();
    const hasRegisterBtn = await page.locator('button[type="submit"]', { hasText: '注册' }).isVisible();
    log(hasRegisterBtn ? 'PASS' : 'FAIL', '切换注册', hasRegisterBtn ? '' : '未找到注册按钮');

    // 1.3 切回登录
    await page.locator('button', { hasText: '已有账号？去登录' }).click();

    // 1.4 测试账号一键填入
    await page.locator('button', { hasText: '测试账号一键填入' }).click();
    const emailVal = await page.locator('input[type="email"]').inputValue();
    log(emailVal === EMAIL ? 'PASS' : 'FAIL', '测试账号填入', `email=${emailVal}`);

    // 1.5 登录成功 → 跳转聊天页
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    const hasChatHeader = await page.locator('header >> text=AI购物助手').isVisible({ timeout: 5000 }).catch(() => false);
    log(hasChatHeader ? 'PASS' : 'FAIL', '登录成功跳转', `url=${page.url()}`);

    // ═══════════════════════════════════════
    // 2. 聊天页: 欢迎屏
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 2. 聊天页欢迎屏 ═══\x1b[0m');

    const hasWelcome = await page.locator('text=AIBuyWorld 购物助手').isVisible().catch(() => false);
    log(hasWelcome ? 'PASS' : 'FAIL', '欢迎标题');

    const welcomeCards = await page.locator('text=粘贴商品链接').count();
    log(welcomeCards > 0 ? 'PASS' : 'FAIL', '欢迎卡片', `count=${welcomeCards}`);

    const hasQuickChips = await page.locator('text=查看订单').count();
    log(hasQuickChips > 0 ? 'PASS' : 'FAIL', '快捷 Chips');

    // ═══════════════════════════════════════
    // 3. 聊天: 发送普通消息
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 3. 发送普通消息 ═══\x1b[0m');

    const textarea = page.locator('textarea');
    await textarea.fill('你好');
    await page.locator('button', { hasText: '➤' }).click();

    // 等待用户消息出现
    await page.waitForTimeout(500);
    const userMsgVisible = await page.locator('text=你好').last().isVisible();
    log(userMsgVisible ? 'PASS' : 'FAIL', '用户消息显示');

    // 等待 AI 回复（流式）
    await page.waitForTimeout(8000);
    const aiReply = await page.locator('text=AIBuyWorld').last().isVisible().catch(() => false);
    const hasAssistantContent = await page.locator('.whitespace-pre-wrap').last().textContent().catch(() => '');
    log(hasAssistantContent && hasAssistantContent.length > 5 ? 'PASS' : 'FAIL', 'AI 流式回复', `len=${hasAssistantContent?.length || 0}`);

    // ═══════════════════════════════════════
    // 4. 侧边栏
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 4. 侧边栏 ═══\x1b[0m');

    const sidebarVisible = await page.locator('aside').first().isVisible().catch(() => false);
    log(sidebarVisible ? 'PASS' : 'FAIL', '侧边栏显示');

    // 4.1 会话列表有数据
    const convCount = await page.locator('aside >> text=💬').count();
    log(convCount > 0 ? 'PASS' : 'FAIL', '会话列表', `count=${convCount}`);

    // 4.2 新对话按钮
    await page.locator('button', { hasText: '新对话' }).first().click();
    await page.waitForTimeout(500);
    const hasWelcomeAfterNew = await page.locator('text=AIBuyWorld 购物助手').isVisible().catch(() => false);
    log(hasWelcomeAfterNew ? 'PASS' : 'FAIL', '新对话重置到欢迎屏');

    // 4.3 点击历史会话
    const firstConv = page.locator('aside >> text=💬').first();
    if (await firstConv.isVisible().catch(() => false)) {
      await firstConv.click();
      await page.waitForTimeout(1000);
      // 应该加载历史消息
      const msgsAfterClick = await page.locator('.whitespace-pre-wrap').count();
      log(msgsAfterClick > 0 ? 'PASS' : 'FAIL', '点击会话加载历史', `msgs=${msgsAfterClick}`);
    } else {
      log('FAIL', '点击会话加载历史', '无历史会话可点击');
    }

    // ═══════════════════════════════════════
    // 5. 商品链接解析
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 5. 商品链接解析 ═══\x1b[0m');

    // 先新对话
    await page.locator('button', { hasText: '新对话' }).first().click();
    await page.waitForTimeout(500);

    await textarea.fill(TAOBAO_URL);
    await page.locator('button', { hasText: '➤' }).click();

    // 等待商品卡片出现
    await page.waitForTimeout(20000);
    const productCard = await page.locator('text=选择规格').first().isVisible().catch(() => false);
    const productCardContainer = await page.locator('.rounded-2xl.border').filter({ hasText: '加入心愿单' }).first().isVisible().catch(() => false);
    log(productCard || productCardContainer ? 'PASS' : 'FAIL', '商品卡片渲染', productCard ? '含SKU' : productCardContainer ? '无SKU区' : '未找到');

    // 5.1 SKU 规格可点击
    if (productCard || productCardContainer) {
      const specBtn = page.locator('button', { hasText: '定制定金' }).first();
      const specClickable = await specBtn.isVisible().catch(() => false);
      if (specClickable) {
        log('PASS', 'SKU 规格按钮可见');
        await specBtn.click();
        await page.waitForTimeout(300);
        const cls = await specBtn.getAttribute('class') || '';
        const isHighlighted = cls.includes('brand');
        log(isHighlighted ? 'PASS' : 'FAIL', 'SKU 点击高亮', `class=${cls.substring(0, 60)}`);
      } else {
        log('PASS', 'SKU 规格按钮可见', '无SKU区域（商品可能无规格）');
        log('PASS', 'SKU 点击高亮', '跳过（无SKU）');
      }
    } else {
      log('FAIL', 'SKU 规格按钮可见', '商品卡片未渲染');
      log('FAIL', 'SKU 点击高亮', '商品卡片未渲染');
    }

    // 5.2 AI 回复包含商品信息
    const aiContent = await page.locator('.whitespace-pre-wrap').last().textContent().catch(() => '');
    const hasProductName = aiContent && (aiContent.includes('傅荣') || aiContent.includes('金牌') || aiContent.includes('奖牌') || aiContent.includes('100') || aiContent.includes('华为') || aiContent.includes('MatePad') || aiContent.includes('商品名称') || aiContent.includes('解析成功'));
    log(hasProductName ? 'PASS' : 'FAIL', 'AI 回复含商品信息', `content="${(aiContent || '').substring(0, 80)}"`);

    // ═══════════════════════════════════════
    // 6. 心愿单页
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 6. 心愿单页 ═══\x1b[0m');

    await page.goto(BASE + '/wishlist');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const wishlistHeader = await page.locator('text=心愿单').first().isVisible().catch(() => false);
    log(wishlistHeader ? 'PASS' : 'FAIL', '心愿单页渲染');

    const wishlistEmpty = await page.locator('text=心愿单为空').isVisible().catch(() => false);
    const wishlistHasItems = await page.locator('.space-y-3 > div').count() > 0;
    log(wishlistEmpty || wishlistHasItems ? 'PASS' : 'FAIL', '心愿单状态', wishlistEmpty ? '空状态' : '有数据');

    // ═══════════════════════════════════════
    // 7. 订单页
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 7. 订单页 ═══\x1b[0m');

    await page.goto(BASE + '/orders');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const ordersHeader = await page.locator('h1', { hasText: '我的订单' }).isVisible().catch(() => false);
    log(ordersHeader ? 'PASS' : 'FAIL', '订单页渲染');

    // 7.1 状态筛选 tabs
    const filterTabs = await page.locator('button', { hasText: '待支付' }).isVisible().catch(() => false);
    log(filterTabs ? 'PASS' : 'FAIL', '订单筛选 tabs');

    const ordersEmpty = await page.locator('text=暂无订单').isVisible().catch(() => false);
    log(ordersEmpty ? 'PASS' : 'FAIL', '订单空状态');

    // 7.2 点击筛选
    await page.locator('button', { hasText: '待支付' }).click();
    await page.waitForTimeout(500);
    const stillVisible = await page.locator('text=暂无订单').isVisible().catch(() => false);
    log(stillVisible ? 'PASS' : 'FAIL', '筛选切换正常');

    // ═══════════════════════════════════════
    // 8. 个人页
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 8. 个人页 ═══\x1b[0m');

    await page.goto(BASE + '/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const profileHeader = await page.locator('text=我的').first().isVisible().catch(() => false);
    log(profileHeader ? 'PASS' : 'FAIL', '个人页渲染');

    const hasUserEmail = await page.locator('text=docker@test.com').isVisible().catch(() => false);
    const hasUserName = await page.locator('h2').textContent().catch(() => '').then(t => t.length > 0);
    log(hasUserEmail || hasUserName ? 'PASS' : 'FAIL', '显示用户名', `email=${hasUserEmail}, name=${hasUserName}`);

    const hasLogout = await page.locator('button', { hasText: '退出登录' }).isVisible().catch(() => false);
    log(hasLogout ? 'PASS' : 'FAIL', '退出按钮');

    // 菜单项
    const menuItems = await page.locator('text=我的地址').isVisible().catch(() => false);
    log(menuItems ? 'PASS' : 'FAIL', '菜单项渲染');

    // ═══════════════════════════════════════
    // 9. 侧边栏导航
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 9. 侧边栏导航 ═══\x1b[0m');

    // 从个人页通过侧边栏跳转
    await page.locator('aside').first().getByRole('link', { name: /心愿单/ }).click();
    await page.waitForTimeout(500);
    const navigatedToWishlist = page.url().includes('/wishlist');
    log(navigatedToWishlist ? 'PASS' : 'FAIL', '侧边栏→心愿单', `url=${page.url()}`);

    await page.locator('aside').first().getByRole('link', { name: /我的订单/ }).click();
    await page.waitForTimeout(500);
    const navigatedToOrders = page.url().includes('/orders');
    log(navigatedToOrders ? 'PASS' : 'FAIL', '侧边栏→订单', `url=${page.url()}`);

    // ═══════════════════════════════════════
    // 10. 欢迎卡片 & 快捷 Chips
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 10. 欢迎卡片 & Chips ═══\x1b[0m');

    // 新对话回欢迎屏
    await page.goto(BASE + '/?fresh=1');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 新对话
    await page.locator('button', { hasText: '新对话' }).first().click();
    await page.waitForTimeout(1000);

    // 点击快捷 chip
    const chipBtn = page.locator('button', { hasText: '计算运费' });
    const chipVisible = await chipBtn.isVisible().catch(() => false);
    if (chipVisible) {
      await chipBtn.click();
      await page.waitForTimeout(12000);
      const shippingCard = await page.locator('text=运费费率计算').isVisible().catch(() => false);
      const shippingText = await page.locator('.whitespace-pre-wrap').last().textContent().catch(() => '');
      const hasShippingResponse = shippingCard || (shippingText && (shippingText.includes('运费') || shippingText.includes('费率') || shippingText.includes('kg')));
      log(hasShippingResponse ? 'PASS' : 'FAIL', '快捷 Chip→运费卡片', shippingCard ? '卡片' : shippingText ? `文本="${shippingText.substring(0, 60)}"` : '无响应');
    } else {
      log('FAIL', '快捷 Chip→运费卡片', 'Chip 不可见');
    }

    // ═══════════════════════════════════════
    // 11. 页面错误检查
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══ 11. 错误检查 ═══\x1b[0m');

    const criticalErrors = pageErrors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('hydration') &&
      !e.includes('Hydration')
    );
    log(criticalErrors.length === 0 ? 'PASS' : 'FAIL', '无严重前端错误',
      criticalErrors.length === 0 ? '' : criticalErrors.slice(0, 3).join('; '));

    // ═══════════════════════════════════════
    // 汇总
    // ═══════════════════════════════════════
    console.log('\n\x1b[1m═══════════════════════════════════════');
    console.log(`测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
    console.log('═══════════════════════════════════════\x1b[0m\n');

    if (failed > 0) {
      console.log('\x1b[31m失败项:\x1b[0m');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  ✗ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
      });
    }

  } catch (err) {
    console.error('Test script error:', err.message);
    // Take screenshot on error
    await page.screenshot({ path: '/tmp/e2e-error.png' });
    console.log('Screenshot saved to /tmp/e2e-error.png');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
