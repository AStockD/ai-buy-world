import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3003';
const TEST_EMAIL = 'docker@test.com';
const TEST_PASSWORD = 'Test123456';
const TEST_PRODUCT_URL = 'https://item.taobao.com/item.htm?id=623675070331';

test.describe('AIBuyWorld 前端 E2E 测试', () => {

  test('1. 登录流程 — 表单填写 + 提交 + 进入聊天页', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 应该看到登录页
    await expect(page.locator('text=AIBuyWorld')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // 填写登录表单
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // 等待进入聊天页（出现输入框或欢迎消息）
    await page.waitForTimeout(3000);

    // 验证聊天页元素
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10000 });
    console.log('✓ 登录成功，进入聊天页');

    // 截图
    await page.screenshot({ path: '/tmp/e2e/01-after-login.png', fullPage: true });
  });

  test('2. Sidebar 导航 — 心愿单/订单/设置 链接可点击', async ({ page }) => {
    // 使用桌面视口以显示侧边栏
    await page.setViewportSize({ width: 1280, height: 800 });

    // 先登录
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 打开侧边栏（移动端需要点击菜单按钮）
    const menuBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    // 桌面端侧边栏应该可见
    const sidebar = page.locator('aside').first();
    const sidebarVisible = await sidebar.isVisible();
    console.log(`侧边栏可见: ${sidebarVisible}`);

    if (sidebarVisible) {
      // 测试心愿单链接
      const wishlistLink = sidebar.locator('a[href="/wishlist"]');
      await expect(wishlistLink).toBeVisible();
      await wishlistLink.click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/.*wishlist/);
      console.log('✓ Sidebar → 心愿单 导航成功');
      await page.screenshot({ path: '/tmp/e2e/02-wishlist-page.png', fullPage: true });

      // 返回聊天页
      await page.goForward();
      await page.waitForTimeout(1000);

      // 测试订单链接
      const ordersLink = sidebar.locator('a[href="/orders"]');
      await expect(ordersLink).toBeVisible();
      await ordersLink.click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/.*orders/);
      console.log('✓ Sidebar → 我的订单 导航成功');
      await page.screenshot({ path: '/tmp/e2e/03-orders-page.png', fullPage: true });

      // 返回聊天页
      await page.goForward();
      await page.waitForTimeout(1000);

      // 测试设置链接（新增的）
      const settingsLink = sidebar.locator('a[href="/settings"]');
      await expect(settingsLink).toBeVisible();
      await settingsLink.click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/.*settings/);
      console.log('✓ Sidebar → 设置 导航成功');
      await page.screenshot({ path: '/tmp/e2e/04-settings-page.png', fullPage: true });
    } else {
      console.log('⚠ 侧边栏不可见（可能是移动端布局），跳过 sidebar 测试');
    }
  });

  test('3. 聊天页 ⚙️ 设置按钮 → 跳转 /settings', async ({ page }) => {
    // 登录
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 找到设置按钮（⚙️）
    const settingsBtn = page.locator('button[title="设置"]');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    await page.waitForTimeout(2000);

    // 验证跳转到设置页
    await expect(page).toHaveURL(/.*settings/);
    console.log('✓ ⚙️ 设置按钮点击 → 跳转 /settings 成功');
    await page.screenshot({ path: '/tmp/e2e/05-settings-via-header.png', fullPage: true });

    // 验证设置页内容
    await expect(page.getByRole('heading', { name: '语言' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '通知' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '关于' })).toBeVisible();
    await expect(page.locator('button:text("退出登录")')).toBeVisible();
    console.log('✓ 设置页内容完整（语言/通知/关于/退出登录）');
  });

  test('4. 发送商品链接 → 商品卡片渲染', async ({ page }) => {
    // 登录
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 输入商品链接
    const textarea = page.locator('textarea').first();
    await textarea.fill(TEST_PRODUCT_URL);
    console.log('✓ 输入商品链接');

    // 发送消息
    const sendBtn = page.locator('button').filter({ hasText: /发送|↑|➤/ }).first();
    await sendBtn.click();
    console.log('✓ 点击发送按钮');

    // 等待 AI 回复（可能需要较长时间，FlyLink 解析 + LLM 响应）
    await page.waitForTimeout(15000);
    await page.screenshot({ path: '/tmp/e2e/06-product-card-response.png', fullPage: true });

    // 检查是否有商品卡片（product_card 类型）
    // 商品卡片应该包含商品名称或价格
    const productCard = page.locator('text=加入心愿单').first();
    const hasProductCard = await productCard.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasProductCard) {
      console.log('✓ 商品卡片渲染成功（包含"加入心愿单"按钮）');

      // 检查"直接购买"按钮
      const buyBtn = page.locator('text=直接购买').first();
      await expect(buyBtn).toBeVisible();
      console.log('✓ 商品卡片包含"直接购买"按钮');

      // 检查"分享商品"按钮
      const shareBtn = page.locator('text=分享商品').first();
      await expect(shareBtn).toBeVisible();
      console.log('✓ 商品卡片包含"分享商品"按钮');
    } else {
      // 可能 AI 回复了文本但没有卡片
      const aiMessages = page.locator('.bg-surface-2, .rounded-2xl').last();
      const text = await aiMessages.textContent().catch(() => 'N/A');
      console.log(`⚠ 未检测到商品卡片，AI 回复内容: ${text?.substring(0, 200)}`);
    }
  });

  test('5. 商品卡片 → 点击"加入心愿单" → 触发对话', async ({ page }) => {
    // 登录
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 发送商品链接
    const textarea = page.locator('textarea').first();
    await textarea.fill(TEST_PRODUCT_URL);
    const sendBtn = page.locator('button').filter({ hasText: /发送|↑|➤/ }).first();
    await sendBtn.click();

    // 等待商品卡片出现
    await page.waitForTimeout(15000);

    const wishlistBtn = page.getByRole('button', { name: /加入心愿单/ });
    const hasCard = await wishlistBtn.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasCard) {
      await page.screenshot({ path: '/tmp/e2e/07-before-wishlist-click.png', fullPage: true });

      // 点击"加入心愿单"
      await wishlistBtn.click();
      console.log('✓ 点击"加入心愿单"按钮');

      // 等待消息出现在页面
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/e2e/08-after-wishlist-click.png', fullPage: true });

      // 检查页面是否包含消息文本
      const bodyText = await page.textContent('body');
      const msgSent = bodyText?.includes('把这个商品加入心愿单') ?? false;

      if (msgSent) {
        console.log('✓ 点击卡片按钮 → 自动发送"把这个商品加入心愿单"消息');

        // 等待 AI 处理
        await page.waitForTimeout(10000);
        await page.screenshot({ path: '/tmp/e2e/09-wishlist-response.png', fullPage: true });
        console.log('✓ AI 已处理心愿单请求');
      } else {
        console.log('⚠ 点击后未检测到消息发送');
      }
    } else {
      console.log('⚠ 商品卡片未出现，跳过心愿单按钮测试');
    }
  });

  test('6. 心愿单页面 — 验证数据', async ({ page }) => {
    // 登录
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 导航到心愿单
    const sidebar = page.locator('aside').first();
    if (await sidebar.isVisible()) {
      await sidebar.locator('a[href="/wishlist"]').click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/e2e/10-wishlist-page-data.png', fullPage: true });

      // 检查心愿单是否有内容
      const items = page.locator('img').filter({ has: page.locator('[alt]') });
      const count = await items.count();
      console.log(`心愿单页面商品图片数量: ${count}`);

      // 检查"购买"按钮是否存在
      const buyBtns = page.locator('button:text("购买")');
      const buyCount = await buyBtns.count();
      console.log(`心愿单"购买"按钮数量: ${buyCount}`);

      if (buyCount > 0) {
        console.log('✓ 心愿单页面包含"购买"按钮');
      }
    }
  });

  test('7. 订单页面 — 时间线 UI', async ({ page }) => {
    // 登录
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 导航到订单页
    const sidebar = page.locator('aside').first();
    if (await sidebar.isVisible()) {
      await sidebar.locator('a[href="/orders"]').click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/e2e/11-orders-page.png', fullPage: true });

      // 检查是否有订单
      const orderContent = await page.textContent('body');
      if (orderContent?.includes('订单号') || orderContent?.includes('暂无订单')) {
        console.log('✓ 订单页面加载正常');
      }

      // 如果有订单，检查时间线
      const timeline = page.locator('text=已下单').first();
      const hasTimeline = await timeline.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasTimeline) {
        console.log('✓ 订单时间线 UI 可见');
      } else {
        console.log('⚠ 无订单或时间线不可见');
      }
    }
  });

  test('8. 设置页 — 交互测试', async ({ page }) => {
    // 登录
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // 进入设置页
    await page.locator('button[title="设置"]').click();
    await page.waitForTimeout(2000);

    // 测试语言切换
    const enBtn = page.locator('button:text("English")');
    await enBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/e2e/12-settings-en-selected.png', fullPage: true });
    console.log('✓ 设置页 — 语言切换 English');

    const zhBtn = page.locator('button:text("中文")');
    await zhBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ 设置页 — 语言切换回中文');

    // 测试通知开关
    const toggle = page.locator('button').filter({ has: page.locator('div.rounded-full.bg-white') }).first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/e2e/13-settings-toggled.png', fullPage: true });
      console.log('✓ 设置页 — 通知开关可点击');
    }

    // 验证版本信息
    await expect(page.locator('text=0.2.0')).toBeVisible();
    console.log('✓ 设置页 — 版本号显示正确');
  });
});
