# 构建基础镜像: docker build -f Dockerfile.base -t abw-base .
# 应用构建: docker build -f apps/web/Dockerfile -t abw-web .

# --- 构建阶段 ---
FROM abw-base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3004/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/web

# --- 运行阶段 ---
FROM abw-base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.js ./apps/web/
COPY --from=builder /app/apps/web/package.json ./apps/web/

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start", "--workspace=apps/web"]
