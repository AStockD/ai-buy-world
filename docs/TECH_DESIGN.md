# AIBuyWorld — AI 原生架构技术设计文档

> 版本：v1.0  
> 日期：2026-07-21  
> 状态：初稿  
> 基于：PRD v1.0

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                  │
│   Next.js 14 (App Router) + React 18 + TailwindCSS                  │
│   SSE 流式对话渲染 · SSE 实时通知推送 · PWA 离线缓存              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────────┐
│                      API Gateway / BFF Layer                         │
│   Node.js (Fastify) · 认证鉴权 · 限流 · 请求路由                    │
│   对话网关 (SSE) · 支付网关 · 文件网关                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│ AI Agent     │  │ Business     │  │ Integration      │
│ Service      │  │ Service      │  │ Service          │
│              │  │              │  │                  │
│ · 意图识别   │  │ · 用户服务   │  │ · Flylink 适配   │
│ · 上下文管理 │  │ · 商品服务   │  │ · 支付网关       │
│ · 工具调用   │  │ · 订单服务   │  │ · 汇率服务       │
│ · 流式输出   │  │ · 集运调度   │  │ · 地理编码       │
│ · 多轮对话   │  │ · 推荐服务   │  │ · 通知推送       │
└──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
       │                 │                    │
       ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Data Layer                                     │
│  PostgreSQL (主库) · Redis (缓存/会话/限流) · S3 (图片/文件)         │
│  消息队列 (BullMQ/Redis Streams) · LLM API (OpenAI/Claude)          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、AI 原生架构的核心理念

传统架构是 "API 调用 AI"，AI 原生架构是 **AI 作为系统的主控中枢**：

| 维度 | 传统架构 | AI 原生架构 |
|------|----------|-------------|
| 入口 | REST API + 前端路由 | 对话即入口，意图驱动一切 |
| 业务逻辑 | 硬编码 if/else | Agent + Tool Calling，动态编排 |
| 状态管理 | 页面状态机 | 对话上下文 + 业务状态融合 |
| 扩展方式 | 开发新页面/接口 | 注册新 Tool，Agent 自动发现 |
| 并发模型 | 请求-响应无状态 | 有状态会话 + 异步任务流 |

---

## 三、核心模块设计

### 3.1 AI Agent 引擎（系统大脑）

```
用户消息输入
    ↓
┌─────────────────────────────────────────┐
│           AI Agent Core                  │
│                                         │
│  1. 上下文组装器                         │
│     system_prompt + user_profile +      │
│     conversation_history(50轮) +        │
│     current_message                     │
│                                         │
│  2. 意图识别 + 工具选择                  │
│     LLM Function Calling →             │
│     选择对应 Tool 执行                   │
│                                         │
│  3. Tool 执行层                          │
│     ├── flylink_parse(url)             │
│     ├── create_order(product, sku,     │
│     │   address, batch)                │
│     ├── query_orders(user_id)          │
│     ├── get_recommendations(region)    │
│     ├── calculate_shipping(weight,     │
│     │   region)                        │
│     ├── manage_wishlist(action, item)  │
│     └── confirm_address(address_id)    │
│                                         │
│  4. 响应生成 + 富卡片渲染               │
│     文本流式输出 + 结构化卡片数据       │
└─────────────────────────────────────────┘
```

**关键设计**：Agent 不是简单的聊天机器人，而是拥有业务工具的**自主执行体**。每个业务操作（解析链接、下单、查询订单）都是 Agent 可调用的 Tool。

### 3.2 多用户并发架构

```
                    ┌─────────────────┐
                    │   Load Balancer  │
                    │   (Nginx/ALB)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ API Pod 1│  │ API Pod 2│  │ API Pod N│
        │          │  │          │  │          │
        │ Sticky   │  │ Sticky   │  │ Sticky   │
        │ Session  │  │ Session  │  │ Session  │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             ▼              ▼              ▼
        ┌─────────────────────────────────────┐
        │          Redis Cluster               │
        │  · 会话状态 (conversation context)   │
        │  · 用户会话 (JWT blacklist)          │
        │  · 限流计数器 (rate limit)           │
        │  · 分布式锁 (order creation)         │
        │  · SSE 连接注册表                    │
        └─────────────────────────────────────┘
```

**并发策略**：

| 层级 | 策略 | 说明 |
|------|------|------|
| 连接层 | SSE 长连接 + 心跳 | 每个用户一个 SSE 连接，支持断线重连 |
| 会话层 | Redis 存储活跃上下文 | 对话上下文热数据存 Redis，冷数据落 PostgreSQL |
| 计算层 | LLM 调用异步化 | 流式输出，不阻塞 Worker 线程 |
| 数据层 | 读写分离 + 连接池 | PostgreSQL 主从分离，PgBouncer 连接池 |
| 缓存层 | 多级缓存 | L1 进程内 → L2 Redis → L3 PostgreSQL |

### 3.3 对话上下文管理

```
┌─────────────────────────────────────────────────────┐
│            Conversation Context Manager              │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Hot Store   │  │ Warm Store   │  │ Cold Store│  │
│  │ (Redis)     │  │ (PostgreSQL) │  │ (Archive) │  │
│  │             │  │              │  │           │  │
│  │ 最近50轮    │  │ 完整消息历史 │  │ 已归档    │  │
│  │ 活跃对话    │  │ 所有对话     │  │ 对话      │  │
│  └──────┬──────┘  └──────┬───────┘  └───────────┘  │
│         │                │                          │
│         └────────┬───────┘                          │
│                  ▼                                   │
│         Context Assembler                           │
│         组装 → LLM 调用                             │
└─────────────────────────────────────────────────────┘
```

### 3.4 Flylink 集成层

```
AIBuyWorld                    Flylink
┌────────────┐               ┌────────────┐
│ Product    │─── API ──────▶│ 商品转化    │
│ Converter  │◀── 返回 ──────│ 服务       │
└────────────┘               └────────────┘

┌────────────┐               ┌────────────┐
│ Order      │─── API ──────▶│ 订单存储    │
│ Sync       │◀── 确认 ──────│ 服务       │
└────────────┘               └────────────┘

┌────────────┐               ┌────────────┐
│ Payment    │─── 跳转 ────▶│ 支付页面    │
│ Gateway    │◀── Webhook ──│ 服务       │
└────────────┘               └────────────┘
```

---

## 四、技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| **前端** | Next.js 14 + React 18 + TailwindCSS | SSR/SSG 混合、App Router、流式渲染 |
| **API 层** | Fastify (Node.js) | 高性能、Schema 验证、插件体系 |
| **AI 引擎** | OpenAI GPT-4o / Claude | Function Calling、流式输出、多语言 |
| **数据库** | PostgreSQL 16 | JSON 支持、全文搜索、成熟稳定 |
| **缓存** | Redis 7 Cluster | 会话管理、限流、Pub/Sub 通知 |
| **消息队列** | BullMQ (Redis-based) | 异步任务（Flylink 解析、通知推送） |
| **对象存储** | S3 / Cloudflare R2 | 商品图片、用户文件 |
| **部署** | Docker + K8s / Railway | 容器化、水平扩展 |

---

## 五、性能指标设计

| 指标 | 目标 | 实现手段 |
|------|------|----------|
| AI 首字输出 | ≤ 1s | SSE 流式 + 预加载上下文 |
| Flylink 解析 | ≤ 3s | 异步队列 + 进度推送 |
| 页面加载 | ≤ 2s | Next.js ISR + CDN + 代码分割 |
| 并发用户 | 10,000+ | 水平扩展 + Redis 会话分片 |
| 对话响应 | ≤ 500ms (不含 LLM) | 热缓存 + 连接池 |

---

## 六、D1: AI Agent Tool 定义与 Prompt 工程

### 6.1 System Prompt 设计

```
你是 AIBuyWorld 的 AI 购物助手，服务海外华人的跨境购物平台。

你的职责：
- 帮助用户通过粘贴商品链接完成跨境购物
- 管理心愿单、查询订单、推荐好物
- 引导用户完成地址选择、批次加入、支付下单的全流程

行为准则：
- 用中文回复，支持中英混合输入
- 识别到商品链接时，立即调用 flylink_parse 工具
- 涉及下单/支付等敏感操作时，必须向用户确认后再执行
- 回复简洁友好，避免冗长说明
- 不确定时主动询问，不编造信息

用户信息：
- 名称：{user.name}
- 所在区域：{user.region}
- 默认地址：{user.defaultAddress.formatted}
- 心愿单商品数：{wishlist.count}
- 未读通知数：{notification.unreadCount}
```

### 6.2 Tool 定义（Function Calling Schema）

共 8 个核心 Tool，覆盖 PRD 中全部用户意图：

```json
[
  {
    "name": "flylink_parse",
    "description": "解析中国电商平台的商品链接或淘口令，返回标准化商品信息",
    "parameters": {
      "type": "object",
      "required": ["input"],
      "properties": {
        "input": {
          "type": "string",
          "description": "商品URL、短链接或淘宝口令"
        }
      }
    }
  },
  {
    "name": "select_sku",
    "description": "为商品选择规格（颜色/尺寸等），返回更新后的价格和重量",
    "parameters": {
      "type": "object",
      "required": ["productId", "skuId"],
      "properties": {
        "productId": { "type": "string" },
        "skuId": { "type": "string", "description": "选中的SKU ID" }
      }
    }
  },
  {
    "name": "create_order",
    "description": "创建订单。必须先确认地址和批次后再调用",
    "parameters": {
      "type": "object",
      "required": ["productId", "skuId", "addressId", "batchId"],
      "properties": {
        "productId": { "type": "string" },
        "skuId": { "type": "string" },
        "addressId": { "type": "string", "description": "用户选择的家庭地址ID" },
        "batchId": { "type": "string", "description": "选择的集运批次ID" },
        "willingToReceiveForOthers": {
          "type": "boolean",
          "description": "是否愿意代他人收货"
        }
      }
    }
  },
  {
    "name": "query_orders",
    "description": "查询用户订单列表，支持按状态筛选",
    "parameters": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": ["待支付","集货中","运输中","待提货","已提货","全部"],
          "description": "订单状态筛选，默认全部"
        },
        "limit": { "type": "integer", "default": 10 }
      }
    }
  },
  {
    "name": "manage_wishlist",
    "description": "管理心愿单：添加、移除、查看",
    "parameters": {
      "type": "object",
      "required": ["action"],
      "properties": {
        "action": {
          "type": "string",
          "enum": ["add", "remove", "list", "purchase_all"]
        },
        "productId": { "type": "string", "description": "add/remove时必填" }
      }
    }
  },
  {
    "name": "get_recommendations",
    "description": "获取社区好物推荐榜单",
    "parameters": {
      "type": "object",
      "properties": {
        "source": {
          "type": "string",
          "enum": ["order_history","nearby_buyers","platform","personal","all"],
          "default": "all"
        },
        "limit": { "type": "integer", "default": 8 }
      }
    }
  },
  {
    "name": "calculate_shipping",
    "description": "计算集运运费，展示费率体系",
    "parameters": {
      "type": "object",
      "properties": {
        "weightKg": { "type": "number", "description": "商品重量(kg)，不填则展示费率表" },
        "region": { "type": "string", "default": "US" },
        "category": {
          "type": "string",
          "enum": ["普通","大件","精品易碎","不可邮"],
          "default": "普通"
        }
      }
    }
  },
  {
    "name": "manage_address",
    "description": "管理用户家庭地址：查看、添加、设为默认、下单时使用新地址",
    "parameters": {
      "type": "object",
      "required": ["action"],
      "properties": {
        "action": {
          "type": "string",
          "enum": ["list", "add", "set_default", "use_new"]
        },
        "address": {
          "type": "object",
          "description": "add/use_new时必填，Address结构"
        },
        "addressId": { "type": "string", "description": "set_default时必填" }
      }
    }
  }
]
```

### 6.3 意图识别 → Tool 调用映射

```
用户输入                      Agent 识别                     调用 Tool
─────────────────────────────────────────────────────────────────────
"帮我看看这个淘宝链接"          检测到 URL/口令               → flylink_parse
  + taobao.com/口令

"帮我看看这个商品"              检测到 URL/口令               → flylink_parse
  + https://item.taobao...

"我要买这个，白色的"            上下文中有商品 + 规格意图      → select_sku

"立即购买" / "下单"            上下文中有已选商品              → (先确认地址)
                                                             → manage_address("list")
                                                             → (用户确认后)
                                                             → create_order

"查看我的订单"                  订单查询意图                   → query_orders
"我的包裹到哪了"                                               → query_orders

"看看我的心愿单"                心愿单意图                     → manage_wishlist("list")
"把这个加入心愿单"                                             → manage_wishlist("add")

"有什么好东西推荐"              推荐意图                       → get_recommendations
"最近大家都在买什么"                                           → get_recommendations

"运费怎么算"                   运费查询意图                   → calculate_shipping
"寄到美国要多少运费"                                          → calculate_shipping

"我的地址" / "添加地址"         地址管理意图                   → manage_address

"怎么买" / "购物流程"           购物指南意图                   → (无Tool，直接回复)
"怎么下单" / "如何购买"                                         → (返回4步购物流程说明卡片)

"好的" / "确认" / "用这个"       地址确认意图（状态机驱动）      → (由状态机处理)
  (在地址确认阶段)                                              → 推进到 BATCH_SELECT

"你好" / "hello"               问候意图                      → (无Tool，直接回复)
```

### 6.4 多轮对话状态机

Agent 内部维护会话状态，驱动多步下单流程：

```
IDLE ──(检测到链接)──▶ PARSING
                          │
                     flylink_parse
                          │
                          ▼
                    PRODUCT_VIEWED ──(选规格)──▶ SKU_SELECTED
                          │                          │
                     (加心愿单)                      (立即购买)
                          │                          │
                          ▼                          ▼
                     WISHLIST                   ADDRESS_CONFIRM
                                                     │
                                                确认地址
                                                     │
                                                     ▼
                                               BATCH_SELECT
                                                     │
                                                选择批次
                                                     │
                                                     ▼
                                              PAYMENT_INIT
                                                     │
                                                确认支付
                                                     │
                                                     ▼
                                               PROCESSING
```

**状态存储结构（Redis）**：

```json
{
  "conversationId": "conv_abc123",
  "userId": "user_xxx",
  "state": "SKU_SELECTED",
  "context": {
    "currentProduct": { "productId": "taobao_nike", "name": "Nike Air Force 1" },
    "selectedSku": { "skuId": "sku_001", "color": "白色", "size": "US 8" },
    "pendingAction": "confirm_address"
  },
  "updatedAt": "2026-07-21T10:30:00Z"
}
```

**状态超时规则**：

| 规则 | 值 | 说明 |
|------|-----|------|
| 会话活跃超时 | 30 分钟 | 无操作后状态自动重置为 IDLE |
| 上下文窗口 | 50 轮 | 超出后最早消息仅存储不送入 LLM |
| 支付锁价窗口 | 15 分钟 | 超时后刷新汇率，提示用户确认 |

### 6.5 富卡片响应协议

Agent 回复包含文本流 + 结构化卡片数据，前端据此渲染：

```json
{
  "type": "stream_response",
  "text": "已为您解析商品，信息如下 👇",
  "card": {
    "type": "product_card",
    "data": {
      "productId": "taobao_nike",
      "name": "Nike Air Force 1 '07",
      "imageUrl": "https://...",
      "sourcePlatform": "淘宝",
      "price": {
        "local": 71.30,
        "currency": "USD",
        "original": 499,
        "originalCurrency": "CNY"
      },
      "rating": 4.8,
      "salesCount": 2341,
      "weightKg": 0.8,
      "shippingFee": 4.00,
      "totalAmount": 75.30,
      "verifiedStatus": "passed",
      "skuVariants": { "..." : "..." }
    }
  }
}
```

**卡片类型清单**：

| 卡片类型 | 触发场景 | 关键字段 |
|----------|----------|----------|
| `product_card` | Flylink 解析完成 | 商品信息、规格选择器、价格、运费 |
| `order_card` | 订单查询/创建 | 订单号、状态、物流时间线、费用 |
| `payment_card` | 进入支付环节 | 金额、费用明细、支付方式列表 |
| `wishlist_card` | 心愿单操作 | 商品列表、数量、操作按钮 |
| `recommendation_card` | 好物推荐 | 商品网格、热度标签、来源分类 |
| `shipping_card` | 运费查询 | 费率表、计算结果、集运说明 |
| `address_card` | 地址选择/管理 | 地址列表、表单、默认标记 |
| `batch_card` | 批次推荐 | 提货地址、代收人、订单数、推荐理由 |
| `flylink_processing_card` | Flylink 解析中 | 5 步进度条（来源识别→数据抓取→多语言→AI质检→创建资产） |
| `willing_card` | 代他人收货选项 | 意愿选择（愿意/不愿意）、折扣说明（8折） |
| `success_card` | 支付成功 | 订单号、金额、预计发货时间、下一步提示 |

### 6.6 LLM 选型策略

| 角色 | 模型 | 说明 |
|------|------|------|
| **主力模型** | OpenAI GPT-4o | Function Calling 稳定、流式输出快、多语言能力强 |
| **降级模型** | Claude 3.5 Sonnet | GPT-4o 不可用时自动切换 |
| **轻量任务** | GPT-4o-mini | 简单意图识别、问候回复等低复杂度场景，降低成本 |

**降级策略**：

```
用户消息 → GPT-4o 调用
              │
              ├── 成功 → 返回结果
              │
              └── 失败/超时(>5s)
                    │
                    ▼
              Claude 3.5 Sonnet 调用
                    │
                    ├── 成功 → 返回结果
                    │
                    └── 失败 → 返回友好错误提示
```

---

## 七、D2: 数据库 Schema 详细设计

### 7.1 整体策略

```
┌──────────────────────────────────────────────────────┐
│                    PostgreSQL 16                       │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ 核心业务表 │  │ 对话消息表 │  │ 运营/统计表    │  │
│  │ (强一致)   │  │ (按时间分区)│  │ (只读副本)     │  │
│  └────────────┘  └────────────┘  └────────────────┘  │
│                                                      │
│  连接池: PgBouncer (max 200 connections)              │
│  读写分离: 主库写入, 从库查询                          │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                    Redis 7 Cluster                     │
│                                                      │
│  · 对话上下文热数据 (最近50轮)                         │
│  · 会话状态机 (conversation state)                    │
│  · 用户 Session / JWT                                 │
│  · 限流计数器                                         │
│  · 分布式锁                                           │
│  · 商品缓存 (Flylink 解析结果)                        │
└──────────────────────────────────────────────────────┘
```

**数据分层规则**：

| 数据 | 存储 | 理由 |
|------|------|------|
| 用户、订单、支付 | PostgreSQL 主库 | 强一致性、事务 |
| 商品、定价 | PostgreSQL 主库 + Redis 缓存 | 读多写少，缓存加速 |
| 对话消息 | PostgreSQL（按月分区） | 数据量大，时间维度查询 |
| 对话上下文（热） | Redis | 低延迟，频繁读写 |
| 会话状态机 | Redis | 临时数据，TTL 自动过期 |
| 推荐、通知 | PostgreSQL 从库 | 可容忍短暂延迟 |

### 7.2 核心表结构（14 张表，完整覆盖 PRD 第 6 章）

#### 7.2.1 users — 用户表 (PRD 6.7)

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20),
    avatar_url      TEXT,
    region          CHAR(2) NOT NULL DEFAULT 'US',
    willing_to_receive_for_others BOOLEAN NOT NULL DEFAULT FALSE,
    receive_for_others_count      INT NOT NULL DEFAULT 0,
    receive_for_others_rating     DECIMAL(3,2) DEFAULT NULL,
    default_address_id UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_region ON users(region);
CREATE INDEX idx_users_email ON users(email);
```

#### 7.2.2 user_addresses — 用户地址簿 (PRD 6.15)

```sql
CREATE TABLE user_addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    label           VARCHAR(50),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    country_code    CHAR(2) NOT NULL,
    recipient_name  VARCHAR(100) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    postal_code     VARCHAR(20),
    admin_area1     VARCHAR(100) NOT NULL,
    admin_area2     VARCHAR(100),
    admin_area3     VARCHAR(100),
    street_address1 VARCHAR(255) NOT NULL,
    street_address2 VARCHAR(255),
    landmark        VARCHAR(255),
    lat             DECIMAL(10,7),
    lng             DECIMAL(10,7),
    formatted       TEXT NOT NULL,
    format_version  INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX idx_user_addresses_default ON user_addresses(user_id) WHERE is_default = TRUE;
CREATE INDEX idx_user_addresses_geo ON user_addresses USING GIST(
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
) WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

#### 7.2.3 products — 商品表 (PRD 6.1)

```sql
CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flylink_product_id  VARCHAR(100) UNIQUE NOT NULL,
    flylink_url         TEXT NOT NULL,
    source_platform     VARCHAR(20) NOT NULL,
    source_url          TEXT NOT NULL,
    name                TEXT NOT NULL,
    source_price        DECIMAL(12,2) NOT NULL,
    source_currency     CHAR(3) NOT NULL DEFAULT 'CNY',
    weight_kg           DECIMAL(8,3),
    rating              DECIMAL(3,2),
    sales_count         INT DEFAULT 0,
    stock_status        VARCHAR(10) NOT NULL DEFAULT '有货',
    image_url           TEXT,
    sku_variants        JSONB,
    multi_lang_assets   JSONB,
    verified_status     VARCHAR(10) NOT NULL DEFAULT '待核验',
    raw_data            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_flylink ON products(flylink_product_id);
CREATE INDEX idx_products_source ON products(source_platform, source_url);
CREATE INDEX idx_products_verified ON products(verified_status);
```

#### 7.2.4 product_pricing — 区域定价表 (PRD 6.2)

```sql
CREATE TABLE product_pricing (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id              UUID NOT NULL REFERENCES products(id),
    region                  CHAR(2) NOT NULL,
    currency                CHAR(3) NOT NULL,
    currency_symbol         VARCHAR(5) NOT NULL,
    local_price             DECIMAL(12,2) NOT NULL,
    shipping_rate_per_kg    DECIMAL(8,2) NOT NULL,
    shipping_category       VARCHAR(20) NOT NULL DEFAULT '普通',
    estimated_shipping_fee  DECIMAL(10,2),
    exchange_rate_snapshot  DECIMAL(12,6) NOT NULL,
    exchange_rate_source    VARCHAR(20) NOT NULL,
    exchange_rate_updated_at TIMESTAMPTZ,
    markup_rate             DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    status                  VARCHAR(10) NOT NULL DEFAULT '生效',
    effective_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_product_pricing_active UNIQUE (product_id, region, status)
);

CREATE INDEX idx_pricing_product ON product_pricing(product_id, region) WHERE status = '生效';
CREATE INDEX idx_pricing_region ON product_pricing(region, status);
```

#### 7.2.5 orders — 订单表 (PRD 6.3)

```sql
CREATE TABLE orders (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no                    VARCHAR(20) UNIQUE NOT NULL,
    user_id                     UUID NOT NULL REFERENCES users(id),
    flylink_order_id            VARCHAR(100),
    flylink_payment_url         TEXT,
    product_id                  UUID NOT NULL REFERENCES products(id),
    selected_sku_id             VARCHAR(50),
    status                      VARCHAR(10) NOT NULL DEFAULT '待支付',
    product_price               DECIMAL(12,2) NOT NULL,
    shipping_fee                DECIMAL(10,2) NOT NULL,
    total_amount                DECIMAL(12,2) NOT NULL,
    currency                    CHAR(3) NOT NULL DEFAULT 'USD',
    exchange_rate               DECIMAL(12,6),
    home_address                JSONB NOT NULL,
    delivery_batch_id           UUID,
    willing_to_receive_for_others BOOLEAN NOT NULL DEFAULT FALSE,
    receiver_discount             DECIMAL(5,4) NOT NULL DEFAULT 0,
    shipping_discount_applied     BOOLEAN NOT NULL DEFAULT FALSE,
    pickup_code                 VARCHAR(10),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status) WHERE status != '已提货';
CREATE INDEX idx_orders_batch ON orders(delivery_batch_id);
CREATE INDEX idx_orders_order_no ON orders(order_no);
CREATE INDEX idx_orders_flylink ON orders(flylink_order_id) WHERE flylink_order_id IS NOT NULL;
```

**订单号生成**：`AB` + `YYMMDD` + 4位序号，由 Redis `INCR order:seq:{YYYYMMDD}` 原子递增，TTL 48h。

#### 7.2.6 delivery_batches — 集运批次表 (PRD 6.4)

```sql
CREATE TABLE delivery_batches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_no            VARCHAR(20) UNIQUE NOT NULL,
    region              CHAR(2) NOT NULL,
    area                VARCHAR(100) NOT NULL,
    pickup_address      JSONB NOT NULL,
    pickup_contact_name VARCHAR(100) NOT NULL,
    pickup_contact_phone VARCHAR(20) NOT NULL,
    pickup_user_id      UUID REFERENCES users(id),
    lat                 DECIMAL(10,7),
    lng                 DECIMAL(10,7),
    current_orders      INT NOT NULL DEFAULT 0,
    current_value       DECIMAL(14,2) NOT NULL DEFAULT 0,
    order_deadline      TIMESTAMPTZ NOT NULL,
    ship_date           TIMESTAMPTZ,
    estimated_arrival   TIMESTAMPTZ,
    status              VARCHAR(10) NOT NULL DEFAULT '集货中',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_region_status ON delivery_batches(region, status);
CREATE INDEX idx_batches_deadline ON delivery_batches(order_deadline) WHERE status = '集货中';
CREATE INDEX idx_batches_geo ON delivery_batches USING GIST(
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
) WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

#### 7.2.7 wishlists — 心愿单表 (PRD 6.5)

```sql
CREATE TABLE wishlists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    product_id  UUID NOT NULL REFERENCES products(id),
    region      CHAR(2) NOT NULL DEFAULT 'US',
    status      VARCHAR(10) NOT NULL DEFAULT '待购',
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX idx_wishlists_user ON wishlists(user_id, status);
CREATE INDEX idx_wishlists_product ON wishlists(product_id) WHERE status = '待购';
```

#### 7.2.8 conversations — 对话表 (PRD 6.8)

```sql
CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    title               VARCHAR(200),
    context_window_size INT NOT NULL DEFAULT 50,
    message_count       INT NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_conversations_active ON conversations(user_id) WHERE is_active = TRUE;
```

#### 7.2.9 messages — 消息表（按月分区）

```sql
CREATE TABLE messages (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    role            VARCHAR(10) NOT NULL,
    content         TEXT NOT NULL,
    card_data       JSONB,
    tool_calls      JSONB,
    feedback        SMALLINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 按月自动创建分区（pg_partman 管理）
CREATE TABLE messages_y2026m07 PARTITION OF messages
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE messages_y2026m08 PARTITION OF messages
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_conversation_role ON messages(conversation_id, created_at DESC)
    WHERE role = 'user';
```

#### 7.2.10 transactions — 支付交易表 (PRD 6.11)

```sql
CREATE TABLE transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_no          VARCHAR(30) UNIQUE NOT NULL,
    order_ids               UUID[] NOT NULL,
    user_id                 UUID NOT NULL REFERENCES users(id),
    payment_method          VARCHAR(20) NOT NULL,
    amount                  DECIMAL(12,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'USD',
    status                  VARCHAR(10) NOT NULL DEFAULT '待支付',
    gateway_transaction_id  VARCHAR(200),
    paid_at                 TIMESTAMPTZ,
    refunded_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_orders ON transactions USING GIN(order_ids);
CREATE INDEX idx_transactions_gateway ON transactions(gateway_transaction_id)
    WHERE gateway_transaction_id IS NOT NULL;
```

#### 7.2.11 recommendations — 推荐商品表 (PRD 6.6)

```sql
CREATE TABLE recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    source          VARCHAR(20) NOT NULL,
    region          VARCHAR(20) NOT NULL,
    hot_score       INT NOT NULL DEFAULT 0,
    hot_label       VARCHAR(100),
    rank            INT NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recommendations_source ON recommendations(source, region, rank);
CREATE INDEX idx_recommendations_period ON recommendations(period_start, period_end);
```

#### 7.2.12 notifications — 通知表 (PRD 6.13)

```sql
CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    type                VARCHAR(20) NOT NULL,
    title               VARCHAR(200) NOT NULL,
    content             TEXT NOT NULL,
    related_entity_type VARCHAR(20),
    related_entity_id   UUID,
    channel             VARCHAR(10) NOT NULL DEFAULT '对话内',
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC)
    WHERE is_read = FALSE;
```

#### 7.2.13 referral_commissions — 社区返佣表 (PRD 6.12)

```sql
CREATE TABLE referral_commissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id    UUID NOT NULL REFERENCES users(id),
    referred_user_id    UUID NOT NULL REFERENCES users(id),
    referral_code       VARCHAR(50) NOT NULL,
    triggered_order_id  UUID REFERENCES orders(id),
    commission_amount   DECIMAL(10,2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'USD',
    status              VARCHAR(10) NOT NULL DEFAULT '待结算',
    settled_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_referrer ON referral_commissions(referrer_user_id, status);
CREATE INDEX idx_referral_code ON referral_commissions(referral_code);
```

#### 7.2.14 buyers — 买手表 (PRD 6.10)

```sql
CREATE TABLE buyers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL,
    region              VARCHAR(50) NOT NULL,
    contact_phone       VARCHAR(20) NOT NULL,
    max_daily_orders    INT NOT NULL DEFAULT 50,
    current_daily_orders INT NOT NULL DEFAULT 0,
    rating              DECIMAL(3,2),
    completion_rate     DECIMAL(5,4),
    status              VARCHAR(10) NOT NULL DEFAULT '离线',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_buyers_status ON buyers(status) WHERE status = '在线';
```

#### 7.2.15 purchase_orders — 集采购单表 (PRD 6.9)

```sql
CREATE TABLE purchase_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES delivery_batches(id),
    buyer_id            UUID NOT NULL REFERENCES buyers(id),
    order_ids           UUID[] NOT NULL,
    total_source_amount DECIMAL(12,2) NOT NULL,
    status              VARCHAR(10) NOT NULL DEFAULT '待接单',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_orders_batch ON purchase_orders(batch_id);
CREATE INDEX idx_purchase_orders_buyer ON purchase_orders(buyer_id, status);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
```

#### 7.2.16 address_formats — 国家地址格式配置表 (PRD 6.15)

```sql
CREATE TABLE address_formats (
    country_code        CHAR(2) PRIMARY KEY,
    country_name        VARCHAR(100) NOT NULL,
    postal_code_format  JSONB NOT NULL,
    fields              JSONB NOT NULL,
    display_order       JSONB NOT NULL,
    admin_area1_label   VARCHAR(50),
    has_admin_area2     BOOLEAN NOT NULL DEFAULT FALSE,
    has_admin_area3     BOOLEAN NOT NULL DEFAULT FALSE,
    formatted_template  TEXT NOT NULL
);
```

### 7.3 PRD 实体覆盖校验

| PRD 章节 | 实体 | 对应表 | 状态 |
|----------|------|--------|------|
| 6.1 | Product | products | ✅ |
| 6.2 | ProductPricing | product_pricing | ✅ |
| 6.3 | Order | orders | ✅ |
| 6.4 | DeliveryBatch | delivery_batches | ✅ |
| 6.5 | Wishlist | wishlists | ✅ |
| 6.6 | Recommendation | recommendations | ✅ |
| 6.7 | User | users | ✅ |
| 6.8 | Conversation | conversations + messages | ✅ |
| 6.9 | PurchaseOrder | purchase_orders | ✅ |
| 6.10 | Buyer | buyers | ✅ |
| 6.11 | Transaction | transactions | ✅ |
| 6.12 | ReferralCommission | referral_commissions | ✅ |
| 6.13 | Notification | notifications | ✅ |
| 6.15 | AddressFormat | address_formats + user_addresses | ✅ |

### 7.4 Redis 数据结构设计

| Key 模式 | 类型 | TTL | 用途 |
|----------|------|-----|------|
| `conv:ctx:{conversationId}` | Hash | 30min | 对话上下文最近50轮 |
| `conv:state:{conversationId}` | Hash | 30min | 会话状态机 |
| `user:session:{userId}` | String | 7d | JWT Token |
| `user:addr:{userId}` | List | 1h | 用户地址簿缓存 |
| `product:cache:{productId}` | Hash | 24h | 商品信息缓存 |
| `pricing:cache:{productId}:{region}` | Hash | 24h | 区域定价缓存 |
| `order:seq:{YYYYMMDD}` | String | 48h | 订单号原子递增 |
| `rate:limit:{userId}` | String | 1min | 用户请求限流 |
| `flylink:parse:{inputHash}` | Hash | 1h | Flylink 解析结果缓存 |
| `batch:recommend:{userId}` | List | 1h | 批次推荐结果缓存 |
| `lock:order:{userId}:{productId}` | String | 30s | 下单分布式锁 |

### 7.5 分区与归档策略

```
messages 表（按月分区）
├── messages_y2026m07   ← 当前月（活跃读写）
├── messages_y2026m06   ← 上月（只读）
├── ...
└── 超过6个月 → pg_partman 自动 detach 归档

orders 表（可选按状态分区）
├── orders_active       ← 待支付/集货中/运输中/待提货
└── orders_completed    ← 已提货（冷数据）
```

### 7.6 数据量预估（1万 DAU）

| 表 | 日增量 | 月增量 | 单行大小 | 月存储 |
|----|--------|--------|----------|--------|
| messages | ~50万行 | ~1500万行 | ~500B | ~7.5GB |
| orders | ~5000行 | ~15万行 | ~1KB | ~150MB |
| products | ~2000行 | ~6万行 | ~2KB | ~120MB |
| notifications | ~2万行 | ~60万行 | ~300B | ~180MB |
| conversations | ~3000行 | ~9万行 | ~200B | ~18MB |

MVP 阶段：单主库 + 单从库 + 单 Redis 实例，总存储 < 10GB/月。

---

## 八、D3: 并发与实时通信

### 8.1 通信协议选型

```
┌─────────────────────────────────────────────────────────────────┐
│                    SSE 统一通信架构                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │   SSE 单连接多事件流                                      │    │
│  │                                                         │    │
│  │  · AI 对话流式响应 (text_delta)                          │    │
│  │  · Flylink 解析进度 (tool_call / tool_result)            │    │
│  │  · 富卡片推送 (card)                                     │    │
│  │  · 打字指示器 (typing)                                   │    │
│  │  · 订单状态推送 (order_update)                           │    │
│  │  · 通知消息推送 (notification)                           │    │
│  │  · 心愿单价格变动 (notification)                         │    │
│  │  · 批次状态变更 (notification)                           │    │
│  │                                                         │    │
│  │  方向: Server→Client (单向推送)                          │    │
│  │  协议: HTTP/1.1 EventSource                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  用户消息发送: POST /api/chat/message (标准 HTTP)               │
│  实时推送: 同一 SSE 连接复用所有事件类型                          │
└─────────────────────────────────────────────────────────────────┘
```

**选型结论**：对话流用 SSE（简单可靠），通知推送也用 SSE 扩展通道（同一连接复用），不引入 WebSocket 增加复杂度。未来若有高频双向需求再升级。

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 协议复杂度 | HTTP 子集，天然兼容 | 独立协议，需升级握手 |
| 断线重连 | 浏览器原生 `EventSource` 自动重连 | 需手动实现重连逻辑 |
| 负载均衡 | 标准 HTTP LB 直接支持 | 需 sticky session 或专用 WS 网关 |
| 适用场景 | 服务端单向推送（对话流、进度） | 双向高频通信（聊天室、游戏） |
| 本项目需求 | 对话流式输出 = 典型 SSE 场景 | 通知推送 = 低频，SSE 也够用 |

### 8.2 SSE 连接架构

```
Client                          Server                          Redis
  │                               │                               │
  │── GET /api/chat/stream ──────▶│                               │
  │   (SSE 连接建立)               │── SADD sse:connections ─────▶│
  │                               │   {userId}:{connectionId}     │
  │                               │                               │
  │◀── event: connected ─────────│                               │
  │    data: {connectionId}       │                               │
  │                               │                               │
  │── POST /api/chat/message ────▶│                               │
  │   (用户消息)                   │── 调用 LLM ──▶ streaming     │
  │                               │                               │
  │◀── event: text_delta ────────│◀── LLM stream ───────────────│
  │    data: {"text": "已为您..."} │                               │
  │                               │                               │
  │◀── event: tool_call ─────────│                               │
  │    data: {tool, status}       │                               │
  │                               │                               │
  │◀── event: tool_result ───────│                               │
  │    data: {tool, card}         │                               │
  │                               │                               │
  │◀── event: card ──────────────│                               │
  │    data: {type, data}         │                               │
  │                               │                               │
  │◀── event: done ──────────────│                               │
  │    data: {messageId}          │                               │
  │                               │                               │
  │  (30s 无数据)                  │                               │
  │◀── event: heartbeat ─────────│  ← 保活心跳                    │
```

### 8.3 SSE 事件协议定义

```typescript
type SSEEvent =
  | { event: 'connected';      data: { connectionId: string } }
  | { event: 'text_delta';     data: { text: string } }
  | { event: 'tool_call';      data: { tool: string; status: 'running' | 'done'; params?: object } }
  | { event: 'tool_result';    data: { tool: string; result: object } }
  | { event: 'card';           data: { type: CardType; data: object } }
  | { event: 'typing';         data: { show: boolean } }
  | { event: 'parse_step';    data: { step: 1|2|3|4|5; label: string; status: 'done'|'running'|'pending' } }
  | { event: 'notification';   data: { type: string; title: string; content: string; entityId?: string } }
  | { event: 'order_update';   data: { orderId: string; status: string; timeline?: object } }
  | { event: 'error';          data: { code: string; message: string } }
  | { event: 'heartbeat';      data: {} }
  | { event: 'done';           data: { messageId: string } }
```

**前端接收示例**：

```typescript
const eventSource = new EventSource('/api/chat/stream');

eventSource.addEventListener('text_delta', (e) => {
  const { text } = JSON.parse(e.data);
  appendToMessage(text);
});

eventSource.addEventListener('card', (e) => {
  const { type, data } = JSON.parse(e.data);
  renderCard(type, data);
});

eventSource.addEventListener('done', (e) => {
  finalizeMessage();
});

eventSource.onerror = () => {
  showReconnectingIndicator();
};
```

### 8.4 多用户并发模型

```
┌─────────────────────────────────────────────────────────────────┐
│                    并发处理架构                                    │
│                                                                 │
│  User A ──▶ [API Pod 1] ──▶ SSE_A ──▶ LLM stream              │
│  User B ──▶ [API Pod 1] ──▶ SSE_B ──▶ LLM stream              │
│  User C ──▶ [API Pod 2] ──▶ SSE_C ──▶ LLM stream              │
│  User D ──▶ [API Pod 2] ──▶ SSE_D ──▶ LLM stream              │
│                                                                 │
│  每个用户请求 = 1 个 SSE 连接 + 1 个异步 LLM 调用                │
│  Pod 内通过 Node.js 事件循环非阻塞处理                           │
│  LLM 调用异步化，不占用 Worker 线程                              │
└─────────────────────────────────────────────────────────────────┘
```

**单 Pod 容量估算**：

| 资源 | 限制 | 说明 |
|------|------|------|
| 内存 | 512MB / Pod | Node.js 进程 |
| SSE 连接 | ~2000 / Pod | 每个连接 ~50KB 内存 |
| LLM 并发 | ~100 / Pod | 受 LLM API rate limit 约束 |
| CPU | 1 core | 事件循环，非 CPU 密集 |

**水平扩展**：1万并发用户 → 5 个 API Pod + Redis Cluster 3 节点 + PgBouncer (max 200)

### 8.5 负载均衡策略

```
                    ┌──────────────────┐
                    │   Nginx / ALB     │
                    │                  │
                    │  /api/chat/stream│ ──▶ SSE 长连接（sticky）
                    │  /api/*          │ ──▶ 普通请求（round-robin）
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Pod 1    │  │ Pod 2    │  │ Pod 3    │
        │ SSE: 1.8k│  │ SSE: 1.9k│  │ SSE: 1.2k│
        └──────────┘  └──────────┘  └──────────┘
```

**Sticky Session 策略**：

| 方式 | 实现 | 理由 |
|------|------|------|
| SSE 连接 | Cookie-based sticky（`srv_id`） | 同一用户的 SSE 连接和消息 POST 路由到同一 Pod |
| 普通 API | Round-robin | 无状态请求，均匀分发 |
| 故障转移 | Pod 下线 → 客户端 SSE 自动重连 → 分配到新 Pod | 从 Redis 恢复对话上下文 |

### 8.6 心跳与断线重连

```
┌─────────────────────────────────────────────────────────────┐
│                    连接生命周期管理                            │
│                                                             │
│  建立连接 → 活跃状态 → 30s 无数据 → 发送心跳                  │
│  → 连续 3 次心跳无响应 (90s) → 标记断开，清理 Redis           │
│                                                             │
│  ─── 客户端侧 ───                                           │
│  连接断开 → 自动重连 (EventSource 原生)                      │
│  → 指数退避: 1s → 2s → 4s → 8s → max 30s                   │
│  → 重连成功 → 发送 lastEventId                               │
│  → 服务端检查:                                               │
│     ├── 消息仍在缓冲区 → 补发缺失事件                        │
│     └── 消息已过期 → 从 Redis 恢复上下文，继续对话            │
└─────────────────────────────────────────────────────────────┘
```

**重连恢复流程**：

```
客户端: GET /api/chat/stream?lastEventId=msg_abc123

服务端:
1. 验证用户身份 (JWT)
2. 从 Redis 加载 conv:state:{conversationId}
3. 检查 lastEventId 是否在内存缓冲区
   ├── 是 → 从断点继续推送
   └── 否 → 推送 "连接已恢复，请继续对话"
4. 重新注册 SSE 连接到 Redis
```

### 8.7 限流策略

```
┌─────────────────────────────────────────────────────────────┐
│                    多层限流架构                                │
│                                                             │
│  Layer 1: Nginx 入口限流                                     │
│  └── 每 IP 100 req/s (防 DDoS)                              │
│                                                             │
│  Layer 2: API 网关限流                                       │
│  └── 每用户 30 req/min (防滥用)                              │
│                                                             │
│  Layer 3: LLM 调用限流                                       │
│  └── 每用户 10 次对话/min (控制 LLM 成本)                    │
│  └── 全局 500 次 LLM/min (保护 API quota)                   │
│                                                             │
│  Layer 4: 业务限流                                           │
│  └── 每用户 5 次下单/min (防重复提交)                         │
│  └── Flylink 解析 20 次/min (防爬虫)                         │
└─────────────────────────────────────────────────────────────┘
```

**Redis 滑动窗口限流**：

```
Key:    rate:limit:{type}:{userId}
算法:   ZRANGEBYSCORE 获取窗口内请求数
        ZADD 记录新请求
        ZREMRANGEBYSCORE 清理过期记录

示例:   rate:limit:llm:user_abc → 10次/60s
        若 count >= 10 → 返回 429 Too Many Requests
```

### 8.8 通知推送架构

```
┌─────────────────────────────────────────────────────────────┐
│                    通知推送流程                                │
│                                                             │
│  业务事件发生 (订单状态变更 / 价格变动 / 批次提醒)             │
│     │                                                       │
│     ▼                                                       │
│  BullMQ 任务入队 (Queue: notification)                       │
│     │                                                       │
│     ▼                                                       │
│  Notification Worker 消费                                    │
│     ├── 写入 PostgreSQL (notifications 表)                   │
│     └── 写入 Redis Pub/Sub                                  │
│         Channel: notify:{userId}                            │
│     │                                                       │
│     ▼                                                       │
│  SSE 连接监听 Redis Pub/Sub                                  │
│     │                                                       │
│     ▼                                                       │
│  推送 SSE event: notification                                │
│                                                             │
│  ─── 用户离线时 ───                                          │
│  仅写入 PostgreSQL，用户上线时拉取未读通知                     │
└─────────────────────────────────────────────────────────────┘
```

### 8.9 连接注册表（Redis）

| Key | 类型 | 用途 |
|-----|------|------|
| `sse:registry:{podId}` | Hash | 记录该 Pod 上所有 SSE 连接 |
| Field: `{userId}` | - | 包含 connectionId、connectedAt、lastHeartbeat |
| TTL | Pod 生命周期 | Pod 重启时自动清理 |

**用途**：Pod 重启清理残留连接、查询用户在线状态、统计各 Pod 连接数、管理后台强制下线。

### 8.10 并发安全：分布式锁

```
场景: 用户快速双击"立即购买"

SET lock:order:{userId}:{productId} NX EX 30
├── OK → 继续创建订单
└── NIL (锁已存在) → 返回 409 "订单创建中，请勿重复提交"

订单创建完成 → DEL lock:order:{userId}:{productId}
```

### 8.11 性能基准目标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| SSE 首字节延迟 | < 50ms | 连接建立到第一个 event |
| 消息端到端延迟 | < 200ms | 用户发送到开始收到 AI 回复（不含 LLM） |
| 心跳间隔 | 30s | 无数据时发送 |
| 断线重连恢复 | < 3s | 检测到断开到重新接收数据 |
| 单 Pod 最大连接 | 2000 | 内存 < 512MB |
| 集群最大并发 | 10,000+ | 5 Pod + Redis Cluster |
| 限流判定延迟 | < 1ms | Redis 本地操作 |

---

## 九、D4: FlyLink 集成的具体 API 设计

### 9.1 环境配置管理

所有外部服务配置统一通过 `.env` 文件管理，代码中通过配置模块读取。

#### 9.1.1 .env 文件结构

```bash
# ═══════════════════════════════════════════
# AIBuyWorld 环境配置
# ═══════════════════════════════════════════

# ─── 应用基础 ───
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# ─── 数据库 ───
DATABASE_URL=postgresql://user:pass@localhost:5432/aibuyworld
DATABASE_READ_URL=postgresql://user:pass@localhost:5433/aibuyworld
DATABASE_POOL_MAX=200

# ─── Redis ───
REDIS_URL=redis://localhost:6379
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379

# ─── FlyLink 服务 ───
FLYLINK_BASE_URL=http://localhost:8000
FLYLINK_CLIENT_ID=aibuyworld_prod
FLYLINK_TIMEOUT=10000
FLYLINK_MAX_RETRIES=3

# ─── LLM 配置 ───
LLM_PROVIDER=openai
LLM_PRIMARY_MODEL=gpt-4o
LLM_FALLBACK_MODEL=claude-3-5-sonnet
LLM_LIGHTWEIGHT_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-xxx
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=4096
LLM_TIMEOUT=30000

# ─── 支付网关 ───
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx

# ─── 对象存储 ───
S3_BUCKET=aibuyworld-assets
S3_REGION=us-west-2
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
# 或使用 Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx

# ─── 地理编码 ───
GOOGLE_GEOCODING_API_KEY=xxx

# ─── 汇率数据源 ───
EXCHANGE_RATE_API_KEY=xxx
EXCHANGE_RATE_SOURCE=open_exchange_rates

# ─── JWT 认证 ───
JWT_SECRET=xxx
JWT_EXPIRES_IN=7d

# ─── 通知 ───
FCM_SERVER_KEY=xxx
```

#### 9.1.2 配置模块

```typescript
// src/config/index.ts

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // 应用
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),

  // 数据库
  DATABASE_URL: z.string(),
  DATABASE_READ_URL: z.string().optional(),
  DATABASE_POOL_MAX: z.coerce.number().default(200),

  // Redis
  REDIS_URL: z.string(),

  // FlyLink
  FLYLINK_BASE_URL: z.string().url(),
  FLYLINK_CLIENT_ID: z.string(),
  FLYLINK_TIMEOUT: z.coerce.number().default(10000),
  FLYLINK_MAX_RETRIES: z.coerce.number().default(3),

  // LLM
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'auto']).default('auto'),
  LLM_PRIMARY_MODEL: z.string().default('gpt-4o'),
  LLM_FALLBACK_MODEL: z.string().default('claude-3-5-sonnet'),
  LLM_LIGHTWEIGHT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_BASE: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_TEMPERATURE: z.coerce.number().default(0.7),
  LLM_MAX_TOKENS: z.coerce.number().default(4096),
  LLM_TIMEOUT: z.coerce.number().default(30000),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

export const config = envSchema.parse(process.env);
```

#### 9.1.3 多环境配置文件

```
项目根目录/
├── .env.example        ← 模板，提交到 git，不含真实密钥
├── .env.development    ← 本地开发配置
├── .env.staging        ← 预发布环境
├── .env.production     ← 生产环境（不入 git，通过 CI/CD 注入）
└── .gitignore          ← 忽略 .env*, 保留 .env.example
```

### 9.2 集成架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                    AIBuyWorld 集成层                              │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────────────────────┐   │
│  │ FlylinkAdapter   │    │ FlylinkAdapter                   │   │
│  │                  │    │                                  │   │
│  │ convertProduct() │    │ publishProduct()                 │   │
│  │  ↓               │    │  ↓                               │   │
│  │ POST /convert    │    │ POST /publish (SSE)              │   │
│  └────────┬─────────┘    └────────┬─────────────────────────┘   │
│           │                       │                             │
│           ▼                       ▼                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              数据映射层 (Mapper)                           │   │
│  │                                                          │   │
│  │  FlyLink Response → AIBuyWorld Product + ProductPricing  │   │
│  │  FlyLink skus[]   → Product.skuVariants                  │   │
│  │  FlyLink trans{}   → Product.multiLangAssets             │   │
│  │  FlyLink pricing{} → ProductPricing                      │   │
│  │  FlyLink publish   → Order.flylinkOrderId + paymentUrl   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│ FlyLink Service  │          │ AIBuyWorld           │
│ (config.FLYLINK_ │          │ products 表          │
│  BASE_URL)       │          │ product_pricing 表   │
└──────────────────┘          │ orders 表            │
                              └──────────────────────┘
```

### 9.3 FlyLink API 客户端封装

```typescript
// src/services/flylink/client.ts
import { config } from '../../config';

class FlylinkClient {
  private baseUrl = config.FLYLINK_BASE_URL;
  private clientId = config.FLYLINK_CLIENT_ID;
  private timeout = config.FLYLINK_TIMEOUT;

  // ─── 商品转化 ───
  async convertProduct(url: string, forceRefresh = false): Promise<FlylinkConvertResponse> {
    const res = await fetch(`${this.baseUrl}/api/product/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        force_refresh: forceRefresh,
        client_id: this.clientId,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });
    return res.json();
  }

  // ─── 发布到 FlyLink（SSE 流） ───
  async *publishProduct(
    convertResult: FlylinkConvertResponse,
    imageUrls: string[],
    options?: { categoryId?: number }
  ): AsyncGenerator<FlylinkPublishEvent> {
    const res = await fetch(`${this.baseUrl}/api/product/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        convert_result: convertResult,
        image_urls: imageUrls,
        category_id: options?.categoryId ?? null,
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          yield JSON.parse(line.slice(6));
        }
      }
    }
  }
}
```

### 9.4 数据映射：FlyLink → AIBuyWorld

#### 9.4.1 商品映射

```typescript
// src/services/flylink/mapper.ts

function mapToProduct(flylinkRes: FlylinkConvertResponse): Partial<Product> {
  return {
    flylinkProductId: String(flylinkRes.raw.item_id),
    flylinkUrl: flylinkRes.source_url,
    sourcePlatform: detectPlatform(flylinkRes.source_url),
    sourceUrl: flylinkRes.source_url,
    name: flylinkRes.raw.title,
    sourcePrice: flylinkRes.raw.price_money / 100,
    sourceCurrency: 'CNY',
    weightKg: flylinkRes.spu?.weight ?? null,
    rating: null,
    salesCount: parseSellCount(flylinkRes.raw.sell_count),
    stockStatus: inferStockStatus(flylinkRes.skus),
    imageUrl: flylinkRes.raw.images?.[0] ?? null,
    skuVariants: mapSkuVariants(flylinkRes),
    multiLangAssets: mapMultiLang(flylinkRes.trans),
    verifiedStatus: '待核验',
    rawData: flylinkRes.raw,
  };
}

function detectPlatform(url: string): string {
  if (url.includes('taobao.com') || url.includes('tb.cn')) return 'taobao';
  if (url.includes('tmall.com')) return 'tmall';
  if (url.includes('jd.com') || url.includes('j.cn')) return 'jd';
  if (url.includes('1688.com')) return '1688';
  if (url.includes('aliexpress.com')) return 'aliexpress';
  return 'unknown';
}
```

#### 9.4.2 SKU 映射

FlyLink 返回扁平 `skus[]`，转换为 PRD 定义的 `dimensions + skus` 二级结构：

```typescript
function mapSkuVariants(flylinkRes: FlylinkConvertResponse): ProductSkuVariants | null {
  const flylinkSkus = flylinkRes.skus;
  if (!flylinkSkus || flylinkSkus.length === 0) return null;

  const dimensions: SkuDimension[] = [];
  const hasColor = flylinkSkus.some(s => s.color);
  const hasSize = flylinkSkus.some(s => s.size);
  const hasBundle = flylinkSkus.some(s => s.bundle);

  if (hasColor) {
    dimensions.push({
      key: 'color', label: '颜色',
      options: [...new Set(flylinkSkus.filter(s => s.color).map(s => s.color.zh))],
    });
  }
  if (hasSize) {
    dimensions.push({
      key: 'size', label: '尺码',
      options: [...new Set(flylinkSkus.filter(s => s.size).map(s => s.size.zh))],
    });
  }
  if (hasBundle) {
    dimensions.push({
      key: 'bundle', label: '套装',
      options: [...new Set(flylinkSkus.filter(s => s.bundle).map(s => s.bundle.zh))],
    });
  }

  const basePrice = flylinkRes.pricing.cny;
  const skus: SkuItem[] = flylinkSkus.map(fs => {
    const specs: Record<string, string> = {};
    if (fs.color) specs.color = fs.color.zh;
    if (fs.size) specs.size = fs.size.zh;
    if (fs.bundle) specs.bundle = fs.bundle.zh;

    return {
      id: fs.id,
      specs,
      priceDelta: fs.cny - basePrice,
      weightKg: flylinkRes.spu?.weight ?? null,
      stock: mapStockStatus(fs.stock),
    };
  });

  return { dimensions, skus };
}
```

#### 9.4.3 定价映射

```typescript
function mapToProductPricing(
  productId: string,
  flylinkRes: FlylinkConvertResponse,
  region: string = 'US'
): Partial<ProductPricing> {
  const pricing = flylinkRes.pricing;
  return {
    productId,
    region,
    currency: pricing.currency,
    currencySymbol: getCurrencySymbol(pricing.currency),
    localPrice: pricing.usd,
    shippingRatePerKg: getShippingRate(region, '普通'),
    shippingCategory: '普通',
    estimatedShippingFee: (flylinkRes.spu?.weight ?? 0) * getShippingRate(region, '普通'),
    exchangeRateSnapshot: 1 / pricing.rate,
    exchangeRateSource: 'FlyLink',
    markupRate: 0.05,
    status: '生效',
  };
}
```

### 9.5 Agent Tool 实现：flylink_parse

```typescript
// src/agent/tools/flylink-parse.ts

const flylinkParseTool = {
  name: 'flylink_parse',
  description: '解析中国电商平台的商品链接，返回标准化商品信息',

  handler: async (params: { input: string }, context: AgentContext) => {
    const { userId, conversationId, emitSSE, userRegion } = context;

    emitSSE('tool_call', { tool: 'flylink_parse', status: 'running' });

    // 5 步解析进度（对应原型 FlylinkProcessingCard）
    emitSSE('parse_step', { step: 1, label: '来源识别', status: 'done' });

    // 调用 FlyLink 转化 API
    emitSSE('parse_step', { step: 2, label: '数据抓取', status: 'running' });
    const flylinkRes = await flylinkClient.convertProduct(params.input);
    if (!flylinkRes.success) {
      throw new ToolError('PARSE_FAILED', flylinkRes.error);
    }
    emitSSE('parse_step', { step: 2, label: '数据抓取', status: 'done' });

    emitSSE('parse_step', { step: 3, label: '多语言资产生成', status: 'running' });
    // 映射为内部 Product
    const product = await productService.upsertFromFlylink(flylinkRes);
    emitSSE('parse_step', { step: 3, label: '多语言资产生成', status: 'done' });

    emitSSE('parse_step', { step: 4, label: 'AI 质检核验', status: 'running' });
    const pricing = await pricingService.ensureForRegion(product.id, userRegion);
    emitSSE('parse_step', { step: 4, label: 'AI 质检核验', status: 'done' });

    emitSSE('parse_step', { step: 5, label: '创建可支付资产', status: 'done' });

    // 返回富卡片
    const cardData = buildProductCard(product, pricing, flylinkRes);
    emitSSE('card', { type: 'product_card', data: cardData });
    emitSSE('tool_result', { tool: 'flylink_parse', result: { productId: product.id } });

    // 更新会话状态
    await conversationState.update(conversationId, {
      state: 'PRODUCT_VIEWED',
      context: {
        currentProduct: { productId: product.id, name: product.name },
        selectedSku: null,
      },
    });

    return { productId: product.id };
  },
};
```

### 9.6 发布流程

```
用户确认下单
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  1. 检查商品是否已发布到 FlyLink                               │
│     ├── 已发布 → 直接使用 flylinkProductId + flylinkUrl       │
│     └── 未发布 → 进入发布流程                                  │
│                                                              │
│  2. 发布流程 (POST /api/product/publish, SSE 流)              │
│     ├── login → 登录 Flylink                                 │
│     ├── upload_start → 开始上传图片                           │
│     ├── image_done × N → 逐张上传完成                        │
│     ├── creating → 创建商品中                                │
│     └── done → 获得 product_id                               │
│                                                              │
│  3. 存储映射                                                  │
│     Product.flylinkProductId = publish_result.product_id      │
│     Product.flylinkUrl = https://flylink.com/product/{id}    │
│                                                              │
│  4. 创建订单                                                  │
│     Order.flylinkOrderId = flylinkProductId                   │
│     Order.flylinkPaymentUrl = 生成的支付链接                  │
└──────────────────────────────────────────────────────────────┘
```

### 9.7 错误处理与重试策略

```typescript
enum FlylinkErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_URL = 'INVALID_URL',
  PRODUCT_UNAVAILABLE = 'PRODUCT_UNAVAILABLE',
  PUBLISH_FAILED = 'PUBLISH_FAILED',
}

const RETRY_CONFIG = {
  NETWORK_ERROR:      { maxRetries: 3, backoff: 'exponential', baseDelay: 1000 },
  TIMEOUT:            { maxRetries: 2, backoff: 'exponential', baseDelay: 2000 },
  RATE_LIMITED:       { maxRetries: 3, backoff: 'fixed', baseDelay: 3000 },
  QUOTA_EXCEEDED:     { maxRetries: 0 },
  INVALID_URL:         { maxRetries: 0 },
  PRODUCT_UNAVAILABLE: { maxRetries: 0 },
  PUBLISH_FAILED:     { maxRetries: 1, backoff: 'fixed', baseDelay: 5000 },
};
```

**用户友好错误消息**：

| FlyLink 错误 | 用户看到的消息 |
|-------------|--------------|
| `QUOTA_EXCEEDED` | "服务暂时繁忙，请稍后再试" |
| `RATE_LIMITED` | "请求处理中，请稍候..." |
| `INVALID_URL` | "无法识别该链接，请确认是淘宝/天猫/京东的商品链接" |
| `PRODUCT_UNAVAILABLE` | "该商品可能已下架或失效，请确认链接是否有效" |
| `PUBLISH_FAILED` | "商品发布失败，正在重试..." |
| `TIMEOUT` (重试耗尽) | "商品解析超时，请稍后重试" |

### 9.8 缓存策略

```
┌─────────────────────────────────────────────────────────────────┐
│                    三级缓存架构                                    │
│                                                                 │
│  L1: FlyLink 自带缓存                                           │
│  └── 同商品 ~20ms 返回，无需我们处理                             │
│                                                                 │
│  L2: Redis 缓存 (AIBuyWorld 侧)                                │
│  └── Key: flylink:parse:{sourceUrlHash}                         │
│  └── TTL: 1h                                                    │
│  └── 缓存映射后的 Product 对象，省去映射计算                     │
│                                                                 │
│  L3: PostgreSQL (products 表)                                   │
│  └── 持久存储，FlyLink 数据的本地投影                            │
│  └── 查询: WHERE source_url = ? 或 flylink_product_id = ?       │
│                                                                 │
│  查询流程:                                                      │
│  URL → L3 (DB) → 命中返回                                      │
│              → 未命中 → L2 (Redis) → 命中 → 更新 L3 返回        │
│                                   → 未命中 → FlyLink API        │
│                                              → 写入 L2 + L3     │
└─────────────────────────────────────────────────────────────────┘
```

### 9.9 FlyLink 与 AIBuyWorld API 对照

| 场景 | FlyLink API | AIBuyWorld 封装 | 说明 |
|------|-------------|-----------------|------|
| 商品解析 | `POST /api/product/convert` | `flylink_parse` Tool | Agent 直接调用 |
| 商品发布 | `POST /api/product/publish` (SSE) | `ensurePublished()` | 下单前自动触发 |
| 缓存命中 | FlyLink 内部 ~20ms | L3 DB → L2 Redis → FlyLink | 三级缓存 |
| 多语言 | `trans` 字段 (en/es/fr/pt) | `Product.multiLangAssets` | 直接映射 |
| SKU 矩阵 | `skus[]` 扁平数组 | `Product.skuVariants` (dimensions+skus) | 结构转换 |
| 定价 | `pricing` (cny/usd/rate) | `ProductPricing` (含运费、加价) | 扩展计算 |
| 错误处理 | `success: false` + `error` | 分级重试 + 用户友好消息 | 智能容错 |

### 9.10 核心业务服务设计

#### 9.10.1 FlyLink Webhook 接收端点

FlyLink 支付完成后通过 Webhook 通知 AIBuyWorld：

```typescript
// src/api/webhooks/flylink.ts

app.post('/api/webhooks/flylink', async (req, reply) => {
  const { event, data } = req.body;
  
  // 1. 验证签名
  const isValid = verifyWebhookSignature(req.headers['x-flylink-signature'], req.body);
  if (!isValid) return reply.code(401).send({ error: 'Invalid signature' });

  switch (event) {
    case 'payment.completed':
      await handlePaymentCompleted(data);
      break;
    case 'payment.failed':
      await handlePaymentFailed(data);
      break;
    default:
      return reply.code(200).send({ received: true });
  }

  return reply.code(200).send({ received: true });
});

async function handlePaymentCompleted(data: { order_id: string; transaction_id: string; amount: number }) {
  // 1. 更新本地订单状态
  await db.orders.update(
    { flylink_order_id: data.order_id },
    { status: '已支付', updated_at: new Date() }
  );

  // 2. 更新交易记录
  await db.transactions.update(
    { gateway_transaction_id: data.transaction_id },
    { status: '已支付', paid_at: new Date() }
  );

  // 3. 回调 FlyLink 同步状态
  await flylinkClient.syncOrderStatus(data.order_id, '已支付');

  // 4. 触发后续流程：分配批次 + 调度买手
  await notificationQueue.add('order-paid', { orderId: data.order_id });

  // 5. 推送 SSE 通知前端
  await pushToUser(userId, { event: 'order_update', data: { orderId, status: '已支付' } });
}
```

**Webhook 重试处理**：FlyLink 失败后会重试 3 次（间隔 1min/5min/30min）。端点需幂等处理——通过 `flylink_order_id` + `status` 去重。

#### 9.10.2 订单状态回调 FlyLink

PRD 要求每个状态变更都需回调 FlyLink 同步：

```typescript
// src/services/order-sync.ts

class OrderSyncService {
  /**
   * 每次状态变更时调用，同步到 FlyLink
   */
  async syncStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
    const order = await db.orders.findById(orderId);
    if (!order.flylink_order_id) return; // 未同步到 FlyLink 的订单跳过

    try {
      await flylinkClient.updateOrder(order.flylink_order_id, {
        status: mapToFlylinkStatus(newStatus),
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      // 回调失败不阻塞主流程，入队重试
      await syncRetryQueue.add('order-sync', {
        orderId, newStatus, attempt: 1,
      }, { delay: 5000 });
    }
  }
}

// 状态映射
function mapToFlylinkStatus(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    '待支付': 'pending',
    '已支付': 'paid',
    '集货中': 'processing',
    '运输中': 'shipped',
    '待提货': 'arrived',
    '已提货': 'delivered',
  };
  return map[status] || 'unknown';
}
```

**重试策略**：指数退避，最多 5 次（5s → 30s → 2min → 10min → 1h），最终失败记录到 `sync_failures` 表并告警。

#### 9.10.3 汇率更新服务

PRD 6.2.1 定义的 7 步汇率算法，由定时任务执行：

```typescript
// src/workers/exchange-rate-worker.ts
// 调度: 每天 UTC 00:00 (北京时间 08:00)

async function updateExchangeRates() {
  // Step 1: 获取当前市场汇率
  const currentRate = await fetchExchangeRate('CNY', 'USD');

  // Step 2: 获取过去 15 天每日最高汇率
  const last15DaysHigh = await fetch15DayHighRate('CNY', 'USD');

  // Step 3: 选择对用户最优的汇率
  //   对用户有利 = 1 USD 能换更多 CNY = 商品更便宜
  const bestRate = Math.max(currentRate, last15DaysHigh);

  // Step 4: 计算偏差率
  const deviation = Math.abs(bestRate - currentRate) / currentRate;

  // Step 5: 偏差 > 5% 时设置地板价
  const effectiveRate = deviation > 0.05
    ? currentRate * 1.05  // 当前汇率 + 5% 作为上限
    : bestRate;

  // Step 6: 更新所有生效的 ProductPricing
  const pricingRecords = await db.product_pricing.findMany({ status: '生效' });
  
  for (const pricing of pricingRecords) {
    const oldRate = pricing.exchange_rate_snapshot;
    const rateChange = Math.abs(effectiveRate - oldRate) / oldRate;

    // 更新定价
    await db.product_pricing.update(pricing.id, {
      exchange_rate_snapshot: effectiveRate,
      exchange_rate_updated_at: new Date(),
      local_price: recalculateLocalPrice(pricing, effectiveRate),
    });

    // Step 7: 价格变动 > 3% → 通知心愿单用户
    if (rateChange > 0.03) {
      await notifyWishlistUsers(pricing.product_id, rateChange, effectiveRate);
    }
  }

  // 缓存更新
  await redis.set('exchange:rate:current', JSON.stringify({
    rate: effectiveRate, source: deviation > 0.05 ? '当前+5%' : '15日最高',
    updated_at: new Date().toISOString(),
  }));
}

async function notifyWishlistUsers(productId: string, rateChange: number, newRate: number) {
  const wishlistUsers = await db.wishlists.findMany({
    product_id: productId, status: '待购',
  });

  for (const item of wishlistUsers) {
    await notificationQueue.add('price-change', {
      userId: item.user_id,
      productId,
      changePercent: (rateChange * 100).toFixed(1),
      direction: rateChange > 0 ? '上涨' : '下降',
    });
  }
}
```

**Cron 配置**：`0 0 * * *`（每天 UTC 00:00），BullMQ repeatable job。

#### 9.10.4 批次推荐算法

每小时刷新，为每个用户地址推荐最优批次：

```typescript
// src/services/batch-recommend.ts

async function recommendBatches(userAddress: UserAddress, limit = 3): Promise<BatchRecommendation[]> {
  // 1. 查找用户地址附近的活跃批次
  const nearbyBatches = await db.delivery_batches.findMany({
    where: {
      status: '集货中',
      order_deadline: { gt: new Date() },
      // 同 admin_area2 (城市级) 优先
      OR: [
        { area: { contains: userAddress.adminArea2 } },
        // 同 postal_code 前 3 位
        { lat: { between: [userAddress.lat - 0.1, userAddress.lat + 0.1] } },
      ],
    },
  });

  // 2. 为每个批次计算推荐标签
  const scored = nearbyBatches.map(batch => ({
    batch,
    score: calculateBatchScore(batch),
    label: generateRecommendLabel(batch),
  }));

  // 3. 按策略排序，返回 Top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ batch, label }) => ({
      batchId: batch.id,
      area: batch.area,
      pickupContactName: batch.pickup_contact_name,
      currentOrders: batch.current_orders,
      currentValue: batch.current_value,
      shipDate: batch.ship_date,
      estimatedArrival: batch.estimated_arrival,
      recommendLabel: label,
    }));
}

function generateRecommendLabel(batch: DeliveryBatch): string {
  // 三种推荐策略
  if (batch.current_orders >= 15) {
    return `与本周 ${batch.current_orders} 件订单同批次 · 运费最优`;
  }
  if (batch.current_value >= 2000) {
    return `本批次货值最高 $${batch.current_value.toLocaleString()} · 优先配送`;
  }
  return `本周货量最大 ${batch.current_orders} 件 · 单件运费最低`;
}
```

**刷新频率**：每小时执行一次，结果缓存到 Redis `batch:recommend:{userId}`，TTL 1h。

#### 9.10.5 地址-批次匹配算法

PRD 6.15.6 定义的匹配优先级：

```typescript
// src/services/address-batch-matcher.ts

async function matchBatch(address: UserAddress): Promise<DeliveryBatch | null> {
  // 优先级 1: 精确邮编匹配
  if (address.postalCode) {
    const match = await db.delivery_batches.findFirst({
      where: {
        status: '集货中',
        pickup_address: { path: ['postal_code'], equals: address.postalCode },
      },
    });
    if (match) return match;
  }

  // 优先级 2: 坐标距离匹配 (5km 内)
  if (address.lat && address.lng) {
    const match = await db.query(`
      SELECT * FROM delivery_batches
      WHERE status = '集货中'
        AND lat IS NOT NULL AND lng IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          5000
        )
      ORDER BY current_orders DESC
      LIMIT 1
    `, [address.lng, address.lat]);
    if (match) return match;
  }

  // 优先级 3: 行政区域匹配 (admin_area2 = 城市)
  const match = await db.delivery_batches.findFirst({
    where: {
      status: '集货中',
      area: { contains: address.adminArea2 },
    },
    orderBy: { current_orders: 'desc' },
  });
  return match;
}
```

#### 9.10.6 "代他人收货" 折扣机制

```typescript
// src/services/discount.ts

const RECEIVER_DISCOUNT_RATE = 0.80; // 8 折

function calculateShippingDiscount(
  originalShippingFee: number,
  willingToReceiveForOthers: boolean,
  userIsSelectedAsPickup: boolean,
): { discount: number; finalFee: number } {
  // 仅当用户被系统选为提货地址的代收人时才享受折扣
  if (!willingToReceiveForOthers || !userIsSelectedAsPickup) {
    return { discount: 0, finalFee: originalShippingFee };
  }

  const discount = originalShippingFee * (1 - RECEIVER_DISCOUNT_RATE);
  return {
    discount: Math.round(discount * 100) / 100,
    finalFee: Math.round(originalShippingFee * RECEIVER_DISCOUNT_RATE * 100) / 100,
  };
}
```

**注意**：折扣不是下单时立即生效，而是当用户的地址被系统选为某批次的提货地址后，该用户后续订单自动享受运费 8 折。

#### 9.10.7 通知触发服务

```typescript
// src/workers/notification-triggers.ts

// ─── 批次截止提醒 (每天 18:00 UTC) ───
// Cron: 0 18 * * 0-5 (周日至周五)
async function batchDeadlineReminder() {
  const tomorrowBatches = await db.delivery_batches.findMany({
    where: {
      status: '集货中',
      order_deadline: { between: [new Date(), addHours(new Date(), 24)] },
    },
  });

  for (const batch of tomorrowBatches) {
    const orders = await db.orders.findMany({ delivery_batch_id: batch.id });
    const userIds = [...new Set(orders.map(o => o.user_id))];

    for (const userId of userIds) {
      await notificationQueue.add('batch-deadline', {
        userId,
        batchId: batch.id,
        deadline: batch.order_deadline,
      });
    }
  }
}

// ─── 心愿单价格变动通知 ───
// 由汇率更新服务 (9.10.3) 触发，写入 notification 表 + SSE 推送

// ─── 商品数据定期刷新 ───
// Cron: 0 */6 * * * (每 6 小时)
async function refreshProductData() {
  const staleProducts = await db.products.findMany({
    where: { updated_at: { lt: subHours(new Date(), 24) } },
    take: 500,
  });

  for (const product of staleProducts) {
    await productRefreshQueue.add('refresh', {
      productId: product.id,
      sourceUrl: product.source_url,
    });
  }
}
```

---

## 十、D5: 部署架构与 CI/CD（自托管方案）

### 10.1 整体部署架构

```
┌─────────────────────────────────────────────────────────────────────┐
│              单台云服务器 (Ubuntu 22.04, 美西机房)                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Nginx (反向代理 + SSL 终止 + 静态资源)                      │    │
│  │  :80 → :443  │  SSE 长连接支持  │  限流                      │    │
│  └──────────────────────┬──────────────────────────────────────┘    │
│                         │                                           │
│  ┌──────────────────────┼──────────────────────────────────────┐    │
│  │              Docker Compose 容器编排                          │    │
│  │                      │                                       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │  │ web      │  │ web      │  │ worker   │  │ worker   │   │    │
│  │  │ (API)    │  │ (API)    │  │ (BullMQ) │  │ (BullMQ) │   │    │
│  │  │ 512MB    │  │ 512MB    │  │ 256MB    │  │ 256MB    │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │    │
│  │                                                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │    │
│  │  │ PostgreSQL 16│  │ Redis 7      │  │ FlyLink Service  │  │    │
│  │  │ 2GB RAM      │  │ 512MB        │  │ (如果自部署)      │  │    │
│  │  │ 50GB SSD     │  │              │  │                  │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  外部服务:                                                           │
│  ├── OpenAI API (LLM)                                               │
│  ├── Cloudflare R2 / AWS S3 (对象存储)                               │
│  └── Cloudflare (CDN + DNS + DDoS 防护)                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.2 服务器配置

| 配置项 | MVP 阶段 | V1.0 阶段 |
|--------|----------|-----------|
| CPU | 4 核 | 8 核 |
| 内存 | 8GB | 16GB |
| 磁盘 | 80GB SSD | 200GB NVMe |
| 带宽 | 1Gbps | 1Gbps |
| 位置 | 美西 (LA/SJ) | 美西 |
| 系统 | Ubuntu 22.04 | Ubuntu 22.04 |

### 10.3 Docker Compose 编排

```yaml
# docker-compose.yml

services:
  # ─── Nginx 反向代理 ───
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - web
    restart: always
    networks:
      - frontend

  # ─── Web 服务 (Next.js + Fastify API) ───
  web:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
    restart: always
    networks:
      - frontend
      - backend

  # ─── Worker (BullMQ 消费者) ───
  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: ["node", "dist/worker/index.js"]
    environment:
      - NODE_ENV=production
    env_file: .env
    depends_on:
      redis:
        condition: service_healthy
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 256M
    restart: always
    networks:
      - backend

  # ─── PostgreSQL ───
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: aibuyworld
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 2G
    restart: always
    networks:
      - backend

  # ─── Redis ───
  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
    restart: always
    networks:
      - backend

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
```

### 10.4 Dockerfile（多阶段构建）

```dockerfile
# ─── Stage 1: 安装依赖 ───
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod=false

# ─── Stage 2: 构建 ───
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

# ─── Stage 3: 生产运行 ───
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server/index.js"]
```

### 10.5 Nginx 配置

```nginx
# nginx/conf.d/aibuyworld.conf

upstream web_backend {
    server web:3000;
}

# HTTP → HTTPS
server {
    listen 80;
    server_name aibuyworld.com www.aibuyworld.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name aibuyworld.com www.aibuyworld.com;

    ssl_certificate /etc/letsencrypt/live/aibuyworld.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aibuyworld.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # SSE 对话流
    location /api/chat/stream {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 普通 API
    location /api/ {
        proxy_pass http://web_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        limit_req zone=api burst=20 nodelay;
    }

    # 前端
    location / {
        proxy_pass http://web_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
```

### 10.6 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

  deploy:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/aibuyworld
            bash scripts/deploy.sh
```

### 10.7 部署脚本

```bash
#!/bin/bash
# scripts/deploy.sh

set -e
DEPLOY_DIR="/opt/aibuyworld"
BACKUP_DIR="/opt/backups"

echo "=== AIBuyWorld 部署开始 ==="

# 1. 拉取代码
cd $DEPLOY_DIR
git pull origin main

# 2. 备份数据库
echo ">>> 备份数据库..."
docker compose exec -T postgres pg_dump -U ${DB_USER} aibuyworld | \
  gzip > ${BACKUP_DIR}/db_$(date +%Y%m%d_%H%M%S).sql.gz

# 3. 数据库迁移
echo ">>> 数据库迁移..."
docker compose run --rm web node dist/db/migrate.js

# 4. 构建新镜像
echo ">>> 构建镜像..."
docker compose build --no-cache web worker

# 5. 滚动更新
echo ">>> 滚动更新..."
docker compose up -d --scale web=2 --scale worker=2 --remove-orphans

# 6. 健康检查
echo ">>> 健康检查..."
sleep 10
for i in $(seq 1 5); do
  if curl -sf http://localhost/api/health > /dev/null; then
    echo ">>> 部署成功"
    exit 0
  fi
  sleep 3
done

echo ">>> 健康检查失败，请手动检查"
exit 1
```

### 10.8 备份策略

```bash
#!/bin/bash
# scripts/backup.sh
# crontab: 0 3 * * * /opt/aibuyworld/scripts/backup.sh

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d)
RETENTION_DAYS=30

# PostgreSQL 全量备份
docker compose exec -T postgres pg_dump -U ${DB_USER} aibuyworld | \
  gzip > ${BACKUP_DIR}/pg_${DATE}.sql.gz

# Redis RDB 快照
cp /var/lib/docker/volumes/aibuyworld_redisdata/_data/dump.rdb \
   ${BACKUP_DIR}/redis_${DATE}.rdb

# .env 配置备份
cp /opt/aibuyworld/.env ${BACKUP_DIR}/env_${DATE}.bak

# 清理过期备份
find ${BACKUP_DIR} -type f -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup completed"
```

### 10.9 监控与告警

| 监控项 | 工具 | 告警方式 |
|--------|------|----------|
| 服务存活 | Uptime Kuma (Docker) | Telegram / 邮件 |
| SSL 到期 | Uptime Kuma | 提前 14 天告警 |
| 磁盘使用 | crontab 脚本 | > 85% 告警 |
| 内存使用 | `docker stats` | > 80% 告警 |
| 数据库连接 | pg_stat | > 80% 连接池告警 |
| 应用错误 | `docker logs` | 关键词告警 |

### 10.10 服务器初始化

```bash
# 新服务器首次配置

# 系统更新
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# 基础工具
apt install -y git curl wget htop fail2ban ufw certbot

# 防火墙
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 部署目录
mkdir -p /opt/aibuyworld /opt/backups
git clone <repo> /opt/aibuyworld
cp /opt/aibuyworld/.env.example /opt/aibuyworld/.env

# 启动
cd /opt/aibuyworld
docker compose up -d

# SSL
bash scripts/setup-ssl.sh

# 定时任务
crontab -e
# 0 3 * * * /opt/aibuyworld/scripts/backup.sh
# 0 3 * * * certbot renew --quiet --deploy-hook "cd /opt/aibuyworld && docker compose exec nginx nginx -s reload"
```

---

## 十一、D6: 前端架构（移动端优先）

### 11.1 技术选型

| 层面 | 选择 | 理由 |
|------|------|------|
| 框架 | **Next.js 14 (App Router)** | SSR/SSG、PWA 支持、API Routes 复用 |
| UI 库 | **React 18** | 并发特性优化流式渲染 |
| 样式 | **Tailwind CSS + CSS Variables** | mobile-first 断点体系，原型 CSS 变量直接复用 |
| 状态管理 | **Zustand** | 轻量（<1KB）、无 Provider、多 Store 分离 |
| 服务端状态 | **TanStack Query v5** | SSE 数据缓存、自动重试、乐观更新 |
| 流式渲染 | **原生 EventSource + 自定义 Hook** | 配合后端 SSE 协议 |
| PWA | **next-pwa** | 离线缓存、添加到主屏幕、推送通知 |
| 手势 | **@use-gesture/react** | 滑动删除对话、下拉刷新、左滑操作 |

### 11.2 页面布局（Mobile-First）

```
┌─────────────────────────┐
│  状态栏 (系统)            │
├─────────────────────────┤
│  ┌───────────────────┐  │
│  │ 顶部导航栏 (48px)  │  │  ← 品牌 Logo / 当前对话标题 / 操作按钮
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │                   │  │
│  │   消息流区域       │  │  ← 虚拟滚动，自动滚底
│  │   (flex: 1)       │  │
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  ┌───────────────────┐  │
│  │  输入区            │  │  ← 固定底部，键盘弹起时上推
│  │  [快捷标签] [输入] │  │
│  └───────────────────┘  │
├─────────────────────────┤
│  底部 Tab 栏 (56px)     │  ← 对话 / 订单 / 心愿单 / 我的
│  💬  📦  ❤️  👤        │
└─────────────────────────┘
```

**关键原则**：
- 设计基准 **375px**（iPhone SE），向上适配到 428px（Pro Max）
- 安全区域：顶部 `env(safe-area-inset-top)`，底部 `env(safe-area-inset-bottom)`
- 无侧边栏 — 对话历史通过左滑手势或顶部按钮进入抽屉
- 底部 Tab 栏在键盘弹起时隐藏，输入区贴键盘底部

### 11.3 目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/                   # 主布局（含底部 Tab）
│   │   ├── layout.tsx            # Tab 栏 + 安全区域
│   │   ├── page.tsx              # 首页 = 对话页
│   │   ├── orders/
│   │   │   ├── page.tsx          # 订单列表
│   │   │   └── [orderId]/page.tsx
│   │   ├── wishlist/page.tsx
│   │   └── profile/
│   │       ├── page.tsx          # 个人中心
│   │       ├── settings/page.tsx # 设置页
│   │       └── addresses/page.tsx # 地址管理
│   ├── chat/
│   │   └── [conversationId]/page.tsx
│   └── api/                      # API Routes (BFF)
│       ├── chat/stream/
│       ├── orders/
│       ├── wishlist/
│       └── flylink/
│
├── components/
│   ├── layout/
│   │   ├── BottomTabs.tsx        # 底部 Tab 导航
│   │   ├── TopBar.tsx            # 顶部导航栏
│   │   ├── SafeArea.tsx          # 安全区域适配
│   │   └── Drawer.tsx            # 侧滑抽屉（对话历史）
│   ├── chat/
│   │   ├── MessageList.tsx       # 消息列表（虚拟滚动）
│   │   ├── MessageBubble.tsx     # 消息气泡
│   │   ├── UserMessage.tsx
│   │   ├── AiMessage.tsx         # AI 消息（流式渲染）
│   │   ├── TypingIndicator.tsx
│   │   ├── InputArea.tsx         # 输入区（含键盘适配）
│   │   ├── QuickTags.tsx         # 横向滚动快捷标签
│   │   └── ScrollToBottom.tsx    # "回到底部" 浮动按钮
│   ├── cards/                    # 富卡片（移动端宽度自适应）
│   │   ├── ProductCard.tsx
│   │   ├── SkuSelector.tsx       # 底部弹出式规格选择
│   │   ├── OrderCard.tsx
│   │   ├── PaymentCard.tsx
│   │   ├── WishlistCard.tsx
│   │   ├── RecommendationCard.tsx # 2×2 网格，单列可滑动
│   │   ├── AddressCard.tsx
│   │   ├── BatchCard.tsx
│   │   ├── ShippingCard.tsx
│   │   ├── FlylinkProcessingCard.tsx # 5步解析进度条
│   │   ├── WillingCard.tsx       # 代他人收货选项
│   │   └── SuccessCard.tsx       # 支付成功卡片
│   ├── welcome/
│   │   ├── WelcomeScreen.tsx     # 竖排卡片
│   │   └── QuickEntryCard.tsx
│   └── common/
│       ├── Avatar.tsx
│       ├── Badge.tsx
│       ├── Timeline.tsx          # 竖向物流时间线
│       ├── StatusPill.tsx
│       ├── BottomSheet.tsx       # 底部弹出面板
│       └── PullToRefresh.tsx     # 下拉刷新
│
├── stores/
│   ├── chatStore.ts              # 对话状态（消息列表、输入状态）
│   ├── sessionStore.ts           # 会话状态机（当前流程阶段）
│   ├── tabStore.ts               # 底部 Tab 状态
│   └── userStore.ts              # 用户信息 + 地址簿
│
├── hooks/
│   ├── useSSE.ts                 # SSE 连接管理
│   ├── useStreamMessage.ts       # 流式消息处理
│   ├── useAutoScroll.ts          # 自动滚动
│   ├── useVirtualList.ts         # 虚拟滚动
│   ├── useKeyboardHeight.ts      # 键盘高度监听
│   ├── usePullToRefresh.ts       # 下拉刷新
│   └── useSwipeActions.ts        # 滑动手势
│
├── lib/
│   ├── api-client.ts             # HTTP 客户端
│   ├── sse-parser.ts             # SSE 事件解析器
│   ├── card-registry.ts          # 卡片类型注册表
│   └── format.ts                 # 格式化工具
│
└── types/
    ├── message.ts                # 消息类型定义
    ├── card.ts                   # 卡片类型定义
    └── api.ts                    # API 请求/响应类型
```

### 11.4 状态管理架构

采用 **多 Store 分离** 模式，每个 Store 职责单一：

```typescript
// stores/chatStore.ts — 对话核心状态
interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  currentStreamId: string | null;
  
  addMessage: (msg: Message) => void;
  appendToken: (id: string, token: string) => void;
  updateCard: (id: string, cardData: CardPayload) => void;
  clearMessages: () => void;
}

// stores/sessionStore.ts — 会话状态机
interface SessionState {
  phase: SessionPhase;  // IDLE | PARSING | PRODUCT_VIEWED | SKU_SELECTED | ...
  currentProduct: Product | null;
  selectedSku: Sku | null;
  selectedAddress: Address | null;
  selectedBatch: Batch | null;
  
  setPhase: (phase: SessionPhase) => void;
  reset: () => void;
}

// stores/tabStore.ts — 底部 Tab
interface TabState {
  activeTab: 'chat' | 'orders' | 'wishlist' | 'profile';
  setTab: (tab: TabState['activeTab']) => void;
}

// stores/userStore.ts — 用户信息
interface UserState {
  user: User | null;
  addresses: Address[];
  defaultAddress: Address | null;
}
```

**数据流**：

```
SSE Event → useSSE Hook → sse-parser → 分发到对应 Store
                                          │
                            ┌─────────────┼─────────────┐
                            ▼             ▼             ▼
                       chatStore     sessionStore    tabStore
                       (消息列表)     (流程阶段)     (Tab 状态)
                            │
                            ▼
                     React 组件自动重渲染
```

### 11.5 流式渲染方案

```typescript
// hooks/useStreamMessage.ts

export function useStreamMessage(conversationId: string) {
  const addMessage = useChatStore(s => s.addMessage);
  const appendToken = useChatStore(s => s.appendToken);
  const updateCard = useChatStore(s => s.updateCard);
  const setPhase = useSessionStore(s => s.setPhase);

  const onEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'text_delta':
        appendToken(event.messageId, event.content);
        break;
      case 'card':
        updateCard(event.messageId, event.card);
        break;
      case 'phase_change':
        setPhase(event.phase);
        break;
      case 'typing_start':
        addMessage({ id: event.messageId, role: 'assistant', content: '', status: 'streaming' });
        break;
      case 'typing_end':
        break;
      case 'error':
        addMessage({ id: event.messageId, role: 'system', content: event.message, status: 'error' });
        break;
    }
  }, []);

  useSSE(`/api/chat/stream?conversationId=${conversationId}`, onEvent);
}
```

**流式文本渲染**：

```typescript
// components/chat/AiMessage.tsx

export function AiMessage({ message }: { message: Message }) {
  const deferredContent = useDeferredValue(message.content);
  
  return (
    <div className="msg-bubble">
      <ReactMarkdown>{deferredContent}</ReactMarkdown>
      {message.status === 'streaming' && <Cursor />}
    </div>
  );
}
```

**移动端流式渲染额外考虑**：
- 流式输出时自动滚动，用户触摸屏幕立即暂停
- 键盘弹起时，消息区域高度实时收缩（`useKeyboardHeight`）
- 使用 `visualViewport` API 监听视口变化，兼容 iOS/Android 键盘行为差异

### 11.6 富卡片注册表

```typescript
// lib/card-registry.ts

type CardComponent = React.ComponentType<{ data: any; onAction: CardActionHandler }>;

const cardRegistry = new Map<CardType, CardComponent>();

export function registerCard(type: CardType, component: CardComponent) {
  cardRegistry.set(type, component);
}

export function renderCard(type: CardType, data: any, onAction: CardActionHandler) {
  const Component = cardRegistry.get(type);
  if (!Component) return <UnknownCard type={type} />;
  return <Component data={data} onAction={onAction} />;
}

// 初始化注册
registerCard('product_card', ProductCard);
registerCard('order_card', OrderCard);
registerCard('payment_card', PaymentCard);
registerCard('wishlist_card', WishlistCard);
registerCard('recommendation_card', RecommendationCard);
registerCard('shipping_card', ShippingCard);
registerCard('address_card', AddressCard);
registerCard('batch_card', BatchCard);
registerCard('flylink_processing_card', FlylinkProcessingCard);
registerCard('willing_card', WillingCard);
registerCard('success_card', SuccessCard);
```

### 11.7 商品卡片（移动端适配）

```typescript
// components/cards/ProductCard.tsx

export function ProductCard({ data, onAction }: Props) {
  const [showSku, setShowSku] = useState(false);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>(data.defaultSpecs || {});
  
  const currentSku = useMemo(() => {
    return data.skuVariants?.skus.find(sku =>
      Object.entries(selectedSpecs).every(([dim, val]) => sku.specs[dim] === val)
    );
  }, [selectedSpecs, data.skuVariants]);

  const displayPrice = data.sourcePrice + (currentSku?.priceDelta || 0);
  const displayWeight = currentSku?.weightKg || data.weightKg;

  return (
    <div className="w-full rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <div className="relative aspect-video">
        <Image src={data.imageUrl} fill className="object-cover" />
        <SourceBadge platform={data.sourcePlatform} className="absolute top-2 left-2" />
        <VerifiedBadge status={data.verifiedStatus} className="absolute top-2 right-2" />
      </div>

      <div className="p-3 space-y-2">
        <h3 className="text-sm font-medium line-clamp-2">{data.name}</h3>
        
        {data.skuVariants && (
          <button onClick={() => setShowSku(true)} className="text-xs text-purple-600">
            📐 选择规格 {selectedSkuLabel}
          </button>
        )}
        
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-purple-600">${displayPrice}</span>
          <span className="text-xs text-gray-400 line-through">¥{data.sourcePrice}</span>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>⭐ {data.rating}</span>
          <span>已售 {data.salesCount}</span>
          <span>{displayWeight}kg</span>
        </div>
        
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
          商品 ${displayPrice} + 运费 ${data.estimatedShippingFee} = 
          <strong className="text-gray-800">${total}</strong>
        </div>
        
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" size="sm" onPress={() => onAction('buy', ...)}>
            立即购买
          </Button>
          <IconButton onPress={() => onAction('wishlist', ...)}>❤️</IconButton>
          <IconButton onPress={() => onAction('share', ...)}>📤</IconButton>
        </div>
      </div>

      {showSku && (
        <BottomSheet onClose={() => setShowSku(false)}>
          <SkuSelector
            dimensions={data.skuVariants.dimensions}
            skus={data.skuVariants.skus}
            selected={selectedSpecs}
            onChange={setSelectedSpecs}
          />
        </BottomSheet>
      )}
    </div>
  );
}
```

### 11.8 移动端交互设计

#### 输入区

```
┌───────────────────────────────┐
│ [订单] [好物] [运费] [示例]    │  ← 横向滚动快捷标签
├───────────────────────────────┤
│ ┌───────────────────────┐ [➤] │
│ │ 粘贴商品链接，或告诉我  │     │  ← 自适应高度，最大 4 行
│ │ 你想买什么...          │     │
│ └───────────────────────┘     │
│  AI 生成内容仅供参考           │
└───────────────────────────────┘
```

- 快捷标签：横向滚动，不占多行
- 输入框：`textarea` 自适应高度，最大 120px（约 4 行）
- 发送按钮：有内容时显示，无内容时隐藏
- Enter 发送（外接键盘时），移动端软键盘 Return 键发送

#### 规格选择器（BottomSheet 弹出）

```
┌───────────────────────────────┐
│                          ═══  │  ← 拖拽手柄
│  📐 选择规格                   │
│                               │
│  颜色：                       │
│  [白色] [黑色] [红色] [蓝色]   │  ← 横向滚动 chip
│                               │
│  尺码：                       │
│  [US 6] [US 8] [US 9] [US 10]│
│                               │
│  💡 不同规格影响价格和重量      │
│                               │
│  ┌─────────────────────────┐  │
│  │  $29.90 + 运费 $5.40    │  │  ← 实时价格
│  │      [立即购买]          │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

#### 对话历史（侧滑抽屉）

```
用户左滑消息区域 → 抽屉从右侧滑出
                    ┌────────────────┐
                    │ 最近对话        │
                    │ ────────────── │
                    │ 买Nike球鞋  昨天│
                    │ 看看耳机    3天前│
                    │ 给妈妈买..  上周│
                    │                │
                    │ [+ 新对话]     │
                    └────────────────┘
```

#### 手势操作

| 手势 | 触发 | 效果 |
|------|------|------|
| 左滑消息 | 用户消息 | 显示 删除/复制 按钮 |
| 长按卡片 | 商品卡片 | 弹出操作菜单（购买/收藏/分享） |
| 下拉 | 消息列表顶部 | 刷新推荐/订单状态 |
| 双指缩放 | 商品图片 | 大图预览 |

### 11.9 PWA 配置

```typescript
// next.config.js (PWA 部分)
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\./,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
    },
    {
      urlPattern: /^https:\/\/.*\.(png|jpg|webp)/,
      handler: 'CacheFirst',
      options: { cacheName: 'image-cache', expiration: { maxEntries: 200, maxAgeSeconds: 86400 } }
    }
  ]
});
```

```json
// public/manifest.json
{
  "name": "AIBuyWorld - AI购物助手",
  "short_name": "AIBuyWorld",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F5F5FA",
  "theme_color": "#7C3AED",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 11.10 安全区域与键盘适配

```css
/* 全局安全区域 */
:root {
  --sat: env(safe-area-inset-top);
  --sab: env(safe-area-inset-bottom);
  --sal: env(safe-area-inset-left);
  --sar: env(safe-area-inset-right);
}

.top-bar {
  padding-top: calc(var(--sat) + 8px);
}

.bottom-tabs {
  padding-bottom: calc(var(--sab) + 4px);
}

.input-area {
  padding-bottom: calc(var(--sab) + 8px);
  transition: padding-bottom 0.15s ease;
}
```

```typescript
// hooks/useKeyboardHeight.ts
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    
    const handler = () => {
      const kbHeight = window.innerHeight - vv.height;
      setKeyboardHeight(Math.max(0, kbHeight));
    };
    
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);

  return keyboardHeight;
}
```

### 11.11 性能优化（移动端专项）

| 优化项 | 方案 | 目标 |
|--------|------|------|
| 首屏 | SSR + 流式 HTML（React Streaming） | FCP < 1s (4G) |
| JS 体积 | 代码分割 + dynamic import 卡片 | 首屏 JS < 150KB |
| 图片 | next/image + WebP/AVIF + 懒加载 | 减少 60% 图片体积 |
| 流式渲染 | useDeferredValue + 虚拟滚动 | 1000 条消息 30fps+ |
| 触摸响应 | touch-action 优化 + 300ms 消除 | 点击反馈 < 100ms |
| 离线 | PWA Service Worker 缓存壳 | 离线可打开应用 |
| 字体 | font-display: swap + 系统字体栈 | 无 FOIT |
| 动画 | CSS transform + will-change | 60fps 手势动画 |
| 内存 | 虚拟滚动 + 消息分页加载 | 常驻内存 < 150MB |

### 11.12 订单状态颜色与时间线

```typescript
// lib/order-status.ts

// PRD 3.5 定义的 5 种显示状态 + 颜色
const ORDER_STATUS_CONFIG = {
  '待支付': { color: '#8B83A8', bg: '#F5F5FA', label: '待支付' },
  '已支付': { color: '#8B83A8', bg: '#F5F5FA', label: '待支付', displayAs: '待支付' },
  '集货中': { color: '#F59E0B', bg: '#FFF7ED', label: '集货中' },
  '运输中': { color: '#7C3AED', bg: '#EDE9FE', label: '运输中' },
  '待提货': { color: '#3B82F6', bg: '#EFF6FF', label: '待提货' },
  '已提货': { color: '#10B981', bg: '#D1FAE5', label: '已提货' },
};

// 5 步物流时间线节点
const LOGISTICS_TIMELINE = [
  { key: 'ordered', label: '已下单 / 买手接单', description: '订单创建，买手开始采购' },
  { key: 'collecting', label: '国内集货中', description: '商品在国内集运仓汇集' },
  { key: 'shipped', label: '国际发运', description: '每周一统一发出' },
  { key: 'arrived', label: '到达目的国', description: '清关完成' },
  { key: 'delivery', label: '末端配送', description: '送达提货地址，通知提货' },
];

// DB 状态 → 时间线进度映射
const STATUS_TO_TIMELINE: Record<string, number> = {
  '待支付': 0,
  '已支付': 1,
  '集货中': 2,
  '运输中': 3,
  '待提货': 4,
  '已提货': 5, // 全部完成
};
```

### 11.13 历史对话回放（打字机效果）

```typescript
// hooks/useConversation.ts

export function useConversation(conversationId: string) {
  const setMessages = useChatStore(s => s.setMessages);

  const loadHistory = useCallback(async () => {
    const data = await api.get(`/api/conversations/${conversationId}/messages`);
    
    // 打字机效果：逐条消息回放
    let accumulated: Message[] = [];
    for (const msg of data.messages) {
      if (msg.role === 'assistant' && msg.content.length > 20) {
        // 长消息逐字显示
        for (let i = 0; i < msg.content.length; i += 3) {
          accumulated = [...accumulated.slice(0, -1), {
            ...msg,
            content: msg.content.slice(0, i + 3),
          }];
          setMessages([...accumulated]);
          await delay(10);
        }
      }
      accumulated.push(msg);
      setMessages([...accumulated]);
      await delay(50);
    }
  }, [conversationId]);

  return { loadHistory };
}
```

### 11.14 SKU 预选与跳过逻辑

```typescript
// components/cards/ProductCard.tsx — SKU 初始化逻辑

function useSkuInit(product: Product) {
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!product.skuVariants) return;

    const { dimensions, skus } = product.skuVariants;

    // 规则 1: 链接自带规格参数 → 自动预选
    if (product.defaultSpecs) {
      setSelectedSpecs(product.defaultSpecs);
      return;
    }

    // 规则 2: 只有一个 SKU → 自动选中，跳过规格选择
    if (skus.length === 1) {
      setSelectedSpecs(skus[0].specs);
      return;
    }

    // 规则 3: 某维度只有一个选项 → 自动选中
    const autoSelected: Record<string, string> = {};
    for (const dim of dimensions) {
      if (dim.options.length === 1) {
        autoSelected[dim.key] = dim.options[0];
      }
    }
    if (Object.keys(autoSelected).length > 0) {
      setSelectedSpecs(autoSelected);
    }
  }, [product]);

  // 判断是否所有维度都已选择
  const isAllSelected = product.skuVariants
    ? product.skuVariants.dimensions.every(d => selectedSpecs[d.key])
    : true;

  return { selectedSpecs, setSelectedSpecs, isAllSelected };
}
```

### 11.15 用户认证流程

```
┌─────────────────────────────────────────────────┐
│  认证流程                                         │
│                                                   │
│  首次打开 App                                      │
│    ├── 无 Token → 跳转登录页                       │
│    │     ├── 邮箱 + 密码 登录                      │
│    │     ├── Google OAuth 登录（海外用户常用）       │
│    │     └── 注册（邮箱 + 密码 + 区域选择）         │
│    │                                               │
│    └── 有 Token → 验证有效性                        │
│          ├── 有效 → 进入主页                        │
│          └── 过期 → 静默刷新 Token                  │
│                ├── 刷新成功 → 进入主页              │
│                └── 刷新失败 → 跳转登录页            │
│                                                   │
│  Token 存储: httpOnly Cookie (防 XSS)              │
│  刷新机制: Access Token 15min + Refresh Token 7d   │
└─────────────────────────────────────────────────┘
```

```typescript
// app/api/auth/login/route.ts
// POST /api/auth/login → { email, password } → { accessToken, refreshToken, user }

// app/api/auth/refresh/route.ts
// POST /api/auth/refresh → { refreshToken } → { accessToken }

// app/api/auth/register/route.ts
// POST /api/auth/register → { email, password, name, region } → { accessToken, refreshToken, user }
```

---

*文档结束*
