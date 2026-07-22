import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3003';

test('诊断：商品卡片按钮点击 → 消息发送', async ({ page }) => {
  // 收集 console 日志
  const logs: string[] = [];
  page.on('console', msg => logs.push(`[browser] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

  // 登录
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'docker@test.com');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // 发送商品链接
  const textarea = page.locator('textarea').first();
  await textarea.fill('https://item.taobao.com/item.htm?id=623675070331');

  // 用 Enter 发送
  await textarea.press('Enter');
  console.log('已发送商品链接，等待解析...');

  // 等待商品卡片出现
  const wishlistBtn = page.getByRole('button', { name: /加入心愿单/ });
  await wishlistBtn.waitFor({ state: 'visible', timeout: 20000 });
  console.log('商品卡片已出现');

  // 截图 - 点击前
  await page.screenshot({ path: '/tmp/e2e/diag-01-before-click.png', fullPage: true });

  // 记录当前消息数量
  const msgsBefore = await page.locator('[class*="flex-col"]').filter({ hasText: /.+/ }).count();
  console.log(`点击前消息区域元素数: ${msgsBefore}`);

  // 点击"加入心愿单"按钮
  await wishlistBtn.click();
  console.log('已点击"加入心愿单"');

  // 等待 500ms 看 DOM 变化
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/e2e/diag-02-after-click-500ms.png', fullPage: true });

  // 检查 textarea 是否有值（可能消息被填入输入框而非直接发送）
  const inputValue = await textarea.inputValue();
  console.log(`点击后 textarea 值: "${inputValue}"`);

  // 检查页面上是否出现了 "把这个商品加入心愿单" 文本
  const bodyText = await page.textContent('body');
  const hasWishlistMsg = bodyText?.includes('把这个商品加入心愿单');
  console.log(`页面包含"把这个商品加入心愿单": ${hasWishlistMsg}`);

  // 等待更长时间
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/e2e/diag-03-after-click-5s.png', fullPage: true });

  // 再次检查
  const bodyText2 = await page.textContent('body');
  const hasWishlistMsg2 = bodyText2?.includes('把这个商品加入心愿单');
  console.log(`5秒后页面包含"把这个商品加入心愿单": ${hasWishlistMsg2}`);

  // 输出浏览器日志
  console.log('\n--- 浏览器日志 ---');
  for (const log of logs) {
    console.log(log);
  }
});
