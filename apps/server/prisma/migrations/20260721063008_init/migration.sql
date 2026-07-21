-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255),
    "avatar_url" TEXT,
    "google_id" VARCHAR(100),
    "region" CHAR(2) NOT NULL DEFAULT 'US',
    "willing_to_receive_for_others" BOOLEAN NOT NULL DEFAULT false,
    "receive_for_others_count" INTEGER NOT NULL DEFAULT 0,
    "receive_for_others_rating" DECIMAL(3,2),
    "default_address_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" VARCHAR(50),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "country_code" CHAR(2) NOT NULL,
    "recipient_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "postal_code" VARCHAR(20),
    "admin_area1" VARCHAR(100) NOT NULL,
    "admin_area2" VARCHAR(100),
    "admin_area3" VARCHAR(100),
    "street_address1" VARCHAR(255) NOT NULL,
    "street_address2" VARCHAR(255),
    "landmark" VARCHAR(255),
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "formatted" TEXT NOT NULL,
    "format_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "flylink_product_id" VARCHAR(100) NOT NULL,
    "flylink_url" TEXT NOT NULL,
    "source_platform" VARCHAR(20) NOT NULL,
    "source_url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_price" DECIMAL(12,2) NOT NULL,
    "source_currency" CHAR(3) NOT NULL DEFAULT 'CNY',
    "weight_kg" DECIMAL(8,3),
    "rating" DECIMAL(3,2),
    "sales_count" INTEGER DEFAULT 0,
    "stock_status" VARCHAR(10) NOT NULL DEFAULT '有货',
    "image_url" TEXT,
    "sku_variants" JSONB,
    "multi_lang_assets" JSONB,
    "verified_status" VARCHAR(10) NOT NULL DEFAULT '待核验',
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_pricing" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "region" CHAR(2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "currency_symbol" VARCHAR(5) NOT NULL,
    "local_price" DECIMAL(12,2) NOT NULL,
    "shipping_rate_per_kg" DECIMAL(8,2) NOT NULL,
    "shipping_category" VARCHAR(20) NOT NULL DEFAULT '普通',
    "estimated_shipping_fee" DECIMAL(10,2),
    "exchange_rate_snapshot" DECIMAL(12,6) NOT NULL,
    "exchange_rate_source" VARCHAR(20) NOT NULL,
    "exchange_rate_updated_at" TIMESTAMP(3),
    "markup_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "status" VARCHAR(10) NOT NULL DEFAULT '生效',
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_no" VARCHAR(20) NOT NULL,
    "user_id" TEXT NOT NULL,
    "flylink_order_id" VARCHAR(100),
    "flylink_payment_url" TEXT,
    "product_id" TEXT NOT NULL,
    "selected_sku_id" VARCHAR(50),
    "status" VARCHAR(10) NOT NULL DEFAULT '待支付',
    "product_price" DECIMAL(12,2) NOT NULL,
    "shipping_fee" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(12,6),
    "home_address" JSONB NOT NULL,
    "delivery_batch_id" TEXT,
    "willing_to_receive_for_others" BOOLEAN NOT NULL DEFAULT false,
    "receiver_discount" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "shipping_discount_applied" BOOLEAN NOT NULL DEFAULT false,
    "pickup_code" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_batches" (
    "id" TEXT NOT NULL,
    "batch_no" VARCHAR(20) NOT NULL,
    "region" CHAR(2) NOT NULL,
    "area" VARCHAR(100) NOT NULL,
    "pickup_address" JSONB NOT NULL,
    "pickup_contact_name" VARCHAR(100) NOT NULL,
    "pickup_contact_phone" VARCHAR(20) NOT NULL,
    "pickup_user_id" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "current_orders" INTEGER NOT NULL DEFAULT 0,
    "current_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "order_deadline" TIMESTAMP(3) NOT NULL,
    "ship_date" TIMESTAMP(3),
    "estimated_arrival" TIMESTAMP(3),
    "status" VARCHAR(10) NOT NULL DEFAULT '集货中',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "region" CHAR(2) NOT NULL DEFAULT 'US',
    "status" VARCHAR(10) NOT NULL DEFAULT '待购',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(200),
    "context_window_size" INTEGER NOT NULL DEFAULT 50,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" VARCHAR(10) NOT NULL,
    "content" TEXT NOT NULL,
    "card_data" JSONB,
    "tool_calls" JSONB,
    "feedback" SMALLINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transaction_no" VARCHAR(30) NOT NULL,
    "order_ids" TEXT[],
    "user_id" TEXT NOT NULL,
    "payment_method" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(10) NOT NULL DEFAULT '待支付',
    "gateway_transaction_id" VARCHAR(200),
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "region" VARCHAR(20) NOT NULL,
    "hot_score" INTEGER NOT NULL DEFAULT 0,
    "hot_label" VARCHAR(100),
    "rank" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "related_entity_type" VARCHAR(20),
    "related_entity_id" TEXT,
    "channel" VARCHAR(10) NOT NULL DEFAULT '对话内',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_commissions" (
    "id" TEXT NOT NULL,
    "referrer_user_id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "referral_code" VARCHAR(50) NOT NULL,
    "triggered_order_id" TEXT,
    "commission_amount" DECIMAL(10,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(10) NOT NULL DEFAULT '待结算',
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "region" VARCHAR(50) NOT NULL,
    "contact_phone" VARCHAR(20) NOT NULL,
    "max_daily_orders" INTEGER NOT NULL DEFAULT 50,
    "current_daily_orders" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2),
    "completion_rate" DECIMAL(5,4),
    "status" VARCHAR(10) NOT NULL DEFAULT '离线',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "order_ids" TEXT[],
    "total_source_amount" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT '待接单',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_formats" (
    "country_code" CHAR(2) NOT NULL,
    "country_name" VARCHAR(100) NOT NULL,
    "postal_code_format" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "display_order" JSONB NOT NULL,
    "admin_area1_label" VARCHAR(50),
    "has_admin_area2" BOOLEAN NOT NULL DEFAULT false,
    "has_admin_area3" BOOLEAN NOT NULL DEFAULT false,
    "formatted_template" TEXT NOT NULL,

    CONSTRAINT "address_formats_pkey" PRIMARY KEY ("country_code")
);

-- CreateTable
CREATE TABLE "intent_configs" (
    "id" TEXT NOT NULL,
    "intent_id" VARCHAR(50) NOT NULL,
    "patterns" JSONB NOT NULL DEFAULT '[]',
    "intent_name" VARCHAR(50) NOT NULL,
    "tool_name" VARCHAR(50),
    "priority" INTEGER NOT NULL DEFAULT 5,
    "context_guard" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_region_idx" ON "users"("region");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_flylink_product_id_key" ON "products"("flylink_product_id");

-- CreateIndex
CREATE INDEX "products_flylink_product_id_idx" ON "products"("flylink_product_id");

-- CreateIndex
CREATE INDEX "products_source_platform_source_url_idx" ON "products"("source_platform", "source_url");

-- CreateIndex
CREATE INDEX "products_verified_status_idx" ON "products"("verified_status");

-- CreateIndex
CREATE INDEX "product_pricing_region_status_idx" ON "product_pricing"("region", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_pricing_product_id_region_status_key" ON "product_pricing"("product_id", "region", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_delivery_batch_id_idx" ON "orders"("delivery_batch_id");

-- CreateIndex
CREATE INDEX "orders_order_no_idx" ON "orders"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_batches_batch_no_key" ON "delivery_batches"("batch_no");

-- CreateIndex
CREATE INDEX "delivery_batches_region_status_idx" ON "delivery_batches"("region", "status");

-- CreateIndex
CREATE INDEX "wishlists_user_id_status_idx" ON "wishlists"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_user_id_product_id_key" ON "wishlists"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "conversations_user_id_updated_at_idx" ON "conversations"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transaction_no_key" ON "transactions"("transaction_no");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "recommendations_source_region_rank_idx" ON "recommendations"("source", "region", "rank");

-- CreateIndex
CREATE INDEX "recommendations_period_start_period_end_idx" ON "recommendations"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "referral_commissions_referrer_user_id_status_idx" ON "referral_commissions"("referrer_user_id", "status");

-- CreateIndex
CREATE INDEX "referral_commissions_referral_code_idx" ON "referral_commissions"("referral_code");

-- CreateIndex
CREATE INDEX "purchase_orders_batch_id_idx" ON "purchase_orders"("batch_id");

-- CreateIndex
CREATE INDEX "purchase_orders_buyer_id_status_idx" ON "purchase_orders"("buyer_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "intent_configs_intent_id_key" ON "intent_configs"("intent_id");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_pricing" ADD CONSTRAINT "product_pricing_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_batch_id_fkey" FOREIGN KEY ("delivery_batch_id") REFERENCES "delivery_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_triggered_order_id_fkey" FOREIGN KEY ("triggered_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "delivery_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
