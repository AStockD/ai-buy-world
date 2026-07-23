# AIBuyWorld — AI 编码约束

> 本文件供 AI 编码工具（Cursor / Qoder / Copilot 等）在生成代码时遵循。
> 详细设计参见 `docs/TECH_DESIGN.md`，产品需求参见 `docs/PRD.md`。

---

## 1. 技术栈（不可替换）

| 层 | 选型 | 备注 |
|----|------|------|
| 前端 | Next.js 14 (App Router) + React 18 + TailwindCSS | 移动端优先，375px 基线 |
| 后端 | Node.js + Fastify | 不用 Express |
| 数据库 | PostgreSQL 16 + Prisma ORM | Schema 变更走 migrate，禁止手写 SQL 改表 |
| 缓存 | Redis 7 | 会话/限流/上下文热数据 |
| 消息队列 | BullMQ (Redis Streams) | 异步任务统一用 BullMQ |
| 实时通信 | SSE (Server-Sent Events) | **禁止 WebSocket**，所有实时推送走 SSE |
| PWA | next-pwa | Service Worker 缓存壳 |
| 状态管理 | Zustand (多 Store 分离) | 不用 Redux / Context 全局状态 |
| LLM | OpenAI / Claude (通过统一接口) | Function Calling 驱动 Tool 调用 |

---

## 2. 架构铁律

### 2.1 AI 原生 = AI 是主控中枢
- 用户输入 → AI Agent 识别意图 → 调用 Tool → 返回结果
- **不是** REST API 直接 CRUD，所有用户交互经由 Agent 编排
- 新增功能优先考虑"是否需要新 Tool"，而非"是否需要新 API"

### 2.2 通信协议
- 前后端通信：**SSE only**，不用 WebSocket
- 流式响应：`text/event-stream`，事件类型定义见 TECH_DESIGN §8.3
- 新增实时事件：在 SSE 事件协议中注册，不私自发明事件名

### 2.3 服务注册表模式
- 业务服务实现 `IService` 接口，通过 `ServiceRegistry` 注册（§9.10.0）
- 新增业务功能 = 新建 `src/services/{name}/` 目录 + 注册一行
- 服务间通过 Registry 引用，不直接 import 内部实现

### 2.4 意图注册表
- 意图配置存储在 `intent_configs` 表，由 `IntentRegistry` 加载（§6.3）
- 新增意图 = 数据库加记录 + 调用 reload，不改 Agent 核心代码
- 禁止在 Agent 代码中硬编码 if/else 判断意图

### 2.5 富卡片注册表
- 前端卡片通过 `registerCard(type, component)` 注册（§11.6）
- 新增卡片类型 = 新建组件 + 注册一行
- 禁止在渲染逻辑中 switch/case 硬编码卡片类型

---

## 3. 前端约束

### 3.1 移动端优先
- 设计基线 375px，所有组件先适配手机再考虑桌面
- 底部 Tab 导航，不用顶部汉堡菜单
- 安全区域适配（刘海、Home Indicator）
- 弹窗用 BottomSheet，不用 modal dialog

### 3.2 目录结构
- 页面放 `src/app/`，遵循 App Router 约定
- 卡片组件放 `src/components/cards/`
- 状态 Store 放 `src/stores/`，按职责拆分（chatStore / sessionStore / tabStore / userStore）
- 自定义 Hook 放 `src/hooks/`

### 3.3 性能红线
- 首屏 JS < 150KB（代码分割 + dynamic import）
- 消息列表用虚拟滚动（react-window / @tanstack/virtual）
- 图片用 `next/image` + WebP/AVIF + 懒加载
- 动画用 CSS transform，保证 60fps

---

## 4. 后端约束

### 4.1 API 风格
- RESTful 资源 API + SSE 流式端点
- 认证：JWT（Access Token 15min + Refresh Token 7d）+ Google OAuth
- 所有写操作需认证，读操作可匿名（商品浏览等）

### 4.2 数据库
- Schema 变更走 Prisma Migrate（§7.1.1），一个 PR 一个 migration
- 命名语义化：`add_exchange_rate_fields`，不用 `update_2`
- 只加不删：废弃字段标记 `@deprecated`，下版本再移除
- 大表（> 10 万行）加索引用 `CONCURRENTLY`
- 对话消息表按月分区

### 4.3 FlyLink 集成
- 所有 FlyLink API 调用通过 `FlylinkClient` 封装，不直接 fetch
- Webhook 端点必须验证签名 + 幂等处理（§9.10.1）
- 订单状态变更必须回调 FlyLink 同步（§9.10.2）
- 汇率更新走定时任务（每天 UTC 00:00），7 步算法（§9.10.3）

### 4.4 异步任务
- 耗时操作（解析、通知、刷新）入 BullMQ 队列
- 重试策略：指数退避，最多 5 次
- 失败入死信队列 + 告警

---

## 5. 业务规则（不可违反）

| 规则 | 说明 |
|------|------|
| 汇率地板 | 偏差 > 5% 时用当前汇率 + 5% 作为上限 |
| 折扣 | 代他人收货 8 折，仅当用户被选为提货地址时生效 |
| 价格变动通知 | 汇率变动 > 3% 时通知心愿单用户 |
| 批次推荐 | 三种标签策略：运费最优 / 货值保障 / 货量最大 |
| 地址匹配 | 优先级：邮编 > 坐标(5km) > 行政区域 |
| 商品刷新 | 每 6 小时刷新过期商品数据 |
| 支付回调 | FlyLink 失败重试 3 次（1min/5min/30min） |

---

## 6. 代码规范

- 语言：TypeScript strict mode
- 注释语言：中文（业务逻辑注释用中文）
- 错误消息：面向用户，中文，不暴露技术细节
- 环境变量：通过 `.env` 管理，配置模板见 TECH_DESIGN §9.1
- 测试：每个 Service 独立单元测试，关键路径（支付/下单）需集成测试
- 部署：Docker Compose，CI/CD 走 GitHub Actions（§10.6）
- **异步 onClick 必须有错误处理**：React 中 async 事件处理函数的未捕获 rejection 会被静默吞掉，用户看不到任何反馈。Zustand Store 的 async 方法必须 try/catch + 设置 error 状态

---

## 7. 禁止事项

- **禁止** 引入 WebSocket
- **禁止** 用 Redux / MobX / Context 做全局状态
- **禁止** 在 Agent 代码中硬编码意图判断
- **禁止** 在渲染逻辑中 switch 卡片类型
- **禁止** 直接 SQL 修改数据库 Schema（必须走 Prisma Migrate）
- **禁止** 绕过 `FlylinkClient` 直接调用 FlyLink API
- **禁止** 跳过 Webhook 签名验证
- **禁止** 前端直接调用 FlyLink API（必须走 BFF）
- **禁止** 在 SSR 中访问 localStorage / sessionStorage
- **禁止** async onClick handler 不捕获异常（静默失败 = 用户以为"没反应"）

---

## 8. 测试规范与经验教训

### 8.1 E2E 测试必须覆盖所有用户交互路径
- **不能只测页面导航**（URL 跳转），必须测**页面内交互**（按钮点击 → 状态变化 → UI 更新）
- 每个可点击的 UI 元素（WelcomeCard、Chip、Sidebar 列表项）都需要 E2E 覆盖
- curl 验证 API 可用 ≠ 前端交互可用，必须在真实浏览器中验证完整链路

### 8.2 前端异步错误处理铁律
- Zustand Store 的 async action（如 `sendMessage`、`selectConversation`）必须：
  1. 整个函数体包在 try/catch 中（包括前置异步操作如 `createConversation`）
  2. 维护 `error` 状态字段，catch 中设置错误消息
  3. 提供 `clearError()` 方法供 UI 清除错误
- 组件中的 async onClick 必须 catch 并展示错误，否则 React 静默吞掉 rejection

### 8.3 Playwright 定位器最佳实践
- 用 `getByRole('button', { name: '精确文本' })` 代替 `locator('button').filter({ hasText: '...' })`，避免匹配多个元素
- 页面有多个同名元素时（如 sidebar + main 区域），用 `main` / `aside` 限定作用域
- 移动端视口（375px）下 sidebar 可能隐藏，测试交互需用 `setViewportSize({ width: 1280 })` 确保桌面布局

### 8.4 回归测试检查清单
每次迭代完成后，E2E 回归测试必须验证：
1. 所有 Sidebar 列表项点击 → 对应数据加载
2. 所有 WelcomeCard / Chip 快捷按钮 → 消息发送成功
3. 错误场景 → 错误提示可见且可关闭
4. 已有功能不受影响（全量 E2E 通过）

---

## 9. Git 工作流（重要）

### 9.1 禁止使用 git push / git pull / git clone
本机 git 的 GnuTLS 存在 SSL 握手问题，无法直接通过 HTTPS 访问 GitHub。**必须使用 API 脚本替代**。

### 9.2 Token 配置
```bash
# Token 存储在本项目 .env.token（已加入 .gitignore）
source /var/projects/ai-buy-world/.env.token
# 或直接 export GITHUB_TOKEN=github_pat_xxx
```

### 9.3 共享脚本（跨项目通用）
脚本位于 `/var/projects/scripts/`，自动从 `git remote get-url origin` 读取 repo 信息，可在任意 GitHub 仓库中使用：

| 脚本 | 用途 | 用法 |
|------|------|------|
| `clone-via-api.sh` | 克隆仓库 | `clone-via-api.sh <owner/repo> [目标目录] [分支]` |
| `pull-via-api.sh` | 拉取更新 | `pull-via-api.sh [分支]`（在仓库目录内执行） |
| `push-via-api.sh` | 推送提交 | `push-via-api.sh [分支]`（在仓库目录内执行） |

### 9.4 克隆新仓库
```bash
source /var/projects/ai-buy-world/.env.token

# 克隆到指定目录
/var/projects/scripts/clone-via-api.sh AStockD/stock-media-ai-bot /var/projects/stock-media-ai-bot

# 克隆到当前目录（目录名 = repo 名）
/var/projects/scripts/clone-via-api.sh AStockD/stock-media-ai-bot

# 指定分支
/var/projects/scripts/clone-via-api.sh AStockD/stock-media-ai-bot /var/projects/stock-media-ai-bot develop
```
- 通过 GitHub API 下载所有文件
- 自动 `git init` + 设置 `remote origin`
- 创建初始提交

### 9.5 推送代码
```bash
cd /var/projects/ai-buy-world   # 在仓库目录内
source /var/projects/ai-buy-world/.env.token
/var/projects/scripts/push-via-api.sh            # 推送 main 分支
/var/projects/scripts/push-via-api.sh develop    # 推送指定分支
```
- 自动检测本地与远程的差异
- 通过 GitHub Git Data API 逐个提交推送
- 大文件通过 stdin 传递 base64，避免命令行参数溢出

### 9.6 拉取代码
```bash
cd /var/projects/ai-buy-world   # 在仓库目录内
source /var/projects/ai-buy-world/.env.token
/var/projects/scripts/pull-via-api.sh            # 拉取 main 分支
/var/projects/scripts/pull-via-api.sh develop    # 拉取指定分支
```
- 通过 GitHub API 获取远程更新
- 通过文件级比较（path|blob_sha）检测差异
- 自动下载变更文件并创建本地提交

### 9.7 完整工作流
```bash
# 1. 设置 token
source /var/projects/ai-buy-world/.env.token

# 2. 拉取最新
/var/projects/scripts/pull-via-api.sh

# 3. 开发、修改代码...

# 4. 本地提交
git add <files>
git commit -m "feat: xxx"

# 5. 推送到 GitHub
/var/projects/scripts/push-via-api.sh
```

### 9.8 项目内脚本
本项目 `scripts/` 目录下还保留了项目专属版本（硬编码 `AStockD/ai-buy-world`），以及通用版本（`*-generic.sh`）。日常使用推荐 `/var/projects/scripts/` 下的共享脚本。

### 9.9 部署流程
```bash
# 重建并部署
docker compose build server web
docker compose up -d server web

# 执行 seed（首次部署或数据重置时）
docker compose exec server sh -c "cd /app/apps/server && npx tsx prisma/seed.ts"
```
