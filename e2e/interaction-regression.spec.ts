import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3003';
const TEST_EMAIL = 'docker@test.com';
const TEST_PASSWORD = 'Test123456';

async function login(page: any) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

test.describe('交互回归测试', () => {

  test('WelcomeCard 快捷入口点击 → 消息发送', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    // 验证欢迎卡片可见
    const welcomeCard = page.locator('button').filter({ hasText: '社区好物推荐' });
    await expect(welcomeCard).toBeVisible();

    // 点击快捷入口
    await welcomeCard.click();

    // 验证：用户消息出现在 main 区域（不在 sidebar）
    const mainArea = page.locator('main');
    const userMsg = mainArea.locator('p').filter({ hasText: '有什么推荐' });
    await expect(userMsg.first()).toBeVisible({ timeout: 10000 });

    // 验证 AI 也回复了
    const aiReply = mainArea.locator('p').filter({ hasText: /AIBuyWorld|好物|推荐/ });
    await expect(aiReply.first()).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: '/tmp/e2e/regression-welcome-card-click.png', fullPage: true });
  });

  test('Chip 快捷按钮点击 → 消息发送', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    // 点击 Chip 按钮（在 main 区域底部的快捷 chips，用精确文本匹配）
    const chip = page.getByRole('button', { name: '⭐ 好物推荐' });
    await expect(chip).toBeVisible();
    await chip.click();

    // 验证消息出现在 main 区域
    const mainArea = page.locator('main');
    const userMsg = mainArea.locator('p').filter({ hasText: '有什么推荐' });
    await expect(userMsg.first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: '/tmp/e2e/regression-chip-click.png', fullPage: true });
  });

  test('Sidebar 会话历史点击 → 加载对话消息', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    // 先发一条消息创建会话
    const textarea = page.locator('textarea').first();
    await textarea.fill('测试会话历史E2E');
    await textarea.press('Enter');

    // 等待消息出现在 main 区域
    const mainArea = page.locator('main');
    await expect(mainArea.locator('p').filter({ hasText: '测试会话历史E2E' }).first()).toBeVisible({ timeout: 10000 });

    // 点击"新对话"创建第二个会话（用 first() 避免匹配到 mobile drawer 里的重复按钮）
    const newChatBtn = page.locator('aside button').filter({ hasText: '新对话' }).first();
    await newChatBtn.click();
    await page.waitForTimeout(1000);

    // 在桌面侧边栏找到刚创建的会话并点击
    const sidebar = page.locator('aside').first();
    const convItem = sidebar.locator('div[class*="cursor-pointer"]').filter({ hasText: '测试会话历史E2E' });
    await expect(convItem.first()).toBeVisible({ timeout: 10000 });

    await convItem.first().click();

    // 验证：之前的消息应该被加载回 main 区域
    const loadedMsg = mainArea.locator('p').filter({ hasText: '测试会话历史E2E' });
    await expect(loadedMsg.first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: '/tmp/e2e/regression-sidebar-conv-click.png', fullPage: true });
  });

  test('错误状态显示 — 网络错误时显示错误横幅', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    // 拦截创建会话的 API 使其失败
    await page.route('**/api/chat/conversations', route => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: { message: '服务器内部错误' } }) });
    });

    // 点击 WelcomeCard 触发 sendMessage（会尝试创建会话）
    const welcomeCard = page.locator('button').filter({ hasText: '社区好物推荐' });
    await welcomeCard.click();
    await page.waitForTimeout(2000);

    // 验证错误横幅出现
    const errorBanner = page.locator('text=发送失败');
    await expect(errorBanner).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: '/tmp/e2e/regression-error-banner.png', fullPage: true });

    // 验证关闭按钮可点击
    const closeBtn = page.locator('button').filter({ hasText: '关闭' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(errorBanner).not.toBeVisible();
  });
});
