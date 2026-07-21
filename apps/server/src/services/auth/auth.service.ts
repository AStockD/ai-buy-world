import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { config } from '../../lib/config.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  email: string;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    avatar_url: string | null;
  };
}

export class AuthService {
  async register(email: string, password: string, name: string): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('EMAIL_EXISTS');
    }

    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, password_hash, name, region: 'US' },
    });

    return this.generateTokens(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const stored = await redis.get(`refresh:${refreshToken}`);
    if (!stored) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    const payload = jwt.verify(refreshToken, config.jwt.secret) as TokenPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // 轮转：旧 token 失效，发新 pair
    await redis.del(`refresh:${refreshToken}`);
    return this.generateTokens(user);
  }

  async revokeRefresh(refreshToken: string): Promise<void> {
    await redis.del(`refresh:${refreshToken}`);
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  }

  private async generateTokens(user: { id: string; email: string | null; name: string; avatar_url: string | null }): Promise<AuthResult> {
    const payload: TokenPayload = { userId: user.id, email: user.email || '' };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiry as any,
    });

    const refreshToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiry as any,
    });

    // 存储 refresh token 到 Redis，支持主动吊销
    const refreshExpirySeconds = 7 * 24 * 60 * 60; // 7d
    await redis.set(`refresh:${refreshToken}`, user.id, 'EX', refreshExpirySeconds);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
    };
  }
}

export const authService = new AuthService();
