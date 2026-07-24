# HiGoBuy 海卖购 — AI购物助手 产品需求文档 (PRD)

> 版本：v1.0  
> 日期：2026-07-21  
> 状态：初稿  

---

## 1. 产品概述

### 1.1 产品定位

HiGoBuy（海卖购）是一款面向海外华人（首发美国市场）的 **AI 对话式跨境购物助手**。用户通过聊天界面粘贴中国电商平台（淘宝、天猫、京东、拼多多）商品链接，AI 自动完成商品解析、价格换算、集运报价、下单支付和物流追踪的全链路服务。

### 1.2 核心价值主张

| 维度 | 说明 |
|------|------|
| **零门槛购物** | 粘贴链接即可下单，无需注册中国电商平台账号、无需中国支付工具 |
| **区域智能集运** | 按周集中同一目的国所有订单批量发货，单件即享批量运价，节省 30–50% 运费 |
| **AI 全程陪伴** | 从选品到收货，AI 助手实时响应、主动通知、智能推荐 |
| **透明定价** | 商品货款 + 集运费分开结算，价格换算公开透明 |

### 1.3 目标用户

| 用户画像 | 描述 |
|----------|------|
| **主力用户** | 定居美国的华人（旧金山、纽约、洛杉矶等），有中国电商购物习惯 |
| **典型场景** | 购买淘宝/京东商品但缺乏直邮美国或中国支付手段 |
| **年龄层** | 20–45 岁，熟悉移动互联网和社交媒体 |
| **消费特征** | 注重性价比，对运费敏感，倾向拼单集运 |

### 1.4 商业模式

- **商品货款**：由买手代为采购，货款归买手
- **集运运费**：归平台所有，按重量/品类计费
- **社区返佣**：用户分享商品链接，好友通过链接下单后推荐人获得返佣（如 $ 2/单）

---

## 2. 功能架构

```
HiGoBuy
├── 对话式购物主流程
│   ├── 商品链接解析（Flylink 引擎）
│   ├── 商品详情展示
│   ├── 智能地址推荐
│   ├── 支付结算
│   └── 下单成功 & 物流追踪
├── 心愿单管理
├── 订单管理
├── 社区好物推荐
├── 运费计算工具
├── 购物指南
└── 用户系统
    ├── 个人资料
    ├── 收货地址管理
    └── 对话历史
```

---

## 3. 核心功能模块详细需求

### 3.1 Flylink 商品链接解析引擎

**概述**：Flylink 是平台核心技术模块，负责将中国电商平台的商品链接转化为标准化的、可支付的商品资产。

**支持平台**：
- 淘宝（taobao.com / tb.cn / t.cn）
- 天猫（tmall.com）
- 京东（jd.com / j.cn）
- 拼多多（pinduoduo.com）— 规划中

**输入形式**：
- 完整商品 URL
- 短链接（shortened URL）
- 淘宝口令（如 `¥AbCd1234¥`）

**处理流程**（5 步）：

| 步骤 | 说明 | 状态展示 |
|------|------|----------|
| 1. 来源识别 | 识别商品所属电商平台 | ✅ 即时完成 |
| 2. 数据抓取 | 抓取商品名称、价格、库存、图片、规格等 | ⏳ 进行中 → ✅ |
| 3. 多语言资产生成 | 生成中文/英文/马来文商品描述 | ◯ → ✅ |
| 4. AI 质检核验 | 验证商品真实性、评估卖家信誉 | ◯ → ✅ |
| 5. 创建可支付资产 | 生成平台内标准化商品记录，含本地化定价 | ◯ → ✅ |

**输出**：
- 标准化商品卡片（含图片、名称、价格、评分、销量、重量、库存状态）
- **商品规格/SKU 列表**（颜色、尺寸、型号等，含每个规格的价格差异和库存状态）
- 本地化定价（美元 $）
- 区域集运费报价
- AI 核验通过标识

**性能要求**：
- 全流程解析时间 ≤ 3 秒
- 进度条动画与步骤状态实时更新
- 失败时给出明确错误提示（如链接失效、商品下架）

---

### 3.2 商品详情卡片

**展示信息**：

| 字段 | 说明 |
|------|------|
| 商品图片 | 主图展示，支持大图预览 |
| 来源标识 | 角标显示来源平台（淘宝/天猫/京东） |
| AI 核验标识 | "✅ AI 核验通过" 绿色角标 |
| 商品名称 | 完整商品名称 |
| **规格选择器** | **颜色/尺寸/型号等 SKU 选项，点击切换后实时更新价格和重量** |
| 价格信息 | 本地化价格（$）+ 原价（¥）对比（随规格变化） |
| 元数据行 | 评分、已售数量、重量、库存状态（随规格变化） |
| 费用明细 | 商品货款 + 区域集运费 + 合计支付 |
| 操作按钮 | 立即购买 / 加入心愿单 / 分享 |

**规格选择交互**：

```
┌─────────────────────────────────────────────┐
│  📐 选择规格                                  │
│                                               │
│  颜色：                                       │
│  [● 白色]  [○ 黑色]  [○ 红色]  [○ 蓝色]       │
│                                               │
│  尺码：                                       │
│  [○ US 6]  [● US 8]  [○ US 9]  [○ US 10]    │
│                                               │
│  💡 不同规格可能影响价格和重量，                 │
│     集运费将按实际重量重新计算                   │
└─────────────────────────────────────────────┘
```

**规格选择规则**：
- 若商品链接已包含默认规格（如用户发送的链接自带颜色/尺寸参数），自动预选
- 若商品只有一个 SKU（无规格选项），跳过规格选择步骤
- 切换规格后，价格、重量、库存状态实时更新
- 若所选规格无库存，该选项置灰并标注"无货"
- 用户未选完所有规格维度时，"立即购买"按钮置灰

**交互**：
- 选择规格 → 价格/重量实时更新 → "立即购买" → 进入地址确认流程
- "❤️" → 加入心愿单，AI 回复确认并更新心愿单计数
- "📤" → 生成分享链接，提示社区返佣信息

---

### 3.3 家庭地址与提货地址

#### 3.3.1 概念区分

本系统涉及三种地址角色，理解它们的关系是理解下单流程的关键：

| | 家庭地址 | 提货地址 | 集运批次 |
|---|---|---|---|
| **定义** | 用户自己填写的居住地址 | 某位用户（或家人/朋友/社区团长）的家庭地址，被系统选为该批次的包裹汇集点 | 平台按周和区域组织的集运单元，每个批次有一个提货地址 |
| **来源** | 用户自行填写/管理 | 从订单聚类中动态产生，不是平台固定站点 | 系统根据实时订单数据自动生成 |
| **联系人** | 用户本人 | 住在那个地址的人（代收人） | — |
| **生命周期** | 长期（搬家时才改） | 按批次产生，每周可能不同 | 按周循环 |

**核心理解**：提货地址不是一个仓库或物流站点，而是**某位真实用户的家庭地址**。因为该区域本周订单量大，系统将其选为这批包裹的汇集点，由住在那里的人代为收货，其他同批次用户自行前往提货或等待二次配送。

#### 3.3.2 "代他人收货" 机制

系统要运转这个模型，需要用户自愿参与：

- 用户在下单时可以选择 **"我愿意代他人收货"**
- 选择后，该用户的家庭地址有概率被系统选为未来某批次的提货地址
- 作为回报，代收货用户可享受 **集运费折扣**
- 代收人负责在约定时间接收包裹并通知同批次其他用户来取

**下单时的选项**：

```
┌─────────────────────────────────────────────┐
│  📦 是否愿意代他人收货？                       │
│                                               │
│  ○ 不愿意（默认）                              │
│    包裹直接配送到我的家庭地址                    │
│                                               │
│  ● 愿意                                       │
│    我的地址可能成为社区提货点，                   │
│    帮邻居代收包裹，享受集运费 8 折优惠            │
│                                               │
│  💡 选择"愿意"不影响本次订单的配送地址            │
│     仅用于未来批次匹配参考                       │
└─────────────────────────────────────────────┘
```

#### 3.3.3 下单时的批次推荐流程

```
用户点击"立即购买"
    ↓
系统读取用户地址簿：
  ├── 若只有一个地址 → 直接使用
  └── 若有多个地址 → 弹出地址选择（默认选中 isDefault=true 的地址）
    ↓
用户确认/切换本次下单使用的家庭地址
    ↓
系统根据 [所选地址区域 + 本周已有集运批次数据] 推荐批次
    ↓
用户从推荐列表中选择一个批次（每个批次对应一个提货地址）
    ↓
展示"是否愿意代他人收货"选项（仅更新意愿，不影响本次订单）
    ↓
进入支付流程
```

**关键点**：
- 用户不需要填写或选择提货地址，只需要选择加入哪个集运批次。每个批次已经有一个提货地址和代收人。
- 若用户有多个家庭地址，系统默认使用标记为 `isDefault=true` 的地址进行批次匹配，但允许用户在下单时切换为地址簿中的其他地址。切换后批次推荐列表会实时刷新。

#### 3.3.4 批次推荐逻辑

系统将同区域、同时段的订单聚类为批次，每个批次自动产生一个提货地址。推荐维度：

| 推荐策略 | 说明 | 标签示例 |
|----------|------|----------|
| 运费最优 | 该批次订单量最大，单件分摊运费最低 | "与本周 18 件订单同批次 · 运费最优" |
| 货值保障 | 该批次总货值最高，享优先配送保障 | "本批次货值最高 $ 2,800 · 优先配送" |
| 货量最大 | 该批次包裹最多，末端配送效率最高 | "本周货量最大 47 件 · 单件运费最低" |

**每个推荐项展示**：
- 提货地址所在区域（如 "Rowland Heights 批次"）
- 代收人称呼（如 "张伟（您的地址）" 或 "李明 先生"）
- 当前批次订单数和总货值
- 推荐理由（含具体数据）
- 预计发货和到货时间
- 选中状态指示

**推荐数据更新**：每小时刷新，基于各批次当前订单量、货值、配送排期等实时计算。

#### 3.3.5 提货与末端配送

```
包裹到达目的国 → 分配至用户选择的批次
    ↓
整批包裹送达该批次的提货地址（代收人家中）
    ↓
代收人确认收货 → 平台通知同批次其他用户
    ↓
其他用户前往提货地址自提 / 代收人分发
```

---

### 3.4 支付结算

**支付卡片展示**：
- 顶部大字显示合计金额
- 商品名称摘要
- 费用明细：商品货款 / 区域集运费 / 合计
- 集运匹配信息（如"已加入本周 Rowland Heights 批次 · 代收人：张伟"）
- 下次发货时间提示

**支付方式**：

| 方式 | 说明 |
|------|------|
| 信用卡/借记卡 | Visa / Mastercard / Amex（默认选中） |
| PayPal | 国际支付 |
| Zelle | 美国本地即时转账 |
| Apple Pay | 移动端快捷支付 |

**交互流程**：
1. 选择支付方式（点击切换，高亮选中）
2. 点击"确认支付"按钮
3. 调用支付网关完成扣款
4. 展示支付成功卡片

---

### 3.5 订单管理

**订单卡片展示**：

| 元素 | 说明 |
|------|------|
| 订单号 | 格式 HG + 日期 + 序号（如 HG2607120001） |
| 状态标签 | 待支付 / 集货中 / 运输中 / 待提货 / 已提货 |
| 物流时间线 | 5 步时间线，含完成/进行中/待处理状态 |
| 商品信息行 | 商品缩略图 + 名称 + 费用明细 + 支付状态 |

**物流时间线节点**：

| 节点 | 说明 |
|------|------|
| 已下单 / 买手接单 | 订单创建，买手开始采购 |
| 国内集货中 | 商品在国内（中国）集运仓汇集，等待同批次所有商品到齐 |
| 国际发运 | 每周一统一发出，国际物流段（中国 → 目的国） |
| 到达目的国 | 清关完成，包裹到达目的国 |
| 末端配送 | 整批包裹送达提货地址（代收人家中），通知用户提货 |

**状态标签颜色**：
- 待支付：灰色
- 集货中（含已下单、国内集货）：橙色/黄色
- 运输中（含国际发运、到达目的国）：紫色
- 待提货（批次已送达提货地址）：蓝色
- 已提货（用户已取件）：绿色

**触发方式**：
- 用户主动查询（说"查看订单"等）
- 下单成功后自动展示
- 状态变更时 AI 主动通知

---

### 3.6 心愿单

**功能说明**：用户可将感兴趣的商品暂存至心愿单，稍后统一或单独下单。

**展示信息**：
- 商品列表（图片、名称、本地化价格、原价）
- 商品数量统计
- 每件商品的操作按钮：购买 / 移除
- "一键全部下单" 按钮

**交互**：
- 从商品卡片点击 ❤️ 加入
- 通过对话"查看心愿单"查看
- 单件购买 → 进入正常下单流程
- 一键下单 → 生成集采购单，买手统一采购
- 移除商品 → AI 确认并更新计数

**数据来源**：
- 侧边栏显示心愿单商品数量（badge）
- 欢迎页展示心愿单商品数

---

### 3.7 社区好物推荐

**概述**：基于目的国（如美国）华人社区的真实购买数据，生成周度热购榜单。

**展示形式**：
- 2×2 网格卡片布局
- 每个商品卡片：图片 + 名称 + 本地化价格 + 原价 + 热度标签
- 热度标签类型：购买人数、区域热购、社区推荐、送礼首选等
- 底部注明"本周真实购买数据"

**交互**：
- 点击商品卡片 → 引导用户发送商品链接进行购买
- "查看全部" → 展开完整榜单
- 侧边栏快捷入口

---

### 3.8 运费计算

**概述**：展示区域智能集运的费率体系，帮助用户了解运费构成。

**费率分类（以美国为例）**：

| 品类 | 费率 | 时效 |
|------|------|------|
| 普通商品 | $ 3–6 / kg | 10–15 个工作日 |
| 大件商品 | $ 2–4 / kg | 12–18 个工作日 |
| 精品/易碎 | $ 5–9 / kg | 含防护包装 |
| 不可邮品 | 不可寄送 | 液体/食品/药品等 |

**集运机制说明**：
- 每周一统一发货
- 下单截止时间为前一周日 23:59
- 区域集运相比单件邮寄节省 30–50%

---

### 3.9 对话系统

#### 3.9.1 对话界面

**布局结构**：
- 左侧边栏（256px）：品牌标识、新对话按钮、最近对话列表、购物快捷入口、用户信息
- 主区域：顶部标题栏 + 消息流 + 底部输入区

**消息类型**：
- 用户消息：紫色渐变气泡，右对齐
- AI 消息：白色气泡 + AI 头像，左对齐
- 富卡片消息：商品卡、订单卡、支付卡、推荐卡等
- 打字指示器：三点跳动动画

**输入区**：
- 多行文本框（自动扩展，最大 120px）
- 快捷标签栏（查看订单 / 好物推荐 / 计算运费 / 示例链接）
- 图片上传按钮（规划中）
- 发送按钮
- 底部免责声明："AI 生成内容仅供参考，下单前请核实商品信息"

**交互细节**：
- Enter 发送，Shift+Enter 换行
- AI 回复前显示打字指示器
- AI 回复支持 👍/👎 反馈
- 打字机效果（历史对话回放时）

#### 3.9.2 意图识别

AI 需识别以下用户意图并触发对应流程：

| 意图 | 触发关键词示例 | 响应 |
|------|---------------|------|
| 商品链接 | taobao.com, jd.com, 淘宝口令 | Flylink 解析 → 商品卡片 |
| 订单查询 | 订单、物流、快递、包裹、发货 | 展示订单列表卡片 |
| 心愿单 | 心愿、收藏、wishlist | 展示心愿单卡片 |
| 好物推荐 | 推荐、热门、好物、trending | 展示社区热购榜 |
| 运费查询 | 运费、shipping、集运、费用 | 展示费率卡片 |
| 购物指南 | 怎么、如何、指南、流程 | 展示 4 步购物流程说明 |
| 问候 | 你好、hello、hi、在吗 | 个性化问候 + 功能引导 |
| 地址确认 | 确认、好、ok、用这个 | 确认地址 → 进入支付 |
| 默认 | 其他 | 引导用户发送链接或选择功能 |

#### 3.9.3 对话历史

- 侧边栏展示最近对话列表（含标题 + 时间）
- 点击历史对话可回放完整对话（打字机效果）
- 支持"新对话"清空当前对话回到欢迎页

---

### 3.10 欢迎页

**展示内容**：
- 品牌 Logo + 欢迎语
- 产品简介（一句话说明核心功能）
- 4 个快捷入口卡片：
  1. 粘贴商品链接
  2. 查询我的订单
  3. 查看心愿单
  4. 社区好物推荐
- 底部提示：支持淘宝口令

---

### 3.11 用户系统

**用户信息展示**（侧边栏底部）：
- 头像（首字母）
- 用户名
- 位置标识（如"📍 美国 · Rowland Heights, CA"）
- 设置入口

**用户数据**：
- 个人资料（姓名、位置、默认地址）
- 收货地址簿
- 对话历史
- 心愿单
- 订单记录

---

### 3.12 通知系统

**AI 主动通知场景**：
- 订单状态变更（下单成功、集货完成、发货、到达、派送中）
- 心愿单商品价格变动
- 社区热购榜单更新（周度）
- 集运批次即将截止提醒

**通知方式**：
- 对话内消息推送
- 未来扩展：Push 通知、邮件、短信

---

## 4. 非功能需求

### 4.1 性能

| 指标 | 要求 |
|------|------|
| Flylink 解析耗时 | ≤ 3 秒 |
| AI 响应时间 | 首字输出 ≤ 1 秒 |
| 页面加载时间 | ≤ 2 秒 |
| 消息渲染帧率 | ≥ 30fps（动画流畅） |

### 4.2 多语言

- 界面语言：中文（简体）为主，后续支持英文、马来文
- AI 对话：支持中英混合输入
- 商品信息：Flylink 生成多语言版本（EN / ZH / MS）

### 4.3 安全

- 支付信息加密传输（TLS 1.3）
- 用户数据隔离
- 支付网关合规（PCI DSS）
- 商品信息核验防欺诈

### 4.4 可扩展性

- 支持新增电商平台（拼多多等）
- 支持新增目的国（加拿大、澳大利亚、日本等）
- 支持新增支付方式
- 运费费率可按区域动态配置

---

## 5. 业务流程

### 5.1 主购物流程

```
用户粘贴商品链接
    ↓
Flylink 解析（5步）
    ↓
展示商品卡片（含本地化价格 + 集运费）
    ↓
用户选择商品规格（颜色/尺寸等）→ 价格/重量实时更新
    ↓
用户点击"立即购买"
    ↓
选择/确认本次下单使用的家庭地址（多地址时弹出选择，默认 isDefault）
    ↓
系统推荐集运批次（基于所选地址区域 + 实时订单聚类）
    ↓
用户选择一个批次（每个批次有对应的提货地址和代收人）
    ↓
选择是否"愿意代他人收货"（仅更新意愿，不影响本次订单）
    ↓
展示支付卡片（费用明细 + 批次信息 + 支付方式）
    ↓
用户确认支付
    ↓
支付成功 → 生成订单 → 订单归入所选批次
    ↓
买手采购 → 国内集货 → 国际发运 → 到达目的国 → 清关
    ↓
整批包裹送达提货地址（代收人家中）
    ↓
代收人确认收货 → 通知同批次用户 → 用户凭取件码自提
```

### 5.2 心愿单购买流程

```
用户浏览商品 → 加入心愿单
    ↓
查看心愿单 → 单件购买 / 一键全部下单
    ↓
生成集采购单 → 买手统一采购
    ↓
后续同主流程（地址确认 → 支付 → 物流）
```

### 5.3 订单追踪流程

```
用户查询订单 / AI 主动通知
    ↓
展示订单卡片（含时间线）
    ↓
状态变更时 AI 在对话中推送更新
```

---

## 6. 数据模型（核心实体）

> **设计原则**：商品本身只存储来源平台的原始信息（含源币种原价），本地化定价（币种、价格、运费）通过独立的 **ProductPricing** 按区域管理。同一商品可面向不同国家/地区展示不同币种和价格。订单中保存下单时的定价快照，确保历史数据不受后续调价影响。

### 6.1 商品 (Product)

商品是来源平台商品的唯一映射，只记录原始信息，不绑定任何目的国定价。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 平台内商品 ID |
| sourcePlatform | enum | 淘宝/天猫/京东/拼多多 |
| sourceUrl | string | 原始商品链接 |
| name | string | 商品名称（原文） |
| sourcePrice | decimal | 来源平台原价 |
| sourceCurrency | string | 源币种，如 CNY |
| weight | string | 重量（如 "0.8kg"） |
| weightKg | decimal | 重量千克数（用于运费计算） |
| rating | decimal | 评分 |
| salesCount | int | 销量 |
| stockStatus | enum | 有货/无货/预售 |
| imageUrl | string | 主图 URL |
| skuVariants | json | **商品规格列表，见下方结构说明** |
| multiLangAssets | json | 多语言描述 {zh, en, ms, ...} |
| verifiedStatus | enum | 待核验/已通过/未通过 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

**skuVariants 结构说明**：

商品规格以维度（dimension）+ 选项（option）的二级结构存储。每个最终组合（SKU）有独立的价格偏移、重量和库存。

```json
{
  "dimensions": [
    { "key": "color", "label": "颜色", "options": ["白色", "黑色", "红色", "蓝色"] },
    { "key": "size", "label": "尺码", "options": ["US 6", "US 8", "US 9", "US 10"] }
  ],
  "skus": [
    { "id": "sku_001", "specs": {"color": "白色", "size": "US 8"},  "priceDelta": 0,    "weightKg": 0.8, "stock": "有货", "imageUrl": "..." },
    { "id": "sku_002", "specs": {"color": "白色", "size": "US 9"},  "priceDelta": 0,    "weightKg": 0.85, "stock": "有货", "imageUrl": "..." },
    { "id": "sku_003", "specs": {"color": "黑色", "size": "US 8"},  "priceDelta": 0,    "weightKg": 0.8, "stock": "有货", "imageUrl": "..." },
    { "id": "sku_004", "specs": {"color": "红色", "size": "US 10"}, "priceDelta": 10,   "weightKg": 0.9, "stock": "无货", "imageUrl": "..." }
  ]
}
```

- `priceDelta`：相对基础价 `sourcePrice` 的偏移量（CNY），正数加价、负数减价
- 用户切换规格时，前端实时计算：`当前规格价格 = sourcePrice + priceDelta`，再走 ProductPricing 换算为本地币种
- 重量同理：`当前规格重量`直接取 sku 的 `weightKg`（绝对值）
- 若商品无规格选项（单 SKU），`skuVariants` 为 null，直接使用 Product 基础字段

### 6.2 区域定价 (ProductPricing)

每个商品 × 每个目的国/地区 对应一条定价记录。这是"同一商品多国多币种"的核心。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 定价记录 ID |
| productId | string | 关联商品 ID |
| region | string | 目的国/地区代码，如 US / MY / AU |
| currency | string | 本地币种代码，如 USD / MYR / AUD |
| currencySymbol | string | 币种符号，如 $ / RM / A$ |
| localPrice | decimal | 本地化售价（含平台加价/汇率换算） |
| shippingRatePerKg | decimal | 该区域每公斤集运单价 |
| shippingCategory | enum | 普通/大件/精品易碎/不可邮 |
| estimatedShippingFee | decimal | 预估集运费（基于商品重量计算） |
| exchangeRateSnapshot | decimal | **当前生效的平台结算汇率（见 6.2.1 汇率机制）** |
| exchangeRateSource | enum | **汇率来源：15日最高 / 当前+5%** |
| exchangeRateUpdatedAt | datetime | 汇率最近一次更新时间 |
| markupRate | decimal | 平台加价率（服务成本、利润等，与汇率机制独立） |
| status | enum | 生效/停用 |
| effectiveFrom | datetime | 生效时间 |
| effectiveTo | datetime | 失效时间（null = 长期有效） |
| createdAt | datetime | 创建时间 |

**唯一约束**：`(productId, region, status=生效)` 同时只有一条生效记录。

**定价公式**：
```
localPrice = (sourcePrice / exchangeRateSnapshot) × (1 + markupRate)
estimatedShippingFee = weightKg × shippingRatePerKg
totalAmount = localPrice + estimatedShippingFee
```

> **公式说明**：`sourcePrice` 为来源平台原价（CNY），`exchangeRateSnapshot` 为平台结算汇率（1 单位外币 = X CNY），除以汇率将 CNY 转换为本地币种，再乘以加价率得到最终本地售价。

#### 6.2.1 汇率管理机制

**核心原则**：平台收取用户的外币（如 USD），需要兑换为 CNY 支付给国内卖家。汇率策略的目标是确保平台在汇兑环节始终有正向收益。

**汇率计算流程**：

```
每日定时任务（或手动触发）
    ↓
Step 1: 获取近 15 天每日市场中间价汇率（来源：Open Exchange Rates / 银行牌价）
    ↓
Step 2: 取 15 天内对平台最有利的汇率作为 R_best
    （即：1 单位外币可兑换最多 CNY 的汇率，平台收取外币后换回 CNY 收益最高）
    ↓
Step 3: 获取当前市场汇率 R_now
    ↓
Step 4: 计算偏差率 = |R_best - R_now| / R_best
    ↓
Step 5: 判定结算汇率 R_settle：
    ├── 偏差率 ≤ 5% → R_settle = R_best
    │   （市场波动小，直接沿用最有利汇率，差额为平台汇兑收益）
    └── 偏差率 > 5% → R_settle = R_now × (1 + 5%)
        （市场波动大，以当前汇率上浮 5% 作为保底汇兑收益）
    ↓
Step 6: 更新所有 ProductPricing 的 exchangeRateSnapshot = R_settle
    ↓
Step 7: 联动更新所有商品的 localPrice
```

**数值示例**（以 USD/CNY 为例，平台视角：收取 USD，兑换为 CNY 付给卖家）：

| 日期 | 市场中间价 (1 USD = ? CNY) | 说明 |
|------|---------------------------|------|
| 7月1日 | 7.28 | |
| 7月3日 | 7.31 | |
| 7月5日 | 7.35 | ← 15天内最高 (R_best) |
| 7月8日 | 7.22 | |
| 7月10日 | 7.18 | |
| 7月12日 | 7.10 | |
| 7月14日 | 7.05 | ← 当前 (R_now) |

```
R_best = 7.35（7月5日，平台收 1 USD 可换 7.35 CNY，收益最高）
R_now  = 7.05（当前市场汇率）
偏差率 = |7.35 - 7.05| / 7.35 = 4.08% ≤ 5%

→ R_settle = R_best = 7.35
→ 平台按 7.35 给用户定价（用户每付 1 USD，平台换算为 ¥7.35）
→ 实际兑换时按 7.05 换回 CNY
→ 差额 0.30 CNY/USD 为平台汇兑收益
```

**若市场大幅波动**：

```
假设 R_now = 6.90
偏差率 = |7.35 - 6.90| / 7.35 = 6.12% > 5%

→ R_settle = 6.90 × 1.05 = 7.245
→ 平台按 7.245 给用户定价
→ 保证至少 5% 汇兑收益空间
```

**汇率锁价规则**：

| 环节 | 汇率使用 | 说明 |
|------|----------|------|
| 商品浏览 | exchangeRateSnapshot | 展示用，非锁定 |
| 点击"立即购买" | 锁定当前 exchangeRateSnapshot | 锁价窗口 15 分钟 |
| 支付完成 | 写入 Order.exchangeRate | 最终锁定，不再变动 |
| 锁价超时 | 刷新为最新 exchangeRateSnapshot | 提示用户汇率已更新 |

**汇率更新策略**：

| 策略 | 说明 |
|------|------|
| 定时更新 | 每日 UTC 00:00 自动重算 |
| 阈值触发 | 市场汇率单日波动超过 2% 时触发即时重算 |
| 手动更新 | 运营人员可手动触发重算 |
| 更新通知 | 汇率变动导致商品价格变化超过 3% 时，通知受影响心愿单用户 |

### 6.3 订单 (Order)

订单保存下单时的**定价快照**，确保即使后续调价或汇率变动，历史订单金额不变。同时记录用户家庭地址（快照）和所属集运批次的关联。

| 字段 | 类型 | 说明 |
|------|------|------|
| orderNo | string | 订单号（HG + 日期 + 序号） |
| userId | string | 用户 ID |
| productId | string | 商品 ID |
| selectedSkuId | string | **用户选择的规格 SKU ID（null = 无规格商品）** |
| pricingId | string | **下单时使用的 ProductPricing ID（快照）** |
| region | string | **目的国/地区（快照）** |
| currency | string | **订单币种（快照），如 USD** |
| currencySymbol | string | **币种符号（快照），如 $** |
| status | enum | 待支付/已下单/集货中/运输中/待提货/已提货 |
| productPrice | decimal | 商品货款（本地币种，快照） |
| shippingFee | decimal | 集运费（本地币种，快照） |
| totalAmount | decimal | 合计金额（本地币种，快照） |
| sourcePrice | decimal | 源币种原价（用于买手采购参考） |
| sourceCurrency | string | 源币种（如 CNY） |
| exchangeRate | decimal | 下单时汇率（快照） |
| paymentMethod | enum | 信用卡/PayPal/Zelle/ApplePay |
| homeAddress | Address | **用户家庭地址（结构化快照），见 6.14** |
| deliveryBatchId | string | **所属集运批次 ID，关联 DeliveryBatch** |
| willingToReceiveForOthers | boolean | **下单时用户是否选择"愿意代他人收货"** |
| pickupCode | string | **取件码（批次到达提货地址后生成，用户凭此取件）** |
| timeline | json | 物流时间线节点 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### 6.4 集运批次 (DeliveryBatch)

集运批次是系统的核心调度单元。由系统根据实时订单数据按区域和时间自动聚类产生，**不是平台预先设定的固定站点**。每个批次有一个提货地址，该地址是某位已选择"代他人收货"的用户的家庭地址。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 批次 ID（如 US-260715，即美国 7月15日批次） |
| region | string | 目的国/地区代码（如 US） |
| area | string | 批次覆盖的区域名称（如 "Rowland Heights"） |
| pickupAddress | Address | **提货地址（某位代收人的家庭地址，结构化，见 6.14）** |
| pickupContactName | string | **代收人姓名** |
| pickupContactPhone | string | **代收人联系电话** |
| pickupUserId | string | **代收人用户 ID（该地址的住户）** |
| coordinates | json | 提货地址经纬度 {lat, lng} |
| currentOrders | int | 当前批次已归入的订单数（实时） |
| currentValue | decimal | 当前批次订单总货值（实时） |
| orderDeadline | datetime | 本批次下单截止时间（如周日 23:59） |
| shipDate | datetime | 预计发货日期（如周一） |
| estimatedArrival | datetime | 预计到达提货地址日期 |
| status | enum | 集货中/已发货/运输中/已到达/已完成 |
| createdAt | datetime | 批次创建时间 |
| updatedAt | datetime | 更新时间 |

**批次生命周期**：

```
系统根据区域订单聚类自动创建批次
    ↓
集货中：用户下单加入该批次，截止日前的订单归入
    ↓
下单截止（如周日 23:59）→ 批次锁定
    ↓
已发货：买手采购完毕，从国内发出
    ↓
运输中：国际物流段
    ↓
已到达：整批包裹送达提货地址（代收人家中）
    ↓
代收人确认收货 → 平台向同批次用户发送取件码
    ↓
用户凭取件码提货 → 批次完成
```

**提货地址的产生**：

```
系统扫描本区域所有 willingToReceiveForOthers=true 的用户
    ↓
按 [历史代收次数 + 地址覆盖的订单密度 + 用户评分] 综合排序
    ↓
选择最优用户作为本批次代收人
    ↓
其家庭地址即为该批次的提货地址
    ↓
若本周无合适代收人 → 系统创建新批次并等待更多订单汇聚
```

### 6.5 心愿单 (Wishlist)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 心愿单条目 ID |
| userId | string | 用户 ID |
| productId | string | 商品 ID |
| region | string | **用户所在区域（决定展示哪种币种的价格）** |
| addedAt | datetime | 加入时间 |
| status | enum | 待购/已购/已移除 |

### 6.6 用户 (User)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 用户 ID |
| name | string | 用户名 |
| region | string | 所在国家/地区代码（如 US） |
| homeAddress | Address | **默认家庭地址（结构化，见 6.14 全球地址系统）** |
| homeAddresses | Address[] | **家庭地址簿（用户管理）** |
| willingToReceiveForOthers | boolean | **是否愿意代他人收货（全局默认值，下单时可单独覆盖）** |
| receiveForOthersCount | int | 历史累计代收次数（用于系统选择代收人时排序） |
| receiveForOthersRating | decimal | 代收服务评分（其他用户提货后评价） |

### 6.7 对话 (Conversation)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 对话 ID |
| userId | string | 用户 ID |
| title | string | 对话标题（自动生成） |
| messages | json[] | 消息列表 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 最后更新时间 |

### 6.8 集采购单 (PurchaseOrder)

集采购单由心愿单"一键下单"或同批次多个订单合并产生，代表买手的一次统一采购任务。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 集采单 ID |
| batchId | string | 关联的集运批次 ID |
| buyerId | string | 执行采购的买手 ID |
| orderIds | string[] | 包含的订单 ID 列表 |
| totalSourceAmount | decimal | 采购总金额（CNY，源币种） |
| status | enum | 待接单/采购中/已采购/异常 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### 6.9 买手 (Buyer)

买手是平台在国内的采购代理人，负责接收集采单并代为采购商品。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 买手 ID |
| name | string | 买手名称 |
| region | string | 所在区域（如 "广东深圳"） |
| contactPhone | string | 联系电话 |
| maxDailyOrders | int | 每日最大接单量 |
| currentDailyOrders | int | 当日已接单量 |
| rating | decimal | 服务评分 |
| completionRate | decimal | 完成率 |
| status | enum | 在线/离线/暂停 |
| createdAt | datetime | 创建时间 |

### 6.10 支付交易 (Transaction)

每笔支付对应一条交易记录，记录完整的支付生命周期。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 交易 ID |
| transactionNo | string | 交易流水号 |
| orderIds | string[] | 关联的订单 ID 列表（支持合并支付） |
| userId | string | 付款用户 ID |
| paymentMethod | enum | 信用卡/PayPal/Zelle/ApplePay |
| amount | decimal | 支付金额 |
| currency | string | 支付币种（如 USD） |
| status | enum | 待支付/支付中/已支付/已退款/支付失败 |
| gatewayTransactionId | string | 第三方支付网关交易 ID |
| paidAt | datetime | 实际支付成功时间 |
| refundedAt | datetime | 退款时间（如有） |
| createdAt | datetime | 创建时间 |

### 6.11 社区返佣 (ReferralCommission)

用户分享商品链接，好友通过链接下单后，推荐人获得返佣奖励。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 返佣记录 ID |
| referrerUserId | string | 推荐人用户 ID |
| referredUserId | string | 被推荐人用户 ID |
| referralCode | string | 推荐码 / 分享链接标识 |
| triggeredOrderId | string | 触发返佣的订单 ID |
| commissionAmount | decimal | 返佣金额（本地币种） |
| currency | string | 返佣币种 |
| status | enum | 待结算/已结算/已失效 |
| settledAt | datetime | 结算时间 |
| createdAt | datetime | 创建时间 |

### 6.12 通知 (Notification)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 通知 ID |
| userId | string | 接收用户 ID |
| type | enum | 订单状态/价格变动/批次提醒/热购更新/系统通知 |
| title | string | 通知标题 |
| content | string | 通知内容 |
| relatedEntityType | string | 关联实体类型（Order / Wishlist / DeliveryBatch） |
| relatedEntityId | string | 关联实体 ID |
| channel | enum | 对话内/Push/邮件/短信 |
| isRead | boolean | 是否已读 |
| createdAt | datetime | 创建时间 |

### 6.13 实体关系图

```
User 1 ──── * Order              (用户有多个订单)
User 1 ──── * Wishlist           (用户有多个心愿单条目)
User 1 ──── * Conversation       (用户有多个对话)
User 1 ──── * Transaction        (用户有多笔支付交易)
User 1 ──── * Notification       (用户有多条通知)
User 1 ──── 0..* DeliveryBatch   (用户可作为多个批次的代收人)
User 1 ──── * ReferralCommission (用户可作为推荐人获得返佣)

Product 1 ──── * ProductPricing  (同一商品，每个目的国一条定价)
Product 1 ──── * Order           (同一商品可被多次购买)
Product 1 ──── * Wishlist

ProductPricing 1 ──── * Order    (定价快照关联)
DeliveryBatch 1 ──── * Order     (一个批次包含多个订单)
DeliveryBatch 1 ──── 0..1 PurchaseOrder (一个批次对应一个集采单)

PurchaseOrder 1 ──── 1 Buyer     (一个集采单由一个买手执行)
Order * ──── 0..1 Transaction    (订单关联支付交易，支持合并支付)
Order 1 ──── 0..1 ReferralCommission (订单可触发返佣)
```

**地址与批次关系示意**：
```
用户家庭地址 (User.homeAddresses)
    │
    │  用户下单时选择"愿意代他人收货"
    │  → willingToReceiveForOthers 写入 Order
    │
    │  系统根据区域订单聚类
    │  从 willing 用户中选择代收人
    ↓
集运批次 (DeliveryBatch)
    ├── pickupAddress = 代收人的家庭地址
    ├── pickupContactName/Phone = 代收人信息
    └── orders[] = 归入该批次的所有订单
    │
    │  用户下单时选择加入某批次
    │  → deliveryBatchId 写入 Order
    ↓
Order (持有 homeAddress + deliveryBatchId + pickupCode)
```

### 6.14 全球地址系统

#### 6.14.1 设计目标

系统需兼容全球主流地址格式，支持有邮编国家和无邮编国家，并能用于：
- 用户填写/编辑地址时的表单适配与校验
- 集运批次匹配（决定推荐用户加入哪个批次）
- 末端配送的地理编码与路径规划

#### 6.14.2 Address 通用数据结构

所有地址（家庭地址、提货地址、订单地址快照）统一使用以下结构：

```json
{
  "id": "addr_xxxx",
  "countryCode": "US",
  "recipientName": "张伟",
  "phone": "+1 626-555-0123",

  "postalCode": "91748",
  "adminArea1": "CA",
  "adminArea2": "Los Angeles County",
  "adminArea3": "Rowland Heights",
  "streetAddress1": "1888 Commerce Ave",
  "streetAddress2": "Apt 204",
  "landmark": "",

  "coordinates": { "lat": 33.9925, "lng": -117.8887 },
  "formatted": "1888 Commerce Ave Apt 204, Rowland Heights, CA 91748",
  "formatVersion": 1,
  "isDefault": true,
  "label": "家"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 地址记录 ID |
| countryCode | string | 是 | ISO 3166-1 alpha-2 国家代码（如 US / CA / AU / JP / SG） |
| recipientName | string | 是 | 收件人姓名 |
| phone | string | 是 | 联系电话（含国际区号） |
| postalCode | string | 条件必填 | 邮政编码。有邮编国家必填，无邮编国家可为空 |
| adminArea1 | string | 是 | 一级行政区：对应 state / province / prefecture / emirate 等 |
| adminArea2 | string | 否 | 二级行政区：对应 city / county / district / ward 等 |
| adminArea3 | string | 否 | 三级行政区：对应 suburb / town / neighborhood 等 |
| streetAddress1 | string | 是 | 街道地址第一行（门牌号 + 路名） |
| streetAddress2 | string | 否 | 街道地址第二行（楼层/单元/套房号等） |
| landmark | string | 否 | 附近地标（辅助配送定位，部分中东/东南亚地址常用） |
| coordinates | json | 否 | 经纬度 {lat, lng}，由地理编码服务自动填充 |
| formatted | string | 是 | 按该国规则拼好的完整地址字符串（用于展示） |
| formatVersion | int | 是 | 地址格式版本号（格式配置更新时可触发重新格式化） |
| isDefault | boolean | 否 | 是否默认地址 |
| label | string | 否 | 用户自定义标签（如"家"、"公司"） |

#### 6.14.3 国家级地址格式配置 (AddressFormat)

每个国家/地区对应一条格式配置，定义该国的地址字段规则。参考 Google libaddressformat 标准设计。

```json
{
  "countryCode": "US",
  "countryName": "United States",
  "postalCodeFormat": {
    "required": true,
    "pattern": "^\\d{5}(-\\d{4})?$",
    "example": "91748"
  },
  "fields": [
    { "key": "streetAddress1", "label": "Address line 1", "required": true },
    { "key": "streetAddress2", "label": "Address line 2 (Apt, Suite, etc.)", "required": false },
    { "key": "adminArea3",     "label": "City", "required": true },
    { "key": "adminArea1",     "label": "State", "required": true },
    { "key": "postalCode",     "label": "ZIP code", "required": true }
  ],
  "displayOrder": ["streetAddress1", "streetAddress2", "adminArea3", "adminArea1", "postalCode"],
  "adminArea1Label": "State",
  "hasAdminArea2": true,
  "hasAdminArea3": true
}
```

**AddressFormat 实体字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| countryCode | string | ISO 3166-1 alpha-2 国家代码（主键） |
| countryName | string | 国家名称 |
| postalCodeFormat | json | 邮编规则：是否必填、正则格式、示例 |
| fields | json[] | 字段定义列表：每个字段的 key、显示标签、是否必填、是否只读、默认值 |
| displayOrder | string[] | 表单字段显示顺序（不同国家顺序不同） |
| adminArea1Label | string | 一级行政区的显示标签（"State" / "Province" / "Prefecture" / "Emirate"） |
| hasAdminArea2 | boolean | 是否需要二级行政区 |
| hasAdminArea3 | boolean | 是否需要三级行政区 |
| formattedTemplate | string | 地址拼接模板（如 `"{streetAddress1}, {adminArea3}, {countryCode} {postalCode}"`） |

**已规划支持的国家/地区（首批）**：

| 国家 | 代码 | 邮编 | 特殊说明 |
|------|------|------|----------|
| 美国 | US | 5位或 5+4 位（如 91748 或 91748-1234） | **首发市场**，adminArea1 = State, adminArea3 = City |
| 加拿大 | CA | 字母数字混合（A1A 1A1） | adminArea1 = Province |
| 澳大利亚 | AU | 4位数字 | adminArea1 = State/Territory |
| 日本 | JP | 7位数字（xxx-xxxx） | adminArea1 = 都道府県, adminArea2 = 市区町村 |
| 英国 | GB | 字母数字混合 | 邮编格式复杂，adminArea2 = PostTown |
| 新加坡 | SG | 6位数字 | 无省/州概念，adminArea1 固定为 "Singapore" |
| 马来西亚 | MY | 5位数字 | adminArea1 = State, adminArea2 = City |
| 阿联酋 | AE | 无邮编 | 依赖 landmark + phone 辅助定位 |
| 中国 | CN | 6位数字 | adminArea1 = 省, adminArea2 = 市, adminArea3 = 区 |

#### 6.14.4 地址处理流程

```
用户输入地址
    ↓
前端根据 countryCode 加载 AddressFormat 配置
    ↓
渲染对应字段表单（字段顺序、标签、必填规则均按国家适配）
    ↓
用户提交 → 后端校验（邮编格式、必填字段）
    ↓
调用地理编码服务（Google Geocoding API / 自建）→ 填充 coordinates
    ↓
按 formattedTemplate 生成 formatted 字符串 → 存储
    ↓
集运批次匹配：postalCode 区域匹配 → coordinates 距离匹配 → adminArea 兜底
```

#### 6.14.5 无邮编国家的处理策略

对于阿联酋等无邮编体系的国家：

| 策略 | 说明 |
|------|------|
| 强化 phone 字段 | 配送员通过电话/WhatsApp 联系收件人确认位置 |
| landmark 字段必填 | 要求填写附近地标建筑（如 "near Dubai Mall"） |
| coordinates 必填 | 地理编码必须成功，否则无法匹配集运批次 |
| 批次匹配降级 | 跳过 postalCode 匹配，直接用 coordinates 距离 + adminArea 匹配批次 |

#### 6.14.6 地址与集运批次匹配算法

```
输入：用户家庭地址 Address
    ↓
Step 1: 取 Address.countryCode + Address.postalCode + Address.coordinates
    ↓
Step 2: 查询所有 countryCode 匹配且 status=集货中 的 DeliveryBatch
    ↓
Step 3: 对每个候选批次，计算匹配度：
    ├── postalCode 匹配 → Address.postalCode 与批次提货地址的邮编同区域（高优先级）
    ├── coordinates 距离 → Address.coordinates 与批次 pickupAddress.coordinates 距离 ≤ 10km
    └── adminArea 匹配 → Address.adminArea1/2 与批次提货地址同区（兜底）
    ↓
Step 4: 按匹配类型优先级排序（postalCode > coordinates > adminArea）
    ↓
Step 5: 同优先级内，按批次实时数据排序：
    ├── currentOrders 多 → 运费分摊低，优先推荐
    ├── 距 orderDeadline 近 → 即将截止，优先推荐
    └── currentValue 高 → 配送保障好
    ↓
输出：推荐批次列表（最多 3 个），每个含提货地址和代收人信息
```

### 6.15 多币种查询示例

**场景**：Nike Air Force 1 分别面向美国和加拿大用户

```
Product (id: "taobao_nike")
├── sourcePrice: ¥499 CNY
├── weightKg: 0.8
│
├── ProductPricing (region: US)
│   ├── currency: USD, symbol: $
│   ├── localPrice: $71.30        ← (499 / 7.35) × 1.05
│   ├── exchangeRateSnapshot: 7.35  (1 USD = 7.35 CNY)
│   ├── exchangeRateSource: 15日最高
│   ├── markupRate: 0.05
│   ├── shippingRatePerKg: 5.00
│   └── estimatedShippingFee: $4.00  ← 0.8 × 5.00
│
└── ProductPricing (region: CA)
    ├── currency: CAD, symbol: C$
    ├── localPrice: C$96.70       ← (499 / 5.42) × 1.05
    ├── exchangeRateSnapshot: 5.42  (1 CAD = 5.42 CNY)
    ├── exchangeRateSource: 15日最高
    ├── markupRate: 0.05
    ├── shippingRatePerKg: 7.00
    └── estimatedShippingFee: C$5.60  ← 0.8 × 7.00
```

美国用户看到：`$71.30 + 集运 $4.00 = $75.30`
加拿大用户看到：`C$96.70 + 集运 C$5.60 = C$102.30`

> **汇率解读**：同一件 ¥499 的商品，美国用户付 $71.30、加拿大用户付 C$96.70，差异来自各自市场的汇率和加价。平台收取 USD 后按实际汇率兑换 CNY 支付给卖家，差额为平台汇兑收益。

---

## 7. 界面设计规范

### 7.1 色彩体系

| 用途 | 色值 | 说明 |
|------|------|------|
| 品牌主色 | #7C3AED | 紫色，用于按钮、链接、高亮 |
| 品牌浅色 | #EDE9FE | 背景、标签底色 |
| 品牌深色 | #5B21B6 | hover 状态 |
| 强调色 | #F97316 | 橙色，用于价格、CTA |
| 成功色 | #10B981 | 绿色，用于成功状态、核验通过 |
| 警告色 | #F59E0B | 黄色，用于集货中等状态 |
| 危险色 | #EF4444 | 红色，用于错误状态 |
| 侧边栏背景 | #13111A | 深色 |
| 主背景 | #F5F5FA | 浅灰 |
| 卡片背景 | #FFFFFF | 白色 |

### 7.2 字体

- 主字体：-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei'
- 正文字号：14px
- 标题字号：15–24px
- 辅助字号：11–12px
- 行高：1.6

### 7.3 圆角

- 小圆角：8px（按钮、标签）
- 中圆角：12px（输入框、一般卡片）
- 大圆角：16–20px（卡片、气泡）
- 气泡圆角：18px（对话气泡）

### 7.4 阴影

- 小阴影：`0 1px 3px rgba(100,80,160,0.08)`
- 中阴影：`0 4px 12px rgba(100,80,160,0.1)`
- 大阴影：`0 12px 36px rgba(100,80,160,0.14)`

---

## 8. 开放问题 & 后续规划

| 编号 | 问题/规划 | 优先级 |
|------|----------|--------|
| Q1 | 拼多多链接解析的具体接入方案 | P1 |
| Q2 | 图片搜索购物功能的实现方案 | P2 |
| Q3 | 多目的国扩展的运费计算模型 | P1 |
| Q4 | 买手端的接单/管理系统设计 | P1 |
| Q5 | 社区晒单功能的详细交互设计 | P2 |
| Q6 | 支付网关选型（Stripe / 本地方案） | P0 |
| Q7 | 用户认证方案（手机号 / 社交登录） | P0 |
| Q8 | 集运批次调度算法优化 | P1 |
| Q9 | Push 通知渠道集成（FCM / APNs） | P2 |
| Q10 | 商品售后/退换货流程设计 | P1 |

---

## 9. 里程碑规划（建议）

| 阶段 | 内容 | 周期 |
|------|------|------|
| **MVP** | Flylink 解析 + 商品卡片 + 下单支付 + 基础订单追踪 | 6 周 |
| **V1.1** | 心愿单 + 社区推荐 + 运费计算 + 智能地址推荐 | 4 周 |
| **V1.2** | 多目的国扩展 + 图片搜索 + Push 通知 | 6 周 |
| **V2.0** | 社区晒单 + 买手端系统 + 售后流程 | 8 周 |

---

*文档结束*
