# AIBuyWorld 实现迭代计划

> 基于 PRD v1.0 + TECH_DESIGN v1.0 + 当前实现状态  
> 日期：2026-07-22  
> 当前完成度：~65%  
> 上次更新：Iteration 1 全部完成，Iteration 2 基本完成，浏览器 E2E 8/8 通过，已提交 `491f847`

---

## 当前已实现功能清单

### 前端
- [x] 用户认证（注册/登录/JWT）
- [x] 对话 UI（SSE 流式渲染、消息历史、欢迎页）
- [x] FlyLink 商品解析 → 商品卡片展示
- [x] 商品卡片 SKU 规格选择（按钮交互 + 状态管理）
- [x] 心愿单页面（列表/添加/移除/批量下单/单件购买）
- [x] 订单页面（列表/详情）
- [x] 地址管理页面（CRUD + 设默认）
- [x] 个人页（基础框架）
- [x] 侧边栏导航 + 移动端抽屉
- [x] 底部 Tab 导航
- [x] 推荐卡片、运费卡片、地址卡片
- [x] BFF 代理（Next.js catch-all → Fastify，SSE 支持）
- [x] 卡片注册表模式（card-registry.tsx，替代硬编码 switch/case）
- [x] 购买流程卡片全链路（AddressSelect/Willing/BatchSelect/Payment/Success）
- [x] 商品卡片按钮交互（心愿单/购买 → onAction → sendMessage）
- [x] 订单物流时间线 UI（5 步进度条 + 状态颜色）
- [x] AI 反馈按钮（👍/👎）
- [x] 设置页（/settings）
- [x] 购物指南页（/guide）
- [x] 社区推荐独立页（/community + 来源筛选）
- [x] 商品分享按钮（clipboard copy）
- [x] PWA 基础（Service Worker + manifest + 离线缓存）
- [x] 前端会话状态机（store-session.ts, Zustand）
- [x] 地址表单组件（AddressForm.tsx，按国家动态字段）

### 后端
- [x] AI Agent 引擎（意图识别 + Tool Calling + LLM 流式输出）
- [x] 8 个 Agent Tool（flylink-parse, query-orders, manage-wishlist, calculate-shipping, manage-address, get-recommendations, select-sku, create-order）
- [x] IntentRegistry（数据库 + 默认配置回退）
- [x] FlyLink 客户端封装（convert + publish 全链路）
- [x] 11 个后端服务文件（address, auth, batch, conversation, discount, exchange, flylink, notification, order, product/pricing, wishlist）
- [x] 数据库 17 张表（Prisma Schema + PostgreSQL）
- [x] Redis 缓存（会话状态 + 限流 + 上下文热数据）
- [x] JWT 认证 + 限流中间件
- [x] SSE 流式通信
- [x] 会话上下文注入（LLM 感知当前商品/地址/订单状态）
- [x] 订单状态流转 + FlyLink 同步（transitionStatus）
- [x] Webhook 端点（FlyLink 签名验证 + mock 支付测试）
- [x] 批次推荐路由（/api/batches/recommend）
- [x] 订单号生成（Redis INCR: AB + YYMMDD + 4位序号）
- [x] 多轮对话状态管理（Redis SessionState + context）

### 测试
- [x] E2E 测试 31/31 通过（Playwright）
- [x] 后端单元测试（auth, address, chat, cache, config, product-wishlist-order, business-services）
- [x] 购买流程 E2E 验证（FlyLink 真实解析 → 心愿单 → 下单 → Mock 支付 → 状态流转，DB + API 数据验证）

---

## 迭代计划

### Iteration 1：完整购买闭环（核心交易链路） ✅ 已完成

**目标**：用户能从粘贴链接到完成支付，走通整个购买流程

#### 前端任务

- [x] **1.1 商品卡片按钮交互** → `ProductCard.tsx` onAction('wishlist'/'buy') → sendMessage
- [x] **1.2 地址选择卡片（下单流程）** → `AddressSelectCard.tsx` + `AddressForm.tsx`
- [x] **1.3 代他人收货意愿卡片** → `WillingCard.tsx`
- [x] **1.4 批次选择卡片** → `BatchSelectCard.tsx`
- [x] **1.5 支付卡片** → `PaymentCard.tsx`
- [x] **1.6 支付成功卡片** → `SuccessCard.tsx`
- [x] **1.7 前端会话状态机（sessionStore）** → `store-session.ts`

#### 后端任务

- [x] **1.8 select_sku Tool** → `select-sku.ts`
- [x] **1.9 订单创建服务** → `order.service.ts` 扩展 + `create-order.ts`
- [x] **1.10 多轮对话状态机** → `conversation.service.ts` SessionState + context 扩展
- [x] **1.11 create_order Tool** → `create-order.ts`
- [x] **1.12 FlyLink Webhook 端点** → `webhook.routes.ts`（含 mock 支付测试端点）
- [x] **1.13 订单状态流转 + FlyLink 回调** → `order.service.ts` transitionStatus + FlyLink sync

#### 依赖
| 项目 | 说明 | 阻塞程度 |
|------|------|----------|
| FlyLink 支付 API | 需要支付创建 + Webhook 文档。无测试环境则用 mock 模式 | 中（可 mock） |
| 订单号格式 | 确认 `AB` + `YYMMDD` + 4位序号 | 低（已定） |

---

### Iteration 2：体验完善 + 前端补全 ✅ 基本完成（剩余 1 项）

**目标**：PRD 中所有 UI 功能全部可用

- [x] **2.1 订单物流时间线** → OrderCard 5 步时间线 + 状态颜色
- [ ] **2.2 对话历史回放** → 侧边栏历史对话点击后回放（打字机效果）← **待完成**
- [x] **2.3 AI 反馈（👍/👎）** → ChatPage 消息下方反馈按钮
- [x] **2.4 设置页** → `/settings` 页面
- [x] **2.5 购物指南页** → `/guide` 页面（4 步流程说明）
- [x] **2.6 社区推荐独立页** → `/community` 页面（来源筛选标签）
- [x] **2.7 心愿单增强** → 批量下单 + 单件购买按钮
- [x] **2.8 分享功能** → ProductCard 分享按钮（clipboard copy）
- [x] **2.9 前端卡片注册表** → `card-registry.tsx`（registerCard 模式）
- [x] **2.10 PWA 基础** → sw.js + manifest.json + layout.tsx 注册
- [x] **2.11 地址表单国际化** → `AddressForm.tsx`（按 AddressFormat 动态渲染）

#### 依赖
| 项目 | 说明 | 阻塞程度 |
|------|------|----------|
| 无外部依赖 | 全部前端开发 + 已有后端 API 对接 | 无阻塞 |

---

### Iteration 3：后端引擎（核心自动化 + 定时任务）

**目标**：异步任务框架、定时服务、基础设施上线，业务逻辑自动运转

- [ ] **3.1 BullMQ 任务队列**
  - 异步任务框架搭建
  - 队列：flylink-parse, notification, product-refresh, order-sync
  - 指数退避重试（最多 5 次）+ 死信队列 + 告警
  - 新建：`apps/server/src/lib/queue.ts`
  - 参考：TECH_DESIGN §4 (BullMQ)

- [ ] **3.2 汇率更新服务**
  - 每日 UTC 00:00 执行 7 步算法
  - 获取市场汇率 → 15日最高 → 偏差计算 → 地板价 → 更新 ProductPricing → 通知心愿单用户
  - 完善：`apps/server/src/services/exchange/exchange-rate.service.ts`
  - 参考：TECH_DESIGN §9.10.3

- [ ] **3.3 商品定时刷新**
  - 每 6 小时刷新过期商品数据（通过 FlyLink 重新解析）
  - 批量处理，每次最多 500 件
  - 参考：TECH_DESIGN §9.10.7

- [ ] **3.4 ServiceRegistry**
  - 统一注册所有业务服务
  - IService 接口：name, init(), destroy()
  - 新建：`apps/server/src/services/registry.ts`
  - 参考：TECH_DESIGN §9.10.0

- [ ] **3.5 通知触发服务**
  - 订单状态变更通知
  - 批次截止提醒（每天 18:00 UTC）
  - 心愿单价格变动通知（汇率变动 > 3%）
  - 完善：`apps/server/src/services/notification/notification.service.ts`
  - 参考：TECH_DESIGN §9.10.7

- [ ] **3.6 消息表分区**
  - messages 表按月分区（Prisma migration SQL）
  - pg_partman 自动创建分区
  - 参考：TECH_DESIGN §7.2.9

- [ ] **3.7 性能基准验证**
  - 首屏 JS < 150KB（代码分割 + dynamic import 验证）
  - FlyLink 解析耗时 ≤ 3 秒
  - AI 首字输出 ≤ 1 秒
  - Lighthouse 评分基线测量
  - 参考：PRD §4.1

#### 依赖
| 项目 | 说明 | 阻塞程度 |
|------|------|----------|
| 汇率数据源 API | 需要 CNY/USD 实时汇率 API（建议先用免费 exchangerate-api.com） | 低（可 mock） |
| FlyLink 真实凭证 | 商品刷新需真实 API 调用 | 中 |

---

### Iteration 4：支付 + 算法（交易增强 + 智能推荐）

**目标**：真实支付对接、推荐/匹配算法上线、对话历史回放、集成测试

- [ ] **4.1 真实 FlyLink 支付对接**
  - 替换 mock 支付为真实 FlyLink 支付 API
  - 支付创建 → 跳转 → Webhook 回调 → 状态同步全链路
  - 参考：TECH_DESIGN §9.10.1

- [ ] **4.2 批次推荐算法**
  - 每小时刷新，为每个用户地址推荐最优批次
  - 3 种推荐标签策略（运费最优 / 货值保障 / 货量最大）
  - 结果缓存 Redis `batch:recommend:{userId}`，TTL 1h
  - 完善：`apps/server/src/services/batch/batch-recommend.service.ts`
  - 参考：TECH_DESIGN §9.10.4

- [ ] **4.3 地址-批次匹配算法**
  - 优先级：精确邮编 → 坐标距离(5km) → 行政区域
  - PostGIS ST_DWithin 空间查询
  - 新建：`apps/server/src/services/batch/address-batch-matcher.ts`
  - 参考：TECH_DESIGN §9.10.5

- [ ] **4.4 折扣服务**
  - 代他人收货 8 折逻辑
  - 仅当用户被选为提货地址代收人时生效
  - 完善：`apps/server/src/services/discount/discount.service.ts`
  - 参考：TECH_DESIGN §9.10.6

- [ ] **4.5 对话历史回放**（Iteration 2 遗留项）
  - Sidebar 点击历史对话 → 加载消息 → 打字机效果逐条展示
  - 涉及：`Sidebar.tsx`, `ChatPage.tsx`

- [ ] **4.6 集成测试**
  - 关键路径端到端集成测试（支付/下单/状态流转）
  - 新建：`apps/server/src/__tests__/e2e-purchase-flow.test.ts`

- [ ] **4.7 汇率锁价窗口**
  - 点击"立即购买"时锁定当前 exchangeRateSnapshot，15 分钟有效
  - 支付完成写入 Order.exchangeRate，最终锁定
  - 超时刷新为最新 exchangeRateSnapshot 并提示用户
  - 参考：PRD §6.2.1

#### 依赖
| 项目 | 说明 | 阻塞程度 |
|------|------|----------|
| FlyLink 支付 API | 真实支付 endpoint + 签名密钥 | 高 |
| PostGIS 扩展 | 地址-批次匹配需要 PostgreSQL PostGIS | 低（Docker 可加） |

---

### Iteration 5：增长 + 运营工具

**目标**：社区推荐真实数据、返佣机制、Google OAuth、运营后台、多区域扩展

- [ ] **5.1 推荐系统完善**
  - 4 种推荐来源数据生成（订单历史/周边买家/平台精选/个人喜好）
  - 定时任务生成推荐数据写入 recommendations 表
  - 初期用模拟数据种子

- [ ] **5.2 社区返佣机制**
  - 分享链接生成（含 referral_code）
  - 好友通过链接注册 → 绑定 referral 关系
  - 好友下单 → 推荐人获 $2/单返佣
  - ReferralCommission 表联动
  - 参考：PRD §1.4

- [ ] **5.3 Google OAuth 真实对接**
  - 替换当前 JWT 注册/登录为 Google OAuth 真实流程
  - Google Cloud Console 配置 + callback 处理

- [ ] **5.4 运营后台 MVP**
  - 简单管理页面：查看订单/批次/用户统计
  - 意图配置管理（增删改 intent_configs）
  - `/api/admin/intents/reload` 热更新端点

- [ ] **5.5 多目的国扩展**
  - 加拿大（CA）/ 澳大利亚（AU）区域配置
  - 运费费率、币种、地址格式配置
  - ProductPricing 多区域生效

- [ ] **5.6 Redis 上下文管理优化**
  - 对话上下文热数据存 Redis（最近 50 轮）
  - 冷数据 PostgreSQL
  - Context Assembler 组装 → LLM 调用
  - 参考：TECH_DESIGN §3.3, §7.1

- [ ] **5.7 订单同步服务**
  - 每次状态变更回调 FlyLink 同步
  - 状态映射：待支付→pending, 已支付→paid, 集货中→processing, 运输中→shipped, 待提货→arrived, 已提货→delivered
  - 失败重试 5 次（5s → 30s → 2min → 10min → 1h）
  - 新建：`apps/server/src/services/order/order-sync.service.ts`
  - 参考：TECH_DESIGN §9.10.2

- [ ] **5.8 多语言 UI 基础**
  - 界面英文支持（i18n 框架搭建 + 核心页面翻译）
  - 优先：导航、商品卡片、订单状态、错误消息
  - 参考：PRD §4.2

#### 依赖
| 项目 | 说明 | 阻塞程度 |
|------|------|----------|
| 推荐种子数据 | 初期无真实订单，需模拟数据 | 低（自行生成） |
| Google OAuth | Google Cloud Console 项目 + 凭证 | 中 |
| 多区域费率 | 加拿大/澳大利亚具体费率 | 低（按 PRD 示例值） |

---

### Iteration 6：生态扩展

**目标**：买手端、售后、Push 通知、图片搜索、拼多多、社区晒单

- [ ] **6.1 买手端系统**
  - 买手注册/登录
  - 接单面板（待接单/进行中/已完成）
  - 采购清单展示
  - 完成确认 + 拍照上传

- [ ] **6.2 集采单管理**
  - PurchaseOrder 自动生成
  - 买手分配算法（按区域、负载）
  - 状态跟踪

- [ ] **6.3 售后流程**
  - 退换货申请
  - 退款处理
  - 客服对话入口

- [ ] **6.4 Push 通知**
  - FCM (Android) + APNs (iOS) 集成
  - 通知偏好设置
  - 参考：PRD §3.12

- [ ] **6.5 图片搜索**
  - 用户上传图片 → AI 识别 → 搜索相似商品
  - 需要图片识别 API

- [ ] **6.6 拼多多接入**
  - FlyLink 扩展支持拼多多链接解析

- [ ] **6.7 社区晒单**
  - 用户收货后发布晒单（图片 + 文字评价）
  - 晒单展示在商品详情页 / 社区页
  - 晒单关联 Order，完成后标记
  - 参考：PRD §8 Q5

#### 依赖
| 项目 | 说明 | 阻塞程度 |
|------|------|----------|
| 买手端形态 | 独立 Web / 内置对话功能？需决策 | 高 |
| Push 通知凭证 | Firebase 项目 + Apple Developer 账号 | 高 |
| 图片识别 API | Google Vision / 阿里云 OCR | 中 |
| 拼多多接入 | FlyLink 是否支持拼多多？ | 中 |

---

## 自主 Loop 所需依赖汇总

| 类别 | 具体内容 | 影响迭代 | 紧急度 |
|------|----------|----------|--------|
| **FlyLink 支付 API** | 真实支付 endpoint + Webhook 签名密钥 + 支付文档 | 4 | P0 |
| **汇率 API** | 汇率数据源选择（或授权用免费 API） | 3 | P1 |
| **部署环境** | 生产服务器信息（域名、SSL 证书、DNS） | 所有 | P1 |
| **Google OAuth** | Google Cloud Console 项目 + 凭证 | 5 | P2 |
| **买手端形态** | 独立应用 vs 内置功能 | 6 | P2 |
| **Push 通知** | Firebase / Apple Developer 账号 | 6 | P2 |

**最低启动需求（Iteration 3-4）**：
1. FlyLink 支付 API 是否有真实环境？没有则继续 mock 模式
2. 汇率 API 用免费的 OK？
3. 其他均可自行决定

---

## 执行顺序建议

```
Iteration 1 (完整购买闭环)  ✅ 已完成
    ↓
Iteration 2 (体验完善)      ✅ 基本完成（2.2 对话历史回放移至 Iteration 4）
    ↓
Iteration 3 (后端引擎)      ← 下一步，BullMQ + 汇率 + 商品刷新 + 通知
    ↓
Iteration 4 (支付+算法)     ← 真实支付 + 推荐算法 + 对话回放 + 集成测试
    ↓
Iteration 5 (增长运营)      ← 返佣 + OAuth + 运营后台 + 多区域
    ↓
Iteration 6 (生态扩展)      ← 买手端 + 售后 + Push + 图片搜索
```

## 下一步工作建议

1. **启动 Iteration 3 — 后端引擎**（优先级最高）
   - 3.1 BullMQ 任务队列（异步任务框架，其他服务依赖此基础）
   - 3.2 汇率更新服务（每日定时 7 步算法）
   - 3.3 商品定时刷新（每 6 小时 FlyLink 重新解析）
   - 3.4 ServiceRegistry（统一注册所有服务）
   - 3.5 通知触发服务（订单/批次/心愿单通知）
   - 3.6 消息表分区（按月分区，性能优化）

2. **技术债 / 改进项**
   - 前端购买流程 UI 联调（卡片间流转在真实对话中验证）
   - 真实 FlyLink 支付对接（替换 mock 支付，Iteration 4）
   - 集成测试覆盖关键路径（支付/下单/状态流转）
   - 前端 Docker 构建验证（确保生产模式所有功能可用）

Iteration 3 → 4 → 5 建议连续完成，构成完整的业务 + 增长闭环。
