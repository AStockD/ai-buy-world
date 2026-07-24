FROM node:20-slim AS base

# --- deps stage (cached, no OpenSSL needed) ---
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm ci --ignore-scripts

# --- build stage (cached, no OpenSSL needed) ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npx prisma generate --schema=apps/server/prisma/schema.prisma
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

# --- runtime stage (OpenSSL only here) ---
FROM base AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

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
