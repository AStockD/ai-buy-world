-- 消息表按月分区（PARTITION BY RANGE on created_at）
-- PostgreSQL 不支持将已有表直接转为分区表，需要重建

-- Step 1: 创建新的分区表
CREATE TABLE "messages_partitioned" (
  "id"              TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role"            VARCHAR(10) NOT NULL,
  "content"         TEXT NOT NULL,
  "card_data"       JSONB,
  "tool_calls"      JSONB,
  "feedback"        SMALLINT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "messages_partitioned_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

-- Step 2: 创建初始分区（当前月 + 下月）
CREATE TABLE "messages_y2026m07" PARTITION OF "messages_partitioned"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE "messages_y2026m08" PARTITION OF "messages_partitioned"
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- 默认分区（兜底，防止插入超出范围的数据）
CREATE TABLE "messages_default" PARTITION OF "messages_partitioned" DEFAULT;

-- Step 3: 迁移现有数据
INSERT INTO "messages_partitioned" ("id", "conversation_id", "role", "content", "card_data", "tool_calls", "feedback", "created_at")
SELECT "id", "conversation_id", "role", "content", "card_data", "tool_calls", "feedback", "created_at"
FROM "messages";

-- Step 4: 删除旧表并重命名
DROP TABLE "messages";
ALTER TABLE "messages_partitioned" RENAME TO "messages";

-- Step 5: 重建索引
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages" ("conversation_id", "created_at");

-- Step 6: 重建外键
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
