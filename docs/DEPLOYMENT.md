# AIBuyWorld 部署文档

> 版本：v1.0  
> 更新日期：2026-07-21  
> 适用环境：Docker + Docker Compose

---

## 1. 环境要求

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| Docker | 20.10+ | 支持 BuildKit |
| Docker Compose | 2.0+ | V2 语法 |
| 磁盘空间 | 10GB+ | 镜像 + 数据卷 |
| 内存 | 4GB+ | 4 个容器同时运行 |

---

## 2. 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network: abw_net               │
│                    Subnet: 172.23.0.0/16                 │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  abw-web     │  │  abw-server  │  │  abw-postgres│  │
│  │  172.23.0.30 │  │  172.23.0.20 │  │  172.23.0.10 │  │
│  │  :3003→3000  │  │  :3004→3001  │  │  (内部 5432) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐                                       │
│  │  abw-redis   │                                       │
│  │  172.23.0.11 │                                       │
│  │  (内部 6379) │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

**端口映射**：
- Web 前端：`http://<HOST>:3003`
- API 服务：`http://<HOST>:3004/api`
- PostgreSQL / Redis：仅内部网络访问，不暴露宿主机端口

---

## 3. 镜像分层策略

采用**基础镜像 + 应用镜像**分层构建，大幅提升构建速度：

```
Dockerfile.base (abw-base)
    ├── node:20-slim
    ├── npm ci (所有 workspace 依赖)
    └── OpenSSL (Prisma 运行时)

apps/web/Dockerfile        →  FROM abw-base
apps/server/Dockerfile     →  FROM abw-base
```

| 镜像 | 构建频率 | 耗时 |
|------|---------|------|
| `abw-base` | 仅依赖变更时 | ~60 秒 |
| `abw-web` / `abw-server` | 每次代码提交 | ~15-20 秒 |

---

## 4. 首次部署

### 4.1 克隆代码

```bash
git clone <repo-url> ai-buy-world
cd ai-buy-world
```

### 4.2 配置环境变量

```bash
cp .env.example .env.docker
```

编辑 `.env.docker`，按需修改：

```ini
# 数据库
DATABASE_URL=postgresql://aibuyworld:aibuyworld_dev@postgres:5432/aibuyworld

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=<替换为随机字符串>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# 加密密钥（用于加密 API Key 等敏感信息）
ENCRYPTION_KEY=<替换为随机字符串>

# 外部服务（使用加密值）
FLYLINK_API_KEY=enc:<加密后的值>
OPENAI_API_KEY=enc:<加密后的值>

# CORS
CORS_ORIGIN=http://192.168.83.1:3003

# 前端 API 地址（用户浏览器访问的宿主机地址）
NEXT_PUBLIC_API_URL=http://192.168.83.1:3004/api
```

#### 加密敏感配置

生产环境建议加密存储 API Key 等敏感信息。

**加密原理**：
- 算法：AES-256-GCM（对称加密 + 认证）
- 密钥派生：PBKDF2（SHA-512, 100,000 次迭代, 32 字节密钥）
- 每次加密生成随机 Salt（64 字节）+ IV（16 字节），同一明文每次加密结果不同
- Salt 和 IV 存储在密文中（非秘密，但解密时必须参与运算）
- GCM 认证标签（16 字节）用于校验数据完整性
- 存储格式：`enc:<base64-salt>:<base64-iv>:<base64-tag>:<base64-ciphertext>`

**加密工具**：`apps/server/src/scripts/encrypt-env.ts`

**方法 1：使用 tsx 直接运行（推荐，无需编译）**

```bash
# 从 .env.docker 读取当前加密密钥
export ENCRYPTION_KEY=$(grep '^ENCRYPTION_KEY=' .env.docker | cut -d= -f2)

# 加密单个值（格式：KEY=value）
echo 'FLYLINK_API_KEY=your-new-api-key' | npx tsx apps/server/src/scripts/encrypt-env.ts

# 输出示例：
# FLYLINK_API_KEY=enc:base64salt:base64iv:base64tag:base64ciphertext
```

**方法 2：批量加密多个值**

```bash
export ENCRYPTION_KEY=$(grep '^ENCRYPTION_KEY=' .env.docker | cut -d= -f2)

npx tsx apps/server/src/scripts/encrypt-env.ts
# 逐行输入 KEY=value 格式：
# FLYLINK_API_KEY=sk-xxx
# OPENAI_API_KEY=sk-yyy
# （空行结束输入，输出所有加密结果）
```

**方法 3：编译后运行**

```bash
cd apps/server && npm run build
echo 'FLYLINK_API_KEY=your-key' | ENCRYPTION_KEY=your-passphrase node dist/scripts/encrypt-env.js
```

**更新密钥的完整流程**：

```bash
# 1. 加密新值
export ENCRYPTION_KEY=$(grep '^ENCRYPTION_KEY=' .env.docker | cut -d= -f2)
echo 'FLYLINK_API_KEY=new-api-key-value' | npx tsx apps/server/src/scripts/encrypt-env.ts

# 2. 编辑 .env.docker，将输出替换对应行
# FLYLINK_API_KEY=enc:新salt:新iv:新tag:新ciphertext

# 3. 重启 server 容器使配置生效
docker compose restart server

# 4. 验证
docker logs abw-server | grep -i "decrypt\|error"
```

**运行时解密流程**：

```
.env.docker 加载 → dotenv 读取原始值
       ↓
  检测 enc: 前缀 → 用 ENCRYPTION_KEY + salt 派生密钥
       ↓
  AES-256-GCM 解密 → 用 iv 解密 + tag 校验完整性
       ↓
  Zod 校验 → 类型转换 + 默认值
       ↓
  export const config → 应用代码使用明文值
```

非 `enc:` 前缀的值原样返回，兼容明文配置（开发环境无需加密）。

**更换 ENCRYPTION_KEY**：

如果更换了 `ENCRYPTION_KEY` 本身，所有已加密的值都需要重新加密：

```bash
# 1. 先用旧密钥解密（手动或写脚本导出明文）
# 2. 修改 .env.docker 中的 ENCRYPTION_KEY
# 3. 用新密钥重新加密所有敏感值
export ENCRYPTION_KEY="new-passphrase"
echo 'FLYLINK_API_KEY=明文值' | npx tsx apps/server/src/scripts/encrypt-env.ts
echo 'OPENAI_API_KEY=明文值' | npx tsx apps/server/src/scripts/encrypt-env.ts
# 4. 将新加密值填入 .env.docker
# 5. 重启服务
docker compose restart server
```

### 4.3 构建基础镜像

```bash
docker build -f Dockerfile.base -t abw-base .
```

### 4.4 构建并启动所有服务

```bash
docker compose up -d --build
```

### 4.5 验证部署

```bash
# 查看容器状态
docker compose ps

# 查看日志
docker compose logs -f

# 测试 API
curl http://localhost:3004/api/health

# 访问前端
open http://192.168.83.1:3003
```

---

## 5. 日常运维

### 5.1 重新构建（代码更新）

```bash
# 拉取最新代码
git pull

# 重建应用镜像（自动利用缓存，很快）
docker compose up -d --build

# 如果只有代码变更，不需要重建基础镜像
```

### 5.2 更新依赖（package.json 变更）

```bash
# 1. 重建基础镜像
docker build -f Dockerfile.base -t abw-base .

# 2. 重建应用镜像
docker compose up -d --build
```

### 5.3 查看日志

```bash
# 所有服务
docker compose logs -f

# 单个服务
docker logs -f abw-web
docker logs -f abw-server
docker logs -f abw-postgres

# 最近 100 行
docker logs --tail 100 abw-server
```

### 5.4 进入容器调试

```bash
# 进入 server 容器
docker exec -it abw-server sh

# 进入数据库
docker exec -it abw-postgres psql -U aibuyworld aibuyworld

# 进入 Redis
docker exec -it abw-redis redis-cli
```

### 5.5 数据库操作

```bash
# 执行 migration
docker exec -it abw-server sh -c "cd apps/server && npx prisma migrate deploy"

# 生成 Prisma Client
docker exec -it abw-server sh -c "cd apps/server && npx prisma generate"

# 数据库备份
docker exec abw-postgres pg_dump -U aibuyworld aibuyworld > backup_$(date +%Y%m%d).sql

# 数据库恢复
cat backup.sql | docker exec -i abw-postgres psql -U aibuyworld aibuyworld
```

### 5.6 停止 / 启动

```bash
# 停止所有服务（保留数据）
docker compose down

# 启动所有服务
docker compose up -d

# 停止并删除数据卷（⚠️ 会丢失所有数据）
docker compose down -v
```

---

## 6. 数据持久化

| 数据 | 卷名 | 挂载路径 | 说明 |
|------|------|---------|------|
| PostgreSQL | `abw_pgdata` | `/var/lib/postgresql/data` | 数据库文件 |
| Redis | `abw_redisdata` | `/data` | 缓存/会话数据 |

**查看卷信息**：
```bash
docker volume ls | grep abw
docker volume inspect abw_pgdata
```

**备份数据卷**：
```bash
# 备份 PostgreSQL
docker run --rm -v abw_pgdata:/data -v $(pwd):/backup alpine \
  tar czf /backup/pgdata_backup.tar.gz /data

# 恢复
docker run --rm -v abw_pgdata:/data -v $(pwd):/backup alpine \
  sh -c "cd / && tar xzf /backup/pgdata_backup.tar.gz"
```

---

## 7. 网络配置

### 7.1 自定义网段

项目使用 `172.23.0.0/16` 网段，避免与宿主机其他容器冲突（如 `172.22.0.0/16`）。

如需修改，编辑 `docker-compose.yml`：

```yaml
networks:
  abw_net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.23.0.0/16  # 修改为所需网段
```

### 7.2 远程访问

前端 API 地址通过 `NEXT_PUBLIC_API_URL` 环境变量配置，必须是**用户浏览器能访问到的地址**：

```ini
# .env.docker
NEXT_PUBLIC_API_URL=http://192.168.83.1:3004/api
```

修改后需重建 web 镜像：
```bash
docker compose up -d --build web
```

---

## 8. 常见问题排查

### 8.1 容器启动失败

```bash
# 查看容器退出原因
docker inspect --format='{{.State.ExitCode}}' abw-server

# 查看详细日志
docker logs abw-server
```

### 8.2 数据库连接失败

```bash
# 检查 postgres 容器是否运行
docker compose ps postgres

# 检查网络连通性
docker exec abw-server ping postgres

# 检查数据库 URL
docker exec abw-server env | grep DATABASE
```

### 8.3 前端无法访问 API

**症状**：浏览器控制台报 CORS 错误或 fetch failed

**排查步骤**：
1. 确认 `NEXT_PUBLIC_API_URL` 配置正确（必须是浏览器可访问的地址）
2. 确认 `CORS_ORIGIN` 包含前端访问地址
3. 重建 web 镜像使配置生效

```bash
docker compose up -d --build web
```

### 8.4 Prisma 引擎不匹配

**症状**：`libssl.so.1.1: cannot open shared object file`

**原因**：基础镜像缺少 OpenSSL 或版本不对

**解决**：重建基础镜像
```bash
docker build -f Dockerfile.base --no-cache -t abw-base .
docker compose up -d --build
```

### 8.5 端口冲突

```bash
# 查看端口占用
sudo lsof -i :3003
sudo lsof -i :3004

# 修改 docker-compose.yml 中的端口映射
ports:
  - "8080:3000"  # 将宿主机端口改为 8080
```

---

## 9. 性能优化

### 9.1 构建缓存

Docker 会自动缓存未变更的层。如需强制重建：

```bash
# 只重建应用镜像（推荐）
docker compose build --no-cache web server

# 完全重建（包括基础镜像）
docker build -f Dockerfile.base --no-cache -t abw-base .
```

### 9.2 日志轮转

生产环境建议配置 Docker 日志轮转，编辑 `/etc/docker/daemon.json`：

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

重启 Docker 服务：
```bash
sudo systemctl restart docker
```

### 9.3 资源限制

在 `docker-compose.yml` 中为容器添加资源限制：

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

---

## 10. 生产环境建议

### 10.1 安全加固

- [ ] 修改 `JWT_SECRET` 为强随机字符串
- [ ] 修改数据库默认密码
- [ ] 配置 HTTPS（Nginx 反向代理 + Let's Encrypt）
- [ ] 限制 `CORS_ORIGIN` 为实际域名
- [ ] 不暴露 PostgreSQL / Redis 端口到宿主机

### 10.2 监控告警

- [ ] 接入 Prometheus + Grafana 监控容器指标
- [ ] 配置日志收集（ELK / Loki）
- [ ] 设置磁盘 / 内存告警阈值
- [ ] 数据库慢查询监控

### 10.3 备份策略

- [ ] PostgreSQL 每日自动备份（cron + pg_dump）
- [ ] 备份文件异地存储（S3 / OSS）
- [ ] 定期恢复演练
- [ ] Redis RDB 持久化配置

### 10.4 高可用

- [ ] 多副本部署（docker-compose scale 或 Kubernetes）
- [ ] 负载均衡（Nginx / Traefik）
- [ ] 数据库主从复制
- [ ] Redis Sentinel / Cluster

---

## 11. 版本升级

### 11.1 应用升级

```bash
git pull origin main
docker compose up -d --build
```

### 11.2 基础镜像升级（Node.js 版本）

```bash
# 修改 Dockerfile.base 中的 FROM node:20-slim
# 重建基础镜像
docker build -f Dockerfile.base -t abw-base .

# 重建应用
docker compose up -d --build
```

### 11.3 数据库迁移

Prisma migration 会在 server 容器启动时自动执行。如需手动执行：

```bash
docker exec -it abw-server sh -c "cd apps/server && npx prisma migrate deploy"
```

---

## 12. 快速参考

```bash
# 首次部署
docker build -f Dockerfile.base -t abw-base .
docker compose up -d --build

# 日常更新
docker compose up -d --build

# 依赖更新后
docker build -f Dockerfile.base -t abw-base .
docker compose up -d --build

# 查看状态
docker compose ps
docker compose logs -f

# 停止
docker compose down

# 重启单个服务
docker compose restart web
```

---

## 附录 A：目录结构

```
ai-buy-world/
├── Dockerfile.base              # 基础镜像定义
├── docker-compose.yml           # 容器编排
├── .env.docker                  # Docker 环境变量
├── .dockerignore                # Docker 构建忽略文件
├── apps/
│   ├── server/
│   │   ├── Dockerfile           # Server 应用镜像
│   │   ├── prisma/
│   │   │   └── schema.prisma    # 数据库 Schema
│   │   └── src/                 # Server 源码
│   └── web/
│       ├── Dockerfile           # Web 应用镜像
│       └── src/                 # Web 源码
└── packages/
    └── shared/                  # 共享包
```

---

## 附录 B：容器清单

| 容器名 | 镜像 | 端口 | 说明 |
|--------|------|------|------|
| abw-web | ai-buy-world-web | 3003→3000 | Next.js 前端 |
| abw-server | ai-buy-world-server | 3004→3001 | Fastify API |
| abw-postgres | postgres:16-alpine | (内部 5432) | PostgreSQL 数据库 |
| abw-redis | redis:7-alpine | (内部 6379) | Redis 缓存 |

---

*文档结束*
