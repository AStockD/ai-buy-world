# AIBuyWorld — 运营管理平台 产品需求文档

> 版本：v1.0  
> 日期：2026-07-24  
> 状态：初稿  
> 依赖：买家端 PRD（docs/PRD.md v1.1）

---

## 1. 产品概述

### 1.1 产品定位

AIBuyWorld 运营管理平台（以下简称"管理后台"）是面向平台运营团队的内网管理系统。与面向消费者的买家端（`apps/web`）独立部署，通过独立域名/端口访问，共享同一套后端服务和数据库。

### 1.2 核心价值

| 维度 | 说明 |
|------|------|
| **全链路管控** | 订单、批次、用户、商品、财务全生命周期可视可操作 |
| **异常快速响应** | 订单状态强制推进、退款处理、队列监控、死信重试 |
| **数据驱动决策** | GMV/用户/批次多维度分析，实时仪表盘 |
| **运营效率提升** | 批量操作、自动化调度、推荐内容管理 |

### 1.3 目标用户

| 角色 | 使用场景 |
|------|----------|
| **超级管理员** | 系统配置、角色分配、全局数据查看、敏感操作审批 |
| **运营人员** | 订单处理、批次管理、用户管理、推荐运营、通知发布 |
| **买手代理** | 接收集采单、更新采购状态、查看绩效 |
| **财务人员** | 交易对账、退款处理、返佣结算、汇率管理 |

### 1.4 与买家端的关系

```
┌─────────────────────────────────────────────────────────┐
│                    共享基础设施                             │
│  PostgreSQL 16  │  Redis 7  │  BullMQ  │  FlyLink API    │
└────────┬───────────────────────────────┬────────────────┘
         │                               │
    ┌────▼────┐                     ┌────▼────┐
    │ apps/   │                     │ apps/   │
    │ server  │◄────────────────────│ admin   │
    │ (Fastify│   /api/admin/*      │ (Next.js│
    │  后端)  │   管理 API 路由组    │  14)    │
    └────┬────┘                     └─────────┘
         │                              
    ┌────▼────┐                     
    │ apps/   │                     
    │ web     │  买家端（消费者）     
    │ (Next.js│                     
    │  14)    │                     
    └─────────┘                     
```

- **后端共享**：管理后台复用 `apps/server` 的 Fastify 服务，新增 `/api/admin/*` 路由组
- **数据库共享**：同一 PostgreSQL 实例，管理后台可读写所有表
- **前端独立**：`apps/admin` 独立 Next.js 应用，独立部署、独立域名
- **权限隔离**：管理 API 使用独立的 RBAC 中间件，与买家端 JWT 互不兼容

---

## 2. 角色与权限设计

### 2.1 角色定义

| 角色 | 标识 | 权限范围 | 典型用户 |
|------|------|----------|----------|
| **超级管理员** | `super_admin` | 全部功能 + 角色管理 + 系统配置 + 审计日志 | CTO / 技术负责人 |
| **运营人员** | `operator` | 订单/批次/用户/商品/推荐/通知管理，不可修改系统配置 | 运营团队 |
| **买手代理** | `buyer_agent` | 集采单查看/接单/更新状态、个人绩效查看 | 国内买手 |
| **财务人员** | `finance` | 交易查看/退款/返佣结算/汇率管理，不可修改订单状态 | 财务团队 |

### 2.2 权限矩阵

| 功能 | super_admin | operator | buyer_agent | finance |
|------|:-----------:|:--------:|:-----------:|:-------:|
| 仪表盘 | ✅ 全部 | ✅ 全部 | ✅ 个人 | ✅ 财务 |
| 订单管理 | ✅ 全部 | ✅ 全部 | ❌ | 🔍 只读 |
| 批次管理 | ✅ 全部 | ✅ 全部 | 🔍 只读 | ❌ |
| 用户管理 | ✅ 全部 | ✅ 全部 | ❌ | ❌ |
| 买手管理 | ✅ 全部 | ✅ 全部 | 🔍 个人 | ❌ |
| 集采单管理 | ✅ 全部 | ✅ 创建/分配 | ✅ 接单/更新 | ❌ |
| 商品管理 | ✅ 全部 | ✅ 全部 | ❌ | ❌ |
| 财务管理 | ✅ 全部 | ❌ | ❌ | ✅ 全部 |
| 推荐运营 | ✅ 全部 | ✅ 全部 | ❌ | ❌ |
| 内容通知 | ✅ 全部 | ✅ 全部 | ❌ | ❌ |
| 系统监控 | ✅ 全部 | 🔍 只读 | ❌ | ❌ |
| 数据分析 | ✅ 全部 | ✅ 全部 | ❌ | 🔍 财务 |
| 角色管理 | ✅ | ❌ | ❌ | ❌ |
| 审计日志 | ✅ | ❌ | ❌ | ❌ |

### 2.3 数据模型变更

User 表新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `role` | enum | `user`（默认）/ `super_admin` / `operator` / `buyer_agent` / `finance` |
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
| 活跃批次数 | `COUNT(delivery_batches) WHERE status = '集货中'` | 每小时 |
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

### 3.3 批次管理（P0）

#### 3.3.1 批次列表

**筛选**：状态（集货中/已发运/已到达/已完成）、区域、日期范围

**列表字段**：

| 列 | 说明 |
|----|------|
| 批次号 | 如 US-260715 |
| 区域 | 如 Rowland Heights |
| 状态 | 带颜色标签 |
| 订单数 | 当前批次订单数 / 目标订单数 |
| 总货值 | 批次内订单总金额 |
| 代收人 | 姓名 + 联系方式 |
| 截止时间 | orderDeadline |
| 预计发货 | shipDate |
| 操作 | 查看详情 / 推进状态 / 编辑 |

#### 3.3.2 手动创建批次

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 区域名称 | 文本 | ✅ | 如 "Rowland Heights" |
| 提货地址 | 地址选择器 | ✅ | 从 willing 用户地址中选择，或手动输入 |
| 代收人 | 搜索选择 | ✅ | 关联用户（willingToReceiveForOthers = true） |
| 下单截止时间 | 日期时间 | ✅ | 如周日 23:59 |
| 预计发货日期 | 日期 | ✅ | 如周一 |
| 预计到达日期 | 日期 | 否 | 系统根据历史数据估算，可手动覆盖 |

#### 3.3.3 批次详情

| 区域 | 内容 |
|------|------|
| 批次信息 | 批次号、区域、状态、时间线（截止/发货/到达） |
| 代收人信息 | 姓名、联系方式、地址、历史代收次数、评分 |
| 订单列表 | 该批次内所有订单（可点击跳转） |
| 统计信息 | 订单数、总货值、平均客单价、平台占比 |

#### 3.3.4 批次操作

| 操作 | 说明 | 权限 |
|------|------|------|
| 手动推进状态 | 集货中→已发运→已到达→已完成，级联更新订单状态 | operator+ |
| 移入订单 | 将其他批次的订单或无批次的已支付订单移入 | operator+ |
| 移出订单 | 将订单从批次中移除（订单回到无批次状态） | operator+ |
| 编辑批次信息 | 修改截止时间、代收人等（仅集货中状态可编辑） | operator+ |

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
/admin/batches        → operator, super_admin
/admin/users          → operator, super_admin
/admin/buyers         → operator, super_admin, buyer_agent(个人)
/admin/products       → operator, super_admin
/admin/finance        → finance, super_admin
/admin/recommendations→ operator, super_admin
/admin/content        → operator, super_admin
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

### 3.6 买手与集采管理（P1）

#### 3.6.1 买手管理

**买手列表**：

| 列 | 说明 |
|----|------|
| 姓名 | 买手名称 |
| 区域 | 所在区域（如"广东深圳"） |
| 联系方式 | 电话 |
| 状态 | 在线 / 离线 / 暂停（带颜色标签） |
| 今日接单 | currentDailyOrders / maxDailyOrders |
| 评分 | rating（星级展示） |
| 完成率 | completionRate（百分比 + 进度条） |
| 操作 | 编辑 / 切换状态 |

**买手 CRUD**：
- 新增买手：姓名、区域、联系方式、日接单上限
- 编辑买手：修改基本信息和上限
- 状态切换：在线 ↔ 离线 ↔ 暂停

#### 3.6.2 集采单管理

**集采单列表**：

| 列 | 说明 |
|----|------|
| 集采单号 | PO + 日期 + 序号 |
| 关联批次 | 批次号 + 区域 |
| 分配买手 | 买手姓名（未分配显示"待分配"） |
| 订单数 | 包含的订单数量 |
| 采购金额 | 总金额（CNY） |
| 状态 | 待接单 / 采购中 / 已采购 / 异常 |
| 创建时间 | — |
| 操作 | 分配买手 / 查看详情 |

**集采单操作**：

| 操作 | 说明 | 权限 |
|------|------|------|
| 创建集采单 | 选择批次 + 勾选订单 → 生成集采单 | operator+ |
| 分配买手 | 从在线买手中选择，考虑当前接单量和区域匹配 | operator+ |
| 买手接单 | 买手代理确认接单，状态变为"采购中" | buyer_agent |
| 更新采购状态 | 买手更新：部分采购 / 已完成 / 异常（缺货等） | buyer_agent |
| 查看明细 | 查看集采单包含的订单列表和商品信息 | operator+ |

#### 3.6.3 买手绩效看板

| 指标 | 说明 |
|------|------|
| 今日接单量 | 当日已接单数 / 上限 |
| 本周完成率 | 已完成集采单 / 总分配数 |
| 平均采购时长 | 从接单到标记已采购的平均耗时 |
| 异常率 | 异常集采单 / 总集采单 |
| 评分趋势 | 近 30 天评分折线图 |

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

### 4.2 修改表

#### 4.2.1 User 表新增字段

见 §2.3

#### 4.2.2 Order 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| adminNotes | string | 运营备注（简短备注，复杂备注用 OrderNote 表） |

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
| POST | `/api/admin/orders/:id/reassign-batch` | 调整批次 | operator+ |
| POST | `/api/admin/orders/batch-transition` | 批量推进状态 | operator+ |
| POST | `/api/admin/orders/batch-assign` | 批量分配批次 | operator+ |
| GET | `/api/admin/orders/export` | 导出 CSV | operator+ |

#### 批次管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/batches` | 批次列表 | operator+ |
| GET | `/api/admin/batches/:id` | 批次详情 | operator+ |
| POST | `/api/admin/batches` | 创建批次 | operator+ |
| PATCH | `/api/admin/batches/:id` | 编辑批次 | operator+ |
| POST | `/api/admin/batches/:id/advance` | 推进批次状态 | operator+ |
| POST | `/api/admin/batches/:id/orders/add` | 移入订单 | operator+ |
| POST | `/api/admin/batches/:id/orders/remove` | 移出订单 | operator+ |

#### 用户管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/users` | 用户列表 | operator+ |
| GET | `/api/admin/users/:id` | 用户详情 | operator+ |
| PATCH | `/api/admin/users/:id/disable` | 禁用账号 | operator+ |
| PATCH | `/api/admin/users/:id/enable` | 启用账号 | operator+ |
| POST | `/api/admin/users/:id/reset-password` | 重置密码 | super_admin |
| PATCH | `/api/admin/users/:id/receiver` | 标记代收人 | operator+ |

#### 买手管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/buyers` | 买手列表 | operator+ |
| POST | `/api/admin/buyers` | 创建买手 | operator+ |
| PATCH | `/api/admin/buyers/:id` | 编辑买手 | operator+ |
| PATCH | `/api/admin/buyers/:id/status` | 切换状态 | operator+ |
| GET | `/api/admin/buyers/:id/performance` | 绩效数据 | operator+ |

#### 集采单管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/admin/purchase-orders` | 集采单列表 | operator+ |
| POST | `/api/admin/purchase-orders` | 创建集采单 | operator+ |
| POST | `/api/admin/purchase-orders/:id/assign` | 分配买手 | operator+ |
| PATCH | `/api/admin/purchase-orders/:id/status` | 更新状态 | buyer_agent |

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
│ 批次管理  │  │                                             │  │
│ 用户管理  │  │  筛选/搜索区域                                │  │
│ 买手管理  │  │                                             │  │
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
│   ├── admin-batches.routes.ts
│   ├── admin-users.routes.ts
│   ├── admin-buyers.routes.ts
│   ├── admin-purchase-orders.routes.ts
│   ├── admin-products.routes.ts
│   ├── admin-transactions.routes.ts
│   ├── admin-commissions.routes.ts
│   ├── admin-recommendations.routes.ts
│   ├── admin-announcements.routes.ts
│   ├── admin-intents.routes.ts
│   ├── admin-monitoring.routes.ts
│   ├── admin-analytics.routes.ts
│   └── admin-audit.routes.ts
├── middleware/
│   ├── auth.ts               # 现有（买家端 JWT）
│   ├── admin-auth.ts          # 新增（管理员 JWT + 角色校验）
│   ├── audit.ts               # 新增（审计日志中间件）
│   └── rateLimit.ts           # 现有
```

### 7.2 服务层扩展

```
apps/server/src/services/
├── admin/                    # 新增管理服务
│   ├── admin-order.service.ts     # 跨用户订单查询、强制状态推进
│   ├── admin-batch.service.ts     # 批次创建、编辑、订单调整
│   ├── admin-user.service.ts      # 用户管理、角色管理
│   ├── admin-buyer.service.ts     # 买手 CRUD、绩效管理
│   ├── admin-product.service.ts   # 商品核验、定价覆盖
│   ├── admin-finance.service.ts   # 退款、返佣结算
│   ├── admin-recommendation.service.ts  # 推荐 CRUD
│   ├── admin-analytics.service.ts # 统计分析查询
│   └── audit-log.service.ts       # 审计日志
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
│   │   ├── batches/            # 批次管理
│   │   ├── users/              # 用户管理
│   │   ├── buyers/             # 买手管理
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
# 5. Order 表新增 adminNotes
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
| **M2 - 核心运营** | 仪表盘 + 订单管理 + 批次管理 + 用户管理 | 3 周 | 可处理日常运营操作 |
| **M3 - 业务扩展** | 买手管理 + 集采单 + 商品管理 + 财务管理 | 3 周 | 完整业务管理闭环 |
| **M4 - 运营增强** | 推荐运营 + 内容通知 + 意图配置 | 2 周 | 运营工具和自动化 |
| **M5 - 监控分析** | 系统监控 + 数据分析 + 审计日志查看 | 2 周 | 全链路可观测 |

**总计**：约 12 周

---

*文档结束*
