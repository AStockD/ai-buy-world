# AIBuyWorld — 运营管理平台 产品需求文档

> 版本：v1.1  
> 日期：2026-07-24  
> 状态：修订（批次/集采/买手移至外部集采系统，新增集采回调接口）  
> 依赖：买家端 PRD（docs/PRD.md v1.1）

---

## 1. 产品概述

### 1.1 产品定位

AIBuyWorld 运营管理平台（以下简称"管理后台"）是面向平台运营团队的内网管理系统。与面向消费者的买家端（`apps/web`）独立部署，通过独立域名/端口访问，共享同一套后端服务和数据库。

**职责边界**：管理后台负责消费者侧的运营管理（订单、用户、商品、财务、内容），供应链侧的批次调度、买手管理、集采单管理由**外部集采系统**负责，两边通过 API 对接。

### 1.2 核心价值

| 维度 | 说明 |
|------|------|
| **消费者运营** | 订单、用户、商品、财务、推荐全生命周期可视可操作 |
| **异常快速响应** | 订单状态强制推进、退款处理、队列监控、死信重试 |
| **数据驱动决策** | GMV/用户/转化多维度分析，实时仪表盘 |
| **供应链解耦** | 通过标准 API 与外部集采系统对接，职责清晰、独立演进 |

### 1.3 目标用户

| 角色 | 使用场景 |
|------|----------|
| **超级管理员** | 系统配置、角色分配、全局数据查看、敏感操作审批 |
| **运营人员** | 订单处理、用户管理、商品管理、推荐运营、通知发布 |
| **财务人员** | 交易对账、退款处理、返佣结算、汇率管理 |

### 1.4 系统架构与职责划分

```
┌─────────────────────────────────────────────────────────────────────┐
│                        共享基础设施                                    │
│     PostgreSQL 16  │  Redis 7  │  BullMQ  │  FlyLink API           │
└─────┬──────────────────────────────┬──────────────────┬────────────┘
      │                              │                  │
 ┌────▼────┐                   ┌────▼────┐        ┌────▼──────────┐
 │ apps/   │                   │ apps/   │        │ 外部集采系统    │
 │ server  │◄──────────┐       │ admin   │        │ (独立服务)     │
 │ (Fastify│           │       │ (Next.js│        │               │
 │  后端)  │    回调接口 │       │  14)    │        │ · 批次管理     │
 └────┬────┘           │       └─────────┘        │ · 买手管理     │
      │                │                          │ · 集采单管理   │
 ┌────▼────┐           │                          │ · 物流调度     │
 │ apps/   │           │                          └───────┬───────┘
 │ web     │           │                                  │
 │ (买家端) │           │                                  │
 └─────────┘           │                                  │
                       │    POST /api/callback/           │
                       │    fulfillment/*                 │
                       └──────────────────────────────────┘
```

**职责划分**：

| 职责 | 管理后台 | 外部集采系统 |
|------|---------|-------------|
| 订单管理（用户侧） | ✅ 全权管理 | — |
| 批次创建/推进 | 🔍 只读查看（接收回调数据） | ✅ 全权管理 |
| 买手管理 | — | ✅ 全权管理 |
| 集采单管理 | — | ✅ 全权管理 |
| 商品管理 | ✅ 全权管理 | — |
| 用户管理 | ✅ 全权管理 | — |
| 财务/退款 | ✅ 全权管理 | — |
| 订单履约状态更新 | 🔍 接收回调更新 | ✅ 推送状态+凭据 |

**数据流向**：

```
管理后台 → 集采系统：
  推送已支付订单 {orderId, productId, skuId, 商品明细, 用户地址, 区域}

集采系统 → 管理后台（回调）：
  批次创建通知   → {batchNo, area, pickupAddress, deadline, orderIds[]}
  批次状态变更   → {batchNo, newStatus, affectedOrderIds}
  订单履约更新   → {orderId, status, evidence: {type, urls, note}}
  采购结果通知   → {orderId, 采购成功/缺货/异常, 凭据}
```

---

## 2. 角色与权限设计

### 2.1 角色定义

| 角色 | 标识 | 权限范围 | 典型用户 |
|------|------|----------|----------|
| **超级管理员** | `super_admin` | 全部功能 + 角色管理 + 系统配置 + 审计日志 | CTO / 技术负责人 |
| **运营人员** | `operator` | 订单/用户/商品/推荐/通知管理，批次只读查看，不可修改系统配置 | 运营团队 |
| **财务人员** | `finance` | 交易查看/退款/返佣结算/汇率管理，不可修改订单状态 | 财务团队 |

### 2.2 权限矩阵

| 功能 | super_admin | operator | finance |
|------|:-----------:|:--------:|:-------:|
| 仪表盘 | ✅ 全部 | ✅ 全部 | ✅ 财务 |
| 订单管理 | ✅ 全部 | ✅ 全部 | 🔍 只读 |
| 批次查看 | ✅ | ✅ | ❌ |
| 用户管理 | ✅ 全部 | ✅ 全部 | ❌ |
| 商品管理 | ✅ 全部 | ✅ 全部 | ❌ |
| 财务管理 | ✅ 全部 | ❌ | ✅ 全部 |
| 推荐运营 | ✅ 全部 | ✅ 全部 | ❌ |
| 内容通知 | ✅ 全部 | ✅ 全部 | ❌ |
| 集采对接 | ✅ 全部 | ✅ 推送/查看 | ❌ |
| 系统监控 | ✅ 全部 | 🔍 只读 | ❌ |
| 数据分析 | ✅ 全部 | ✅ 全部 | 🔍 财务 |
| 角色管理 | ✅ | ❌ | ❌ |
| 审计日志 | ✅ | ❌ | ❌ |

### 2.3 数据模型变更

User 表新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `role` | enum | `user`（默认）/ `super_admin` / `operator` / `finance` |
| `isDisabled` | boolean | 账号是否被禁用（默认 false） |
| `disabledAt` | datetime | 禁用时间 |
| `disabledBy` | string | 执行禁用的管理员 ID |
| `disabledReason` | string | 禁用原因 |
| `lastLoginAt` | datetime | 最后登录时间 |

### 2.4 操作审计日志

新增 `audit_logs` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 日志 ID |
| adminId | string | 执行操作的管理员 ID |
| adminEmail | string | 管理员邮箱（冗余，便于查询） |
| action | string | 操作类型（如 `order.force_transition`、`user.disable`） |
| targetType | string | 操作对象类型（Order / User / Batch / ...） |
| targetId | string | 操作对象 ID |
| before | json | 操作前的数据快照（可选） |
| after | json | 操作后的数据快照（可选） |
| ip | string | 操作来源 IP |
| userAgent | string | 浏览器 UA |
| createdAt | datetime | 操作时间 |

**审计规则**：
- 所有写操作（POST/PATCH/PUT/DELETE）必须记录审计日志
- 敏感操作（强制状态推进、退款、禁用用户、角色变更）必须记录 before/after 快照
- 审计日志只增不改不删（append-only）
- 保留 365 天，超期归档到冷存储

---

## 3. 功能模块详细需求

### 3.1 运营仪表盘（P0）

#### 3.1.1 核心指标卡片

| 指标 | 数据来源 | 刷新频率 |
|------|----------|----------|
| 今日订单数 | `COUNT(orders) WHERE createdAt >= today` | 实时 |
| 今日 GMV | `SUM(total_amount) WHERE status IN ('已支付','集货中','运输中','待提货','已提货')` | 实时 |
| 待支付订单 | `COUNT(orders) WHERE status = '待支付'` | 实时 |
| 支付失败订单 | `COUNT(orders) WHERE status = '支付失败'` | 实时 |
| 活跃批次数 | 调用集采系统 API 获取 `status = '集货中'` 的批次数 | 每小时 |
| 注册用户总数 | `COUNT(users) WHERE role = 'user'` | 每小时 |
| 待结算佣金 | `SUM(commission_amount) WHERE status = '待结算'` | 每日 |

#### 3.1.2 趋势图

| 图表 | X 轴 | Y 轴 | 切换 |
|------|------|------|------|
| 订单量趋势 | 日期 | 订单数 | 7 天 / 30 天 |
| GMV 趋势 | 日期 | 金额（USD） | 7 天 / 30 天 |
| 新增用户趋势 | 日期 | 注册数 | 7 天 / 30 天 |
| 订单状态分布 | — | 各状态占比 | 饼图，今日 / 全部 |

#### 3.1.3 实时动态流

最近 50 条系统事件，按时间倒序：
- 新订单创建
- 支付成功/失败
- 订单状态变更
- 批次状态推进
- 用户注册

每条事件显示：时间、事件类型、关联实体、操作人（系统/用户/管理员）

#### 3.1.4 异常告警横幅

仪表盘顶部横幅，出现以下条件时显示：

| 条件 | 告警内容 | 级别 |
|------|----------|------|
| 支付失败率 > 10%（近 1 小时） | "⚠️ 支付失败率异常：{rate}%，请检查 FlyLink 状态" | 高 |
| BullMQ 死信队列 > 5 | "⚠️ {N} 个任务进入死信队列，需要人工处理" | 中 |
| 汇率更新超过 48 小时未执行 | "⚠️ 汇率数据可能过期，上次更新：{time}" | 中 |
| 待支付订单超 30 分钟未处理 > 20 | "⚠️ {N} 笔订单待支付超 30 分钟" | 低 |

---

### 3.2 订单管理（P0）

#### 3.2.1 订单列表

**筛选条件**：

| 筛选项 | 类型 | 说明 |
|--------|------|------|
| 订单状态 | 多选 | 待支付/已支付/集货中/运输中/待提货/已提货/已取消/支付失败 |
| 日期范围 | 日期选择器 | 创建时间范围 |
| 金额区间 | 数值输入 | 最小金额 ~ 最大金额 |
| 批次 | 下拉选择 | 关联的集运批次 |
| 用户 | 搜索框 | 按邮箱/姓名搜索 |
| 商品平台 | 多选 | 淘宝/天猫/京东 |

**列表字段**：

| 列 | 说明 | 可排序 |
|----|------|--------|
| 订单号 | AB + 日期 + 序号 | — |
| 用户 | 姓名 + 邮箱 | ✅ |
| 商品 | 缩略图 + 名称摘要 | — |
| 金额 | 商品 + 运费 - 折扣 = 合计 | ✅ |
| 状态 | 带颜色的状态标签 | ✅ |
| 批次 | 批次号 + 区域 | ✅ |
| 创建时间 | — | ✅ |
| 操作 | 查看详情 / 操作菜单 | — |

**分页**：默认 20 条/页，支持 50/100 切换

#### 3.2.2 订单详情

**信息分区**：

| 区域 | 内容 |
|------|------|
| 基本信息 | 订单号、状态、创建时间、更新时间 |
| 用户信息 | 姓名、邮箱、联系方式（可跳转用户详情） |
| 商品信息 | 商品图片、名称、SKU 规格、来源平台 |
| 费用明细 | 商品价、运费、折扣、合计、汇率 |
| 收货地址 | 完整结构化地址 |
| 批次信息 | 批次号、区域、提货地址、代收人（可跳转批次详情） |
| 支付信息 | 交易号、支付方式、支付时间、网关 ID |
| 取件信息 | 取件码、提货状态 |

**状态流转历史**（时间线展示）：

```
2026-07-24 10:30  待支付 → 已支付    触发方：FlyLink Webhook
2026-07-24 11:00  已支付 → 集货中    触发方：系统（分配批次 US-260724）
2026-07-24 15:00  集货中 → 运输中    触发方：管理员 admin@xxx.com（手动推进）
```

#### 3.2.3 管理操作

| 操作 | 条件 | 权限 | 说明 |
|------|------|------|------|
| 强制状态推进 | 目标状态在合法流转范围内 | operator+ | 跳过自动触发条件，手动推进状态 |
| 手动取消 + 退款 | 状态 ≤ 集货中 | operator+ | 取消订单并发起退款流程 |
| 重置取件码 | 状态 = 待提货 | operator+ | 生成新的 6 位取件码 |
| 添加备注 | 任意状态 | operator+ | 运营备注，仅管理后台可见 |
| 调整批次 | 状态 ≤ 集货中 | operator+ | 将订单移到其他批次 |
| 查看审计 | 任意状态 | super_admin | 查看该订单的所有操作记录 |

**强制状态推进规则**：
- 必须填写操作原因（下拉选择 + 自定义输入）
- 操作记录写入审计日志，包含 before/after 快照
- 状态变更同步通知用户（对话内推送）和 FlyLink

#### 3.2.4 批量操作

| 操作 | 说明 |
|------|------|
| 批量推进状态 | 选中多个同状态订单，统一推进到下一状态 |
| 批量分配批次 | 选中多个未分配批次的已支付订单，统一分配到指定批次 |
| 批量导出 | 导出筛选结果为 CSV/Excel |

---

### 3.3 批次查看（P0）

> 批次由**外部集采系统**全权管理，本系统**不存储批次数据**。管理后台展示批次信息时，通过调用集采系统的查询 API 实时获取。

#### 3.3.1 批次列表

管理后台调用集采系统 `GET /api/batches` 接口获取批次列表，本地不缓存。

**筛选**：状态（集货中/已发运/已到达/已完成）、区域、日期范围（筛选参数透传给集采系统 API）

**列表字段**：

| 列 | 说明 |
|----|------|
| 批次号 | 如 US-260715 |
| 区域 | 如 Rowland Heights |
| 状态 | 带颜色标签 |
| 订单数 | 当前批次订单数 |
| 总货值 | 批次内订单总金额（由本系统根据 orderIds 计算） |
| 代收人 | 姓名 + 联系方式 |
| 截止时间 | orderDeadline |
| 预计发货 | shipDate |

#### 3.3.2 批次详情

管理后台调用集采系统 `GET /api/batches/:batchNo` 接口获取批次详情。

| 区域 | 内容 |
|------|------|
| 批次信息 | 批次号、区域、状态、时间线（截止/发货/到达） |
| 代收人信息 | 姓名、联系方式、地址 |
| 订单列表 | 该批次内所有订单号（可点击跳转到本系统订单详情） |
| 统计信息 | 订单数、总货值、平均客单价、来源平台占比（由本系统根据 orderIds 计算） |
| 履约记录 | 本系统 CallbackLog 中该批次相关的回调记录（时间线展示） |

**操作限制**：
- 所有字段只读，无编辑/推进/移入移出按钮
- 如需调整批次，需登录集采系统操作
- 批次数据实时来自集采系统 API，管理后台不做本地缓存（避免数据不一致）
- 若集采系统不可用，批次页面显示"集采系统连接异常"提示

---

### 3.4 用户管理（P0）

#### 3.4.1 用户列表

**筛选**：角色、区域、注册时间范围、是否代收人、是否禁用

**搜索**：姓名、邮箱、手机号

**列表字段**：

| 列 | 说明 |
|----|------|
| 用户 | 头像 + 姓名 + 邮箱 |
| 角色 | 标签展示 |
| 区域 | 国家代码 |
| 订单数 | 历史订单总数 |
| 消费总额 | 历史消费总金额 |
| 代收次数 | receiveForOthersCount |
| 注册时间 | — |
| 状态 | 正常 / 已禁用 |
| 操作 | 查看详情 / 操作菜单 |

#### 3.4.2 用户详情

**Tab 页布局**：

| Tab | 内容 |
|-----|------|
| 基本信息 | 姓名、邮箱、手机、区域、角色、注册时间、最后登录、代收意愿/次数/评分 |
| 地址簿 | 所有收货地址列表（结构化展示） |
| 订单记录 | 该用户的所有订单（复用订单列表组件，默认按用户筛选） |
| 心愿单 | 该用户的心愿单商品列表 |
| 对话记录 | 该用户的对话列表 + 消息查看（只读） |
| 交易记录 | 该用户的支付交易列表 |
| 通知记录 | 该用户的通知列表 |

#### 3.4.3 管理操作

| 操作 | 权限 | 说明 |
|------|------|------|
| 设置角色 | super_admin | 修改用户角色（user ↔ operator 等） |
| 禁用账号 | operator+ | 禁用后用户无法登录，已有会话保留 |
| 启用账号 | operator+ | 恢复被禁用的账号 |
| 重置密码 | super_admin | 生成临时密码，通过邮件发送 |
| 标记代收人 | operator+ | 设置 willingToReceiveForOthers = true |
| 查看审计 | super_admin | 查看该用户相关的所有管理操作记录 |

---

### 3.5 权限与登录（P0）

#### 3.5.1 管理员登录

- 独立登录页面（`apps/admin` 根路由）
- 邮箱 + 密码登录（复用现有 auth.service）
- 登录后根据 `role` 字段判断可访问的菜单和功能
- 登录失败 5 次后锁定 15 分钟（防暴力破解）

#### 3.5.2 前端路由守卫

```
/admin/login          → 公开（未登录时自动跳转）
/admin/dashboard      → 所有角色
/admin/orders         → operator, super_admin, finance(只读)
/admin/batches        → operator, super_admin（只读）
/admin/users          → operator, super_admin
/admin/products       → operator, super_admin
/admin/finance        → finance, super_admin
/admin/recommendations→ operator, super_admin
/admin/content        → operator, super_admin
/admin/fulfillment    → operator, super_admin（集采对接看板）
/admin/monitoring     → operator(只读), super_admin
/admin/analytics      → operator, super_admin, finance(财务部分)
/admin/settings       → super_admin
/admin/audit-logs     → super_admin
```

#### 3.5.3 后端 RBAC 中间件

```typescript
// 使用方式
router.get('/api/admin/orders', 
  authMiddleware,           // 验证 JWT
  adminRoleMiddleware,      // 验证 role ∈ ['super_admin', 'operator', 'finance']
  auditMiddleware,          // 记录审计日志
  orderController.list
);
```

**中间件逻辑**：
1. 从 JWT 中提取 `userId`
2. 查询 User 表获取 `role`
3. 检查 `isDisabled` → 若禁用则返回 403
4. 检查 `role` 是否在允许列表中 → 不在则返回 403
5. 将 `adminId`、`adminRole` 注入请求上下文

---

### 3.6 外部集采系统对接（P1）

> 买手管理、集采单管理、批次调度由外部集采系统全权负责。管理后台提供**订单推送**和**回调接收**两个方向的集成能力。

#### 3.6.1 订单推送

运营人员在订单管理页面将已支付订单推送给集采系统。

**推送方式**：

| 方式 | 说明 |
|------|------|
| 自动推送 | 订单状态变为"已支付"后，系统自动推送给集采系统（推荐） |
| 手动推送 | 运营在订单详情页点击"推送至集采系统"按钮 |
| 批量推送 | 选中多个已支付订单，批量推送 |

**推送数据**：

```json
{
  "orderId": "AB2607120001",
  "orderNo": "AB260712-0001",
  "quantity": 2,
  "product": {
    "productId": "p_xxx",
    "name": "Nike Air Force 1 '07 男子运动鞋",
    "sourcePlatform": "taobao",
    "sourceUrl": "https://item.taobao.com/item.htm?id=123456789",
    "skuId": "sku_001",
    "specs": {"颜色": "白色", "尺码": "US 8"},
    "images": [
      "https://img.alicdn.com/imgextra/xxx_1.jpg",
      "https://img.alicdn.com/imgextra/xxx_2.jpg"
    ],
    "sourcePrice": 499.00,
    "sourceCurrency": "CNY",
    "weightGrams": 800
  },
  "shippingAddress": {
    "recipientName": "张伟",
    "phone": "+1 626-555-0123",
    "countryCode": "US",
    "state": "California",
    "city": "Rowland Heights",
    "zipCode": "91748",
    "street": "1888 Commerce Ave",
    "street2": "Suite 200",
    "formatted": "1888 Commerce Ave, Suite 200, Rowland Heights, CA 91748, US"
  },
  "remarks": "买家备注：请让卖家发顺丰，急用",
  "pushedAt": "2026-07-24T10:30:00Z"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| orderId | string | ✅ | 本系统订单 ID（回调匹配键） |
| orderNo | string | ✅ | 订单号（展示用） |
| quantity | int | ✅ | 商品数量 |
| product.productId | string | ✅ | 本系统商品 ID |
| product.name | string | ✅ | 商品名称 |
| product.sourcePlatform | string | ✅ | 来源平台（taobao / tmall / jd） |
| product.sourceUrl | string | ✅ | 商品原始链接（买手采购用） |
| product.skuId | string | ✅ | SKU ID |
| product.specs | object | ✅ | SKU 规格（键值对，如颜色/尺码） |
| product.images | string[] | ✅ | 商品图片 URL 列表（验货参考） |
| product.sourcePrice | float | ✅ | 源平台原价（买手采购成本） |
| product.sourceCurrency | string | ✅ | 原价币种（CNY） |
| product.weightGrams | int | ✅ | 商品预估重量（克），用于物流计算 |
| shippingAddress.recipientName | string | ✅ | 收货人姓名 |
| shippingAddress.phone | string | ✅ | 收货人电话 |
| shippingAddress.countryCode | string | ✅ | 国家代码（US / CA / ...） |
| shippingAddress.state | string | ✅ | 州/省 |
| shippingAddress.city | string | ✅ | 城市 |
| shippingAddress.zipCode | string | ✅ | 邮编 |
| shippingAddress.street | string | ✅ | 街道地址 |
| shippingAddress.street2 | string | — | 街道地址续（公寓号等，可选） |
| shippingAddress.formatted | string | ✅ | 格式化完整地址（展示用） |
| remarks | string | — | 买家备注（可选，无则不传或传 null） |
| pushedAt | datetime | ✅ | 推送时间（ISO 8601） |

> **设计原则**：推送数据只传集采系统完成采购所需的信息。买家支付的外币金额、运费、折扣、汇率等属于本系统内部商业数据，不暴露给外部集采系统。
```

**推送状态跟踪**：

| 推送状态 | 说明 |
|----------|------|
| 待推送 | 已支付但尚未推送 |
| 推送成功 | 集采系统已接收，返回确认 |
| 推送失败 | 集采系统拒绝或超时，可重试 |
| 已忽略 | 运营手动标记为不需要推送（如用户取消中） |

#### 3.6.2 回调接口设计

集采系统通过回调接口通知管理后台订单履约状态变更和凭据信息。

**接口安全**：
- 所有回调请求需携带签名（HMAC-SHA256），使用预共享密钥验证
- 幂等处理：同一 `requestId` 的重复回调不重复处理
- 回调超时：集采系统需在 5 秒内收到 200 响应，否则重试（最多 3 次，间隔 1/5/30 分钟）

##### 回调 1：批次创建通知

集采系统创建新批次时回调。

```
POST /api/callback/fulfillment/batch-created
```

```json
{
  "requestId": "req_xxx",
  "timestamp": "2026-07-24T10:00:00Z",
  "batch": {
    "batchNo": "US-260715",
    "region": "US",
    "area": "Rowland Heights",
    "pickupAddress": {
      "recipientName": "李明",
      "phone": "+1 626-555-0456",
      "formatted": "1900 Commerce Ave, Rowland Heights, CA 91748"
    },
    "orderDeadline": "2026-07-20T23:59:00Z",
    "shipDate": "2026-07-21T00:00:00Z",
    "estimatedArrival": "2026-08-01T00:00:00Z",
    "orderIds": ["AB2607120001", "AB2607120002", "AB2607120003"]
  }
}
```

**处理逻辑**：
1. 为 orderIds 中每个订单创建/更新 `OrderFulfillment` 记录，写入 `batchNo`
2. 记录 CallbackLog
3. 记录审计日志

##### 回调 2：批次状态变更

集采系统推进批次状态时回调。

```
POST /api/callback/fulfillment/batch-status-changed
```

```json
{
  "requestId": "req_xxx",
  "timestamp": "2026-07-25T08:00:00Z",
  "batchNo": "US-260715",
  "previousStatus": "集货中",
  "newStatus": "已发运",
  "affectedOrderIds": ["AB2607120001", "AB2607120002", "AB2607120003"]
}
```

**处理逻辑**：
1. 更新 affectedOrderIds 对应的 `OrderFulfillment` 记录的 `fulfillmentStatus`
2. 根据批次新状态，通过 service 层触发 Order 状态流转：
   - 批次→已发运：Order 集货中→运输中
   - 批次→已到达：Order 运输中→待提货
   - 批次→已完成：标记 OrderFulfillment 完成
3. 批次→已到达时，为每个订单生成取件码（更新 Order 表）
4. 向受影响用户推送通知
5. 记录 CallbackLog

##### 回调 3：订单履约状态更新（含凭据）

集采系统更新单个订单的履约状态，附带照片/凭据。

```
POST /api/callback/fulfillment/order-fulfillment
```

```json
{
  "requestId": "req_xxx",
  "timestamp": "2026-07-24T14:00:00Z",
  "orderId": "AB2607120001",
  "status": "已采购",
  "evidence": {
    "type": "purchase_receipt",
    "description": "买手已在淘宝完成采购",
    "attachments": [
      {
        "type": "photo",
        "url": "https://storage.example.com/evidence/abc123.jpg",
        "thumbnailUrl": "https://storage.example.com/evidence/abc123_thumb.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 245000,
        "uploadedAt": "2026-07-24T14:00:00Z"
      },
      {
        "type": "photo",
        "url": "https://storage.example.com/evidence/abc124.jpg",
        "thumbnailUrl": "https://storage.example.com/evidence/abc124_thumb.jpg",
        "mimeType": "image/jpeg",
        "sizeBytes": 189000,
        "uploadedAt": "2026-07-24T14:00:00Z"
      }
    ],
    "note": "商品已购买，预计 2 天内到国内集货仓"
  }
}
```

**凭据类型定义**：

| type | 说明 | 对应订单状态 |
|------|------|-------------|
| `purchase_receipt` | 采购凭据（淘宝/京东订单截图） | 已采购 |
| `domestic_warehouse_in` | 国内集货仓入库凭据（仓库收货照片） | 国内集货中 |
| `international_shipping` | 国际物流凭据（运单号 + 物流截图） | 运输中 |
| `customs_clearance` | 清关凭据（清关完成通知） | 到达目的国 |
| `arrival_at_pickup` | 到达提货点凭据（包裹送达照片） | 待提货 |
| `pickup_confirmed` | 提货确认凭据（用户签字/取件码确认照片） | 已提货 |
| `exception` | 异常凭据（缺货/损坏/退回照片） | 异常 |

**凭据附件规范**：

| 字段 | 类型 | 说明 |
|------|------|------|
| type | enum | `photo` / `video` / `document` |
| url | string | 文件下载地址（HTTPS，临时签名 URL 或永久存储 URL） |
| thumbnailUrl | string | 缩略图地址（仅图片/视频，可选） |
| mimeType | string | 文件 MIME 类型 |
| sizeBytes | int | 文件大小（字节） |
| uploadedAt | datetime | 上传时间 |

**处理逻辑**：
1. 验证签名和幂等性
2. 创建/更新该订单的 `OrderFulfillment` 记录，更新 `fulfillmentStatus`
3. 将凭据存入 `OrderFulfillmentEvidence` + `EvidenceAttachment` 表
4. 如需触发 Order 状态流转（如"已到达"→ 生成取件码），通过 service 层更新 Order 状态
5. 通知用户（对话内推送状态更新 + 凭据预览）
6. 记录 CallbackLog

##### 回调 4：采购结果通知

集采系统通知单个订单的采购结果。

```
POST /api/callback/fulfillment/purchase-result
```

```json
{
  "requestId": "req_xxx",
  "timestamp": "2026-07-24T15:00:00Z",
  "orderId": "AB2607120001",
  "result": "success",
  "details": {
    "actualSourcePrice": 499.00,
    "actualSourceCurrency": "CNY",
    "buyerName": "买手老张",
    "purchaseOrderId": "PO260724001",
    "estimatedArrivalAtWarehouse": "2026-07-26T00:00:00Z"
  },
  "evidence": {
    "type": "purchase_receipt",
    "attachments": [
      {"type": "photo", "url": "https://...", "mimeType": "image/jpeg", "sizeBytes": 200000}
    ],
    "note": "已下单，卖家已发货"
  }
}
```

**采购结果类型**：

| result | 说明 | 后续处理 |
|--------|------|----------|
| `success` | 采购成功 | 更新订单状态，等待国内集货 |
| `out_of_stock` | 商品缺货 | 通知用户，提供退款/等待补货选项 |
| `price_changed` | 价格变动 | 通知用户确认差价或取消 |
| `link_expired` | 链接失效 | 通知用户重新下单或退款 |
| `quality_issue` | 质量问题 | 附带照片凭据，通知用户决策 |

#### 3.6.3 集采对接状态看板

运营后台展示订单在集采系统中的处理状态：

| 视图 | 内容 |
|------|------|
| 推送概览 | 待推送 / 已推送 / 推送失败 数量统计 |
| 采购进度 | 待采购 / 采购中 / 已采购 / 异常 数量统计 |
| 异常列表 | 缺货/失效/质量问题的订单列表，需运营介入处理 |
| 凭据查看 | 在订单详情中展示集采系统回传的所有凭据（照片/文件） |
| 回调日志 | 集采系统回调的请求/响应记录，便于排查问题 |

---

### 3.7 商品管理（P1）

#### 3.7.1 商品列表

**筛选**：来源平台（淘宝/天猫/京东）、核验状态（待核验/已通过/未通过）、上架时间、库存状态

**搜索**：商品名称、商品 ID、来源 URL

**列表字段**：

| 列 | 说明 |
|----|------|
| 商品 | 缩略图 + 名称 |
| 来源 | 平台标签 + 原始链接 |
| 价格 | 原价（CNY）/ 本地价（USD） |
| 核验状态 | 待核验 / 已通过 / 未通过 |
| 库存 | 有货 / 无货 / 预售 |
| 销量 | salesCount |
| 最后刷新 | updatedAt |
| 操作 | 详情 / 核验 / 刷新 |

#### 3.7.2 商品详情

| 区域 | 内容 |
|------|------|
| 基本信息 | 名称、来源平台、原始链接、FlyLink ID |
| 图片 | 主图 + 多语言资产预览 |
| 定价信息 | 原价（CNY）、各区域本地价、汇率、加价率、运费 |
| SKU 规格 | 规格维度 + 各 SKU 的价格偏移/重量/库存 |
| 原始数据 | FlyLink 返回的 raw_data（JSON 折叠展示） |
| 关联订单 | 该商品的所有订单列表 |

#### 3.7.3 管理操作

| 操作 | 说明 | 权限 |
|------|------|------|
| AI 核验通过 | 标记 verified_status = "已通过" | operator+ |
| AI 核验不通过 | 标记 verified_status = "未通过"，需填写原因 | operator+ |
| 手动刷新 | 触发 FlyLink 重新解析该商品 | operator+ |
| 批量刷新 | 勾选多个商品批量触发刷新 | operator+ |
| 调整加价率 | 修改该商品的 markup_rate，联动更新本地价 | super_admin |
| 调整运费率 | 修改该商品的 shipping_rate_per_kg | super_admin |
| 下架商品 | 标记为不可购买（soft delete 或 stock_status 变更） | super_admin |

---

### 3.8 财务管理（P1）

#### 3.8.1 交易列表

**筛选**：状态（待支付/已支付/已退款/支付失败）、日期范围、金额区间、支付方式

**列表字段**：

| 列 | 说明 |
|----|------|
| 交易号 | 流水号 |
| 用户 | 姓名 + 邮箱 |
| 关联订单 | 订单号列表（支持合并支付） |
| 金额 | 支付金额 + 币种 |
| 支付方式 | 信用卡/PayPal/Zelle/ApplePay |
| 状态 | 带颜色标签 |
| 支付时间 | paidAt |
| 操作 | 查看详情 / 退款 |

#### 3.8.2 退款处理

**退款流程**：

```
管理员选择交易 → 点击"退款"
    ↓
填写退款原因 + 退款金额（支持部分退款）
    ↓
确认退款（需 super_admin 审批，若操作者为 finance）
    ↓
调用 FlyLink 退款 API（或手动标记）
    ↓
更新 Transaction 状态为"已退款"，记录 refundedAt
    ↓
关联订单状态变更为"已取消"
    ↓
通知用户退款完成
```

**退款规则**：
- 全额退款：交易金额原路退回
- 部分退款：仅退指定金额（如仅退运费），需填写退款明细
- 退款审批：finance 角色发起，super_admin 审批（金额 > $100 时）
- 退款记录：写入审计日志，关联原交易

#### 3.8.3 返佣结算

**待结算列表**：

| 列 | 说明 |
|----|------|
| 推荐人 | 推荐人姓名 + 邮箱 |
| 被推荐人 | 被推荐人姓名 |
| 触发订单 | 订单号 |
| 返佣金额 | commission_amount |
| 状态 | 待结算 / 已结算 / 已失效 |
| 操作 | 结算 / 标记失效 |

**结算操作**：
- 单笔结算：确认返佣有效，标记为"已结算"，记录结算时间
- 批量结算：勾选多条，一键结算
- 标记失效：推荐作弊等异常情况，标记为"已失效"

#### 3.8.4 汇率管理

| 功能 | 说明 |
|------|------|
| 当前汇率 | 展示当前生效的 exchangeRateSnapshot（各币种） |
| 历史记录 | 汇率变更历史表格（日期、旧值、新值、来源、影响商品数） |
| 手动触发更新 | 点击按钮立即执行 7 步汇率更新算法 |
| 汇率模拟 | 输入 CNY 金额，展示各币种的换算结果 |

---

### 3.9 推荐运营（P1）

#### 3.9.1 推荐列表

**筛选**：来源（order_history / nearby_buyers / platform / personal）、区域、周期

**列表字段**：

| 列 | 说明 |
|----|------|
| 排名 | rank |
| 商品 | 缩略图 + 名称 |
| 来源 | 来源标签 |
| 区域 | 适用区域 |
| 热度 | hotScore + hotLabel |
| 周期 | periodStart ~ periodEnd |
| 操作 | 编辑 / 移除 |

#### 3.9.2 管理操作

| 操作 | 说明 |
|------|------|
| 添加推荐 | 选择商品 + 设置来源/区域/标签/排名 |
| 编辑推荐 | 修改标签、排名、元数据 |
| 调整排序 | 拖拽排序或手动输入排名 |
| 设置周期 | 配置本周榜单的起止日期 |
| 批量导入 | 从 CSV 导入推荐数据 |
| 移除推荐 | 从榜单中移除（soft delete） |
| 生成榜单 | 触发推荐算法，基于最新订单数据自动生成榜单 |

---

### 3.10 内容与通知（P2）

#### 3.10.1 系统公告/广播

| 功能 | 说明 |
|------|------|
| 创建广播 | 标题 + 内容 + 目标（全部用户 / 指定区域 / 指定角色） |
| 定时发送 | 设置发送时间，到点自动推送 |
| 发送渠道 | 对话内推送（MVP）、Push（后续） |
| 广播历史 | 已发送的广播列表 + 触达人数统计 |

#### 3.10.2 通知模板管理

| 功能 | 说明 |
|------|------|
| 模板列表 | 系统预定义的通知模板（订单状态、价格变动等） |
| 编辑模板 | 修改模板文案（支持变量占位符 {orderNo}、{amount} 等） |
| 预览 | 输入示例数据预览通知效果 |

#### 3.10.3 AI 意图配置管理

| 功能 | 说明 |
|------|------|
| 意图列表 | 展示所有 IntentConfig 记录 |
| 编辑意图 | 修改匹配模式（patterns）、优先级、上下文守卫 |
| 启用/禁用 | 切换 is_active 状态 |
| 新增意图 | 创建新的意图配置 |
| 测试匹配 | 输入测试文本，验证是否匹配该意图 |

---

### 3.11 系统监控（P2）

#### 3.11.1 队列状态面板

| 队列 | 展示信息 |
|------|----------|
| notification | 等待中 / 处理中 / 已完成 / 失败数 |
| product-refresh | 等待中 / 处理中 / 已完成 / 失败数 |
| flylink-parse | 等待中 / 处理中 / 已完成 / 失败数 |
| order-sync | 等待中 / 处理中 / 已完成 / 失败数 |
| exchange-rate | 等待中 / 处理中 / 已完成 / 失败数 |

每个队列可展开查看：
- 当前处理中的任务列表
- 最近失败的任务（含错误信息）
- 死信队列任务列表 + 手动重试按钮

#### 3.11.2 定时任务状态

| 任务 | 调度规则 | 展示信息 |
|------|----------|----------|
| 汇率更新 | 每日 UTC 00:00 | 上次执行时间、执行结果、下次执行时间 |
| 商品刷新 | 每 6 小时 | 上次执行时间、刷新数量、失败数量 |
| 批次推进 | 每 30 分钟 | 上次执行时间、推进批次数 |
| 批次截止提醒 | 每日 UTC 18:00 | 上次执行时间、发送通知数 |

#### 3.11.3 审计日志查看

**筛选**：管理员、操作类型、目标类型、日期范围

**列表字段**：时间、管理员、操作、目标、IP

**详情展开**：before/after JSON diff 对比视图

---

### 3.12 数据分析（P2）

#### 3.12.1 用户分析

| 图表 | 说明 |
|------|------|
| 注册趋势 | 按日/周/月统计新增用户数 |
| 区域分布 | 饼图/地图展示用户区域分布 |
| 活跃率 | 近 7/30 天有登录或下单行为的用户占比 |
| 代收人统计 | 代收人数量、平均代收次数、平均评分 |

#### 3.12.2 订单分析

| 图表 | 说明 |
|------|------|
| GMV 趋势 | 按日/周/月统计成交总额 |
| 客单价分布 | 直方图展示订单金额分布 |
| 支付方式占比 | 饼图展示各支付方式使用率 |
| 转化率漏斗 | 解析→下单→支付→完成 各环节转化率 |
| 取消/退款率 | 按原因分类统计 |

#### 3.12.3 批次分析

| 图表 | 说明 |
|------|------|
| 批次利用率 | 各批次实际订单数 / 预期订单数 |
| 区域分布 | 各区域的批次数和订单量 |
| 准时率 | 实际到达时间 vs 预计到达时间的偏差分布 |
| 代收人绩效 | 代收次数、提货确认时效、用户评分 |

#### 3.12.4 商品分析

| 图表 | 说明 |
|------|------|
| 热门商品 TOP 20 | 按销量/销售额排序 |
| 平台分布 | 各来源平台的商品数和订单数 |
| 解析成功率 | FlyLink 解析成功/失败统计 |
| 核验通过率 | AI 核验通过/不通过/待核验统计 |

---

## 4. 数据模型补充

### 4.1 新增表

#### 4.1.1 审计日志 (AuditLog)

见 §2.4

#### 4.1.2 运营备注 (OrderNote)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 备注 ID |
| orderId | string | 关联订单 ID |
| adminId | string | 添加备注的管理员 ID |
| content | text | 备注内容 |
| createdAt | datetime | 创建时间 |

#### 4.1.3 系统公告 (Announcement)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 公告 ID |
| title | string | 公告标题 |
| content | text | 公告内容 |
| targetRole | string | 目标用户角色（all / US / CA / ...） |
| targetRegion | string | 目标区域（null = 全部） |
| status | enum | 草稿 / 已发送 / 已撤回 |
| sentAt | datetime | 发送时间 |
| sentCount | int | 触达用户数 |
| createdBy | string | 创建人 ID |
| createdAt | datetime | 创建时间 |

#### 4.1.4 订单履约凭据 (OrderFulfillmentEvidence)

存储集采系统回调回传的每个订单的履约凭据（照片/文件）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 凭据 ID |
| orderId | string | 关联订单 ID |
| evidenceType | enum | 凭据类型（见 §3.6.2 凭据类型定义） |
| description | string | 凭据描述 |
| note | string | 备注信息 |
| status | string | 触发此凭据时的订单状态 |
| callbackRequestId | string | 关联的回调 requestId（幂等键） |
| createdAt | datetime | 创建时间 |

#### 4.1.5 凭据附件 (EvidenceAttachment)

每条履约凭据可包含多个附件（照片/视频/文件）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 附件 ID |
| evidenceId | string | 关联凭据 ID |
| type | enum | `photo` / `video` / `document` |
| url | string | 文件下载地址 |
| thumbnailUrl | string | 缩略图地址（可选） |
| mimeType | string | 文件 MIME 类型 |
| sizeBytes | int | 文件大小（字节） |
| uploadedAt | datetime | 上传时间 |

#### 4.1.6 订单集采集成 (OrderFulfillment)

与 Order 表 1:1 关联，集中存储所有集采系统集成的状态和数据。**不修改 Order 表结构**，避免影响买家端。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 记录 ID |
| orderId | string | 关联订单 ID（**唯一索引**，1:1） |
| pushStatus | enum | 推送状态：`pending` / `success` / `failed` / `ignored` |
| fulfillmentStatus | enum | 履约状态：`pending` / `purchased` / `domestic_warehouse` / `shipping` / `customs` / `arrived` / `picked_up` / `exception` |
| batchNo | string | 所属批次号（集采系统回调写入，可为空） |
| pushedAt | datetime | 推送成功时间 |
| retryCount | int | 推送重试次数 |
| lastPushError | string | 最后一次推送错误信息 |
| pushResponseCode | int | 集采系统接收响应码 |
| pushResponseBody | json | 集采系统接收响应体 |
| pushedBy | string | 推送人（`system` / adminId） |
| lastCallbackAt | datetime | 最后一次回调时间 |
| externalData | json | 集采系统回传的扩展数据（灵活存储，避免频繁加列） |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 最后更新时间 |

**设计说明**：
- `orderId` 唯一索引，确保与 Order 表严格 1:1
- 推送相关字段（pushStatus、pushedAt、retryCount 等）替代原 OrderPushLog 的职责
- `externalData` JSON 字段存储集采系统回传的非结构化扩展数据（如采购结果详情、买手信息等），避免为每个字段建列
- 买家端查询 Order 表时无感知，不受集采集成影响

#### 4.1.7 回调日志 (CallbackLog)

记录集采系统所有回调请求，便于排查问题。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 日志 ID |
| requestId | string | 集采系统请求 ID（幂等键） |
| endpoint | string | 回调路径（如 `/api/callback/fulfillment/order-fulfillment`） |
| method | string | HTTP 方法 |
| requestBody | json | 请求体 |
| responseCode | int | 响应状态码 |
| responseBody | json | 响应体 |
| processingTime | int | 处理耗时（毫秒） |
| signatureValid | boolean | 签名验证是否通过 |
| idempotentHit | boolean | 是否为重复请求（幂等命中） |
| error | string | 错误信息（如有） |
| createdAt | datetime | 请求时间 |

### 4.2 修改表

#### 4.2.1 User 表新增字段

见 §2.3

#### 4.2.2 Order 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| adminNotes | string | 运营备注（简短备注，复杂备注用 OrderNote 表） |

> **注意**：集采集成相关字段（pushStatus、fulfillmentStatus、batchNo 等）全部存储在独立的 `OrderFulfillment` 表（§4.1.6），**不修改 Order 表核心结构**，确保买家端零影响。

---

## 5. API 设计概要

### 5.1 路由前缀

所有管理 API 统一使用 `/api/admin` 前缀，通过 `adminRoleMiddleware` 保护。

### 5.2 路由清单

#### 认证与权限

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/admin/auth/login` | 管理员登录 | 公开 |
| GET | `/api/admin/auth/me` | 当前管理员信息 | 所有角色 |
| GET | `/api/admin/users/:id/permissions` | 获取用户权限列表 | super_admin |
| PATCH | `/api/admin/users/:id/role` | 修改用户角色 | super_admin |

#### 仪表盘

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/dashboard/stats` | 核心指标数据 | 所有角色 |
| GET | `/api/admin/dashboard/trends` | 趋势数据（订单/GMV/用户） | 所有角色 |
| GET | `/api/admin/dashboard/events` | 实时动态流 | 所有角色 |
| GET | `/api/admin/dashboard/alerts` | 异常告警 | 所有角色 |

#### 订单管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/orders` | 全量订单列表（分页+筛选） | operator+ |
| GET | `/api/admin/orders/:id` | 订单详情 | operator+ |
| POST | `/api/admin/orders/:id/transition` | 强制状态推进 | operator+ |
| POST | `/api/admin/orders/:id/cancel` | 手动取消+退款 | operator+ |
| POST | `/api/admin/orders/:id/reset-pickup-code` | 重置取件码 | operator+ |
| POST | `/api/admin/orders/:id/notes` | 添加备注 | operator+ |
| POST | `/api/admin/orders/:id/reassign-batch` | 调整批次（调用集采系统 API） | operator+ |
| POST | `/api/admin/orders/batch-transition` | 批量推进状态 | operator+ |
| GET | `/api/admin/orders/export` | 导出 CSV | operator+ |

#### 批次查看（只读，代理集采系统 API）

> 本系统不存储批次数据，以下接口透传调用集采系统的查询 API。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/batches` | 批次列表（代理集采系统 `GET /api/batches`） | operator+ |
| GET | `/api/admin/batches/:batchNo` | 批次详情（代理集采系统 `GET /api/batches/:batchNo`） | operator+ |

#### 用户管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/users` | 用户列表 | operator+ |
| GET | `/api/admin/users/:id` | 用户详情 | operator+ |
| PATCH | `/api/admin/users/:id/disable` | 禁用账号 | operator+ |
| PATCH | `/api/admin/users/:id/enable` | 启用账号 | operator+ |
| POST | `/api/admin/users/:id/reset-password` | 重置密码 | super_admin |
| PATCH | `/api/admin/users/:id/receiver` | 标记代收人 | operator+ |

#### 集采对接（订单推送）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/admin/fulfillment/push` | 推送单个订单到集采系统 | operator+ |
| POST | `/api/admin/fulfillment/push-batch` | 批量推送多个订单 | operator+ |
| POST | `/api/admin/fulfillment/push-ignore/:orderId` | 标记订单不需要推送 | operator+ |
| POST | `/api/admin/fulfillment/push-retry/:orderId` | 重试推送失败的订单 | operator+ |
| GET | `/api/admin/fulfillment/push-status` | 推送状态概览（待推送/成功/失败统计） | operator+ |
| GET | `/api/admin/fulfillment/orders` | 带推送状态的订单列表 | operator+ |

#### 集采对接（凭据与履约）

> 以下接口查询/操作 `OrderFulfillment` 表（§4.1.6），不直接修改 Order 表。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/fulfillment/status/:orderId` | 查看订单的集采集成状态（OrderFulfillment） | operator+ |
| GET | `/api/admin/fulfillment/evidence/:orderId` | 查看订单的所有履约凭据 | operator+ |
| GET | `/api/admin/fulfillment/callback-logs` | 回调日志列表（排查问题） | operator+ |
| GET | `/api/admin/fulfillment/callback-logs/:id` | 回调日志详情 | operator+ |

#### 集采系统回调接口（外部调用，无需管理员鉴权）

> 以下接口由外部集采系统调用，使用 HMAC-SHA256 签名验证，不走 `adminRoleMiddleware`。

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/callback/fulfillment/batch-created` | 批次创建通知 | HMAC 签名 |
| POST | `/api/callback/fulfillment/batch-status-changed` | 批次状态变更通知 | HMAC 签名 |
| POST | `/api/callback/fulfillment/order-fulfillment` | 订单履约状态更新（含凭据） | HMAC 签名 |
| POST | `/api/callback/fulfillment/purchase-result` | 采购结果通知 | HMAC 签名 |

#### 集采系统查询 API（本系统主动调用）

> 以下接口由本系统调用集采系统获取数据，用于管理后台批次查看页面。非管理员直接调用，而是后端服务代理请求。

| 集采系统接口 | 本系统使用场景 | 说明 |
|-------------|--------------|------|
| `GET /api/batches` | 批次列表页 | 透传筛选参数，获取批次列表 |
| `GET /api/batches/:batchNo` | 批次详情页 | 获取批次完整信息（代收人、时间线、orderIds） |
| `POST /api/orders/push` | 订单推送 | 接收本系统推送的已支付订单 |

**集成配置**（环境变量）：

| 变量 | 说明 |
|------|------|
| `PROCUREMENT_API_BASE_URL` | 集采系统 API 地址 |
| `PROCUREMENT_API_SECRET` | HMAC 签名密钥（与集采系统共享） |
| `PROCUREMENT_API_TIMEOUT` | 请求超时时间（默认 5000ms） |

#### 商品管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/products` | 商品列表 | operator+ |
| GET | `/api/admin/products/:id` | 商品详情 | operator+ |
| PATCH | `/api/admin/products/:id/verify` | 核验操作 | operator+ |
| POST | `/api/admin/products/:id/refresh` | 手动刷新 | operator+ |
| POST | `/api/admin/products/batch-refresh` | 批量刷新 | operator+ |
| PATCH | `/api/admin/products/:id/pricing` | 调整定价参数 | super_admin |

#### 财务管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/transactions` | 交易列表 | finance+ |
| GET | `/api/admin/transactions/:id` | 交易详情 | finance+ |
| POST | `/api/admin/transactions/:id/refund` | 发起退款 | finance+ |
| GET | `/api/admin/commissions` | 返佣列表 | finance+ |
| POST | `/api/admin/commissions/settle` | 批量结算 | finance+ |
| GET | `/api/admin/exchange-rate` | 当前汇率 | finance+ |
| GET | `/api/admin/exchange-rate/history` | 汇率历史 | finance+ |
| POST | `/api/admin/exchange-rate/trigger` | 手动触发更新 | super_admin |

#### 推荐运营

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/recommendations` | 推荐列表 | operator+ |
| POST | `/api/admin/recommendations` | 添加推荐 | operator+ |
| PATCH | `/api/admin/recommendations/:id` | 编辑推荐 | operator+ |
| PATCH | `/api/admin/recommendations/rank` | 批量排序 | operator+ |
| DELETE | `/api/admin/recommendations/:id` | 移除推荐 | operator+ |
| POST | `/api/admin/recommendations/generate` | 自动生成榜单 | operator+ |

#### 内容与通知

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/announcements` | 公告列表 | operator+ |
| POST | `/api/admin/announcements` | 创建公告 | operator+ |
| POST | `/api/admin/announcements/:id/send` | 发送公告 | operator+ |
| GET | `/api/admin/intents` | 意图配置列表 | operator+ |
| PATCH | `/api/admin/intents/:id` | 编辑意图 | super_admin |
| POST | `/api/admin/intents/:id/toggle` | 启用/禁用 | super_admin |
| POST | `/api/admin/intents/test` | 测试匹配 | operator+ |

#### 系统监控

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/monitoring/queues` | 队列状态 | operator+(只读) |
| GET | `/api/admin/monitoring/queues/:name/dead-letter` | 死信队列详情 | super_admin |
| POST | `/api/admin/monitoring/queues/:name/retry` | 手动重试死信任务 | super_admin |
| GET | `/api/admin/monitoring/schedulers` | 定时任务状态 | operator+(只读) |
| GET | `/api/admin/audit-logs` | 审计日志列表 | super_admin |

#### 数据分析

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/analytics/users` | 用户分析数据 | operator+ |
| GET | `/api/admin/analytics/orders` | 订单分析数据 | operator+ |
| GET | `/api/admin/analytics/batches` | 批次分析数据 | operator+ |
| GET | `/api/admin/analytics/products` | 商品分析数据 | operator+ |
| GET | `/api/admin/analytics/finance` | 财务分析数据 | finance+ |

---

## 6. 界面设计规范

### 6.1 整体布局

```
┌──────────────────────────────────────────────────────────────┐
│  顶栏：Logo + 系统名称        告警横幅（异常时显示）           │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                   │
│  侧边栏   │              主内容区                              │
│  (240px) │                                                   │
│          │  ┌─────────────────────────────────────────────┐  │
│ 仪表盘    │  │  面包屑导航                                  │  │
│ 订单管理  │  ├─────────────────────────────────────────────┤  │
│ 批次查看  │  │                                             │  │
│ 用户管理  │  │  筛选/搜索区域                                │  │
│ 集采对接  │  │                                             │  │
│ 商品管理  │  │  数据表格 / 卡片列表 / 图表                   │  │
│ 财务管理  │  │                                             │  │
│ 推荐运营  │  │                                             │  │
│ 内容通知  │  │                                             │  │
│ 系统监控  │  │                                             │  │
│ 数据分析  │  ├─────────────────────────────────────────────┤  │
│ ─────── │  │  分页器                                      │  │
│ 系统设置  │  └─────────────────────────────────────────────┘  │
│ 审计日志  │                                                   │
│          │                                                   │
│ 底部：管理员信息 + 退出  │                                     │
└──────────┴───────────────────────────────────────────────────┘
```

### 6.2 设计原则

| 原则 | 说明 |
|------|------|
| **信息密度优先** | 管理后台面向专业人员，优先展示更多信息，减少留白 |
| **操作效率优先** | 常用操作一键可达，支持键盘快捷键，批量操作 |
| **状态可见** | 所有数据的状态、操作结果必须即时反馈 |
| **防误操作** | 危险操作（删除、退款、状态强制推进）必须二次确认 |

### 6.3 色彩体系

与买家端保持一致的品牌色，但整体风格偏专业/沉稳：

| 用途 | 色值 | 说明 |
|------|------|------|
| 品牌主色 | #7C3AED | 与买家端一致 |
| 侧边栏背景 | #1E1B2E | 深紫色（区别于买家端的 #13111A） |
| 主背景 | #F8F9FC | 浅灰白（比买家端更亮） |
| 表格斑马纹 | #F3F4F6 | 交替行背景 |
| 成功/通过 | #10B981 | 与买家端一致 |
| 警告/待处理 | #F59E0B | 与买家端一致 |
| 危险/错误 | #EF4444 | 与买家端一致 |
| 信息/进行中 | #3B82F6 | 蓝色（新增，买家端无） |

### 6.4 组件规范

| 组件 | 规范 |
|------|------|
| 数据表格 | 固定表头、斑马纹、列可排序、行 hover 高亮、操作列固定在右侧 |
| 筛选栏 | 可折叠，已选条件以 Tag 形式展示，支持一键清除 |
| 详情页 | 左右分栏或 Tab 页布局，信息分组展示 |
| 操作确认 | 危险操作使用 Modal 弹窗，需输入原因或确认文字 |
| 状态标签 | 统一圆角标签样式，颜色与买家端订单状态一致 |
| 图表 | 使用 Recharts 或 ECharts，支持时间范围切换 |
| 表单 | 行内编辑优先，复杂表单使用抽屉（Drawer） |

### 6.5 响应式策略

管理后台以 **桌面端为主**（最小宽度 1280px），不强制适配移动端：
- 1280px+：完整侧边栏 + 主内容区
- 1024px–1280px：侧边栏可折叠为图标模式（64px）
- < 1024px：侧边栏隐藏，通过汉堡菜单展开（仅支持查看，不建议操作）

---

## 7. 与现有系统的集成方案

### 7.1 后端集成

```
apps/server/src/api/
├── admin/                    # 新增管理 API 路由组
│   ├── admin-auth.routes.ts
│   ├── admin-dashboard.routes.ts
│   ├── admin-orders.routes.ts
│   ├── admin-batches.routes.ts      # 只读（批次查看）
│   ├── admin-users.routes.ts
│   ├── admin-fulfillment.routes.ts  # 集采对接（订单推送 + 凭据查看）
│   ├── admin-products.routes.ts
│   ├── admin-transactions.routes.ts
│   ├── admin-commissions.routes.ts
│   ├── admin-recommendations.routes.ts
│   ├── admin-announcements.routes.ts
│   ├── admin-intents.routes.ts
│   ├── admin-monitoring.routes.ts
│   ├── admin-analytics.routes.ts
│   └── admin-audit.routes.ts
├── callback/                 # 新增集采系统回调路由组
│   └── callback-fulfillment.routes.ts  # 4 个回调端点
├── middleware/
│   ├── auth.ts               # 现有（买家端 JWT）
│   ├── admin-auth.ts          # 新增（管理员 JWT + 角色校验）
│   ├── callback-signature.ts  # 新增（HMAC-SHA256 签名验证）
│   ├── audit.ts               # 新增（审计日志中间件）
│   └── rateLimit.ts           # 现有
```

### 7.2 服务层扩展

```
apps/server/src/services/
├── admin/                    # 新增管理服务
│   ├── admin-order.service.ts     # 跨用户订单查询、强制状态推进
│   ├── admin-batch.service.ts     # 批次只读查看
│   ├── admin-user.service.ts      # 用户管理、角色管理
│   ├── admin-fulfillment.service.ts  # 订单推送到集采系统、推送状态跟踪
│   ├── admin-product.service.ts   # 商品核验、定价覆盖
│   ├── admin-finance.service.ts   # 退款、返佣结算
│   ├── admin-recommendation.service.ts  # 推荐 CRUD
│   ├── admin-analytics.service.ts # 统计分析查询
│   └── audit-log.service.ts       # 审计日志
├── callback/                 # 新增回调处理服务
│   └── callback-fulfillment.service.ts  # 处理集采系统回调（批次/履约/采购结果）
```

### 7.3 前端项目结构

```
apps/admin/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # 管理后台布局（侧边栏 + 主区域）
│   │   ├── page.tsx            # 根页面（重定向到 /dashboard）
│   │   ├── login/page.tsx      # 登录页
│   │   ├── dashboard/page.tsx  # 仪表盘
│   │   ├── orders/             # 订单管理
│   │   ├── batches/            # 批次查看（只读）
│   │   ├── users/              # 用户管理
│   │   ├── fulfillment/        # 集采对接（推送 + 凭据 + 回调日志）
│   │   ├── products/           # 商品管理
│   │   ├── finance/            # 财务管理
│   │   ├── recommendations/    # 推荐运营
│   │   ├── content/            # 内容通知
│   │   ├── monitoring/         # 系统监控
│   │   ├── analytics/          # 数据分析
│   │   └── settings/           # 系统设置
│   ├── components/
│   │   ├── layout/             # Sidebar、Header、Breadcrumb
│   │   ├── data-display/       # DataTable、StatCard、Timeline
│   │   ├── forms/              # FilterBar、SearchInput、ConfirmModal
│   │   └── charts/             # LineChart、PieChart、BarChart
│   ├── lib/
│   │   ├── store-auth.ts       # 管理员认证状态
│   │   ├── api.ts              # API 请求封装
│   │   └── permissions.ts      # 权限检查工具函数
│   └── hooks/
│       ├── usePermission.ts    # 权限 Hook
│       └── usePagination.ts    # 分页 Hook
```

### 7.4 数据库迁移

```bash
# 新增字段和表的 Prisma Migration
npx prisma migrate dev --name add_admin_features

# 迁移内容：
# 1. User 表新增 role, isDisabled, disabledAt, disabledBy, disabledReason, lastLoginAt
# 2. 新增 AuditLog 表
# 3. 新增 OrderNote 表
# 4. 新增 Announcement 表
# 5. 新增 OrderFulfillment 表（与 Order 1:1，集采集成状态独立存储）
# 6. 新增 OrderFulfillmentEvidence 表
# 7. 新增 EvidenceAttachment 表
# 8. 新增 CallbackLog 表
# 9. Order 表新增 adminNotes（仅此一个字段，集采字段全部在 OrderFulfillment 表）
```

### 7.5 Docker Compose 扩展

```yaml
# 新增 admin 服务
admin:
  build:
    context: .
    dockerfile: apps/admin/Dockerfile
  ports:
    - "3002:3000"
  environment:
    - NEXT_PUBLIC_API_URL=http://server:3001
  depends_on:
    - server
```

---

## 8. 里程碑规划

| 阶段 | 内容 | 周期 | 交付物 |
|------|------|------|--------|
| **M1 - 基础设施** | RBAC 权限体系 + 管理员登录 + 审计日志 + 布局框架 | 2 周 | 可登录的管理后台骨架，权限中间件 |
| **M2 - 核心运营** | 仪表盘 + 订单管理 + 批次查看（只读） + 用户管理 | 3 周 | 可处理日常运营操作 |
| **M3 - 集采对接** | 订单推送 + 4 个回调接口 + HMAC 签名验证 + 凭据存储 + 集采对接看板 | 3 周 | 与外部集采系统完整对接 |
| **M4 - 业务扩展** | 商品管理 + 财务管理 + 推荐运营 | 2 周 | 商品/财务/推荐管理闭环 |
| **M5 - 运营增强** | 内容通知 + 意图配置 + 系统监控 | 2 周 | 运营工具和自动化 |
| **M6 - 数据分析** | 用户/订单/批次/商品多维度分析 | 2 周 | 全链路可观测 + 数据驱动 |

**总计**：约 14 周

---

*文档结束*
