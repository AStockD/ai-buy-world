# FlyLink 测试商品链接

用于测试商品解析功能的标准测试链接。

## 测试结果

| 平台 | 商品 ID | 状态 | 商品名称 | 价格 (CNY) |
|------|---------|------|---------|-----------|
| 淘宝 | 623675070331 | ✓ | 傅荣999纯金银奖牌定制定做纪念金银币 | ¥100.00 |
| 京东 | 100056338181 | ✓ | 劳拉之星牛皮健身腰带男硬拉深蹲运动 | ¥119.00 |
| 1688 | 1031641480452 | ✓ | 狮子高光粉清透光泽爆闪珠光土豆泥高光 | ¥6.20 |
| AliExpress | 3256811855900133 | ✓ | 13x4 HD Transparent Lace Deep Wave Frontal Wig | $16.59 |

## 淘宝 (Taobao)

**链接**: `https://item.taobao.com/item.htm?id=623675070331`

**商品**: 傅荣999纯金银奖牌定制定做纪念金银币

**价格**: ¥100.00

```bash
curl -X POST https://astockd.com/fapi/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer flk_vNtesdSOHdo2hQJbrTus0SzL_PYzq2OzRFBsKVeawQQ" \
  -d '{"url": "https://item.taobao.com/item.htm?id=623675070331"}'
```

**返回数据**:
- 品牌: 傅荣
- 分类: 珠宝首饰 > 贵金属饰品 > 纪念章/奖章
- 多语言: en, es, fr, pt
- SKU: 定制定金
- 重量: 0.05kg

## 京东 (JD)

**链接**: `https://item.jd.com/100056338181.html`

**商品**: 劳拉之星牛皮健身腰带男硬拉深蹲运动专业力量举重训练护腰带

**价格**: ¥119.00

```bash
curl -X POST https://astockd.com/fapi/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer flk_vNtesdSOHdo2hQJbrTus0SzL_PYzq2OzRFBsKVeawQQ" \
  -d '{"url": "https://item.jd.com/100056338181.html"}'
```

## 1688

**链接**: `https://detail.1688.com/offer/1031641480452.html`

**商品**: 狮子高光粉清透光泽爆闪珠光土豆泥高光提亮盘

**价格**: ¥6.20

```bash
curl -X POST https://astockd.com/fapi/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer flk_vNtesdSOHdo2hQJbrTus0SzL_PYzq2OzRFBsKVeawQQ" \
  -d '{"url": "https://detail.1688.com/offer/1031641480452.html"}'
```

## AliExpress

**链接**: `https://www.aliexpress.com/item/3256811855900133.html`

**商品**: 13x4 HD Transparent Lace Deep Wave Frontal Wig

**价格**: $16.59 USD

```bash
curl -X POST https://astockd.com/fapi/convert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer flk_vNtesdSOHdo2hQJbrTus0SzL_PYzq2OzRFBsKVeawQQ" \
  -d '{"url": "https://www.aliexpress.com/item/3256811855900133.html"}'
```

## 自动化测试脚本

创建 `scripts/test-flylinks.sh`:

```bash
#!/bin/bash

API_KEY="flk_vNtesdSOHdo2hQJbrTus0SzL_PYzq2OzRFBsKVeawQQ"
BASE_URL="https://astockd.com/fapi/convert"

test_link() {
  local platform=$1
  local url=$2
  
  echo "Testing $platform..."
  response=$(curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "{\"url\": \"$url\"}")
  
  success=$(echo "$response" | jq -r '.success')
  title=$(echo "$response" | jq -r '.raw.title // .spu.name // "N/A"')
  price=$(echo "$response" | jq -r '.pricing.cny // .pricing.usd // "N/A"')
  
  if [ "$success" = "true" ]; then
    echo "✓ $platform: $title (¥$price)"
  else
    error=$(echo "$response" | jq -r '.error')
    echo "✗ $platform: $error"
  fi
  echo ""
}

echo "=== FlyLink Test Suite ==="
echo ""

test_link "Taobao" "https://item.taobao.com/item.htm?id=623675070331"
test_link "JD" "https://item.jd.com/100056338181.html"
test_link "1688" "https://detail.1688.com/offer/1031641480452.html"
test_link "AliExpress" "https://www.aliexpress.com/item/3256811855900133.html"

echo "=== Test Complete ==="
```

使用方法:

```bash
chmod +x scripts/test-flylinks.sh
./scripts/test-flylinks.sh
```

## 注意事项

- 这些链接用于开发测试，确保商品在售
- 如果链接失效，需要替换为新的在售商品
- FlyLink API 有调用频率限制，测试时注意间隔
- 返回数据包含多语言翻译（en, es, fr, pt）
- 价格自动转换为 USD（基于实时汇率）
