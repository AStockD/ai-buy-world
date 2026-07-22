import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { decryptConfig } from './crypto.js';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Decrypt sensitive values if ENCRYPTION_KEY is set
const encryptionKey = process.env.ENCRYPTION_KEY;
if (encryptionKey) {
  process.env = { ...process.env, ...decryptConfig(process.env as Record<string, string>, encryptionKey) };
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().default('postgresql://aibuyworld:aibuyworld_dev@localhost:5432/aibuyworld'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().default('dev-jwt-secret-change-in-production'),
  JWT_ACCESS_EXPIRY: z.string().default('30d'),
  JWT_REFRESH_EXPIRY: z.string().default('365d'),

  ENCRYPTION_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  FLYLINK_API_URL: z.string().default('https://api.flylink.example.com'),
  FLYLINK_API_KEY: z.string().default(''),
  FLYLINK_WEBHOOK_SECRET: z.string().default(''),

  OPENAI_API_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  INTENT_MODEL: z.string().default('gpt-4o-mini'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  jwt: {
    secret: parsed.data.JWT_SECRET,
    accessExpiry: parsed.data.JWT_ACCESS_EXPIRY,
    refreshExpiry: parsed.data.JWT_REFRESH_EXPIRY,
  },
  google: {
    clientId: parsed.data.GOOGLE_CLIENT_ID,
    clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
  },
  flylink: {
    apiUrl: parsed.data.FLYLINK_API_URL,
    apiKey: parsed.data.FLYLINK_API_KEY,
    webhookSecret: parsed.data.FLYLINK_WEBHOOK_SECRET,
  },
  llm: {
    apiUrl: parsed.data.OPENAI_API_URL,
    apiKey: parsed.data.OPENAI_API_KEY,
    model: parsed.data.OPENAI_MODEL,
    intentModel: parsed.data.INTENT_MODEL,
  },
  corsOrigin: parsed.data.CORS_ORIGIN,
};
