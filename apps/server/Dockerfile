# 构建基础镜像: docker build -f Dockerfile.base -t abw-base .
# 应用构建: docker build -f apps/server/Dockerfile -t abw-server .

# --- 构建阶段 ---
FROM abw-base AS builder
WORKDIR /app

COPY . .

RUN npx prisma generate --schema=apps/server/prisma/schema.prisma
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

# --- 运行阶段 ---
FROM abw-base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

EXPOSE 3001

CMD ["sh", "-c", "cd apps/server && node ../../node_modules/.bin/prisma migrate deploy && node dist/index.js"]
