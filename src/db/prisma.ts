import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';
import { logger } from '../lib/logger';

// Configure WebSocket for Node.js environments when running Neon serverless pooler
if (!globalThis.WebSocket) {
  neonConfig.webSocketConstructor = ws;
}

// Global declaration to maintain singleton across hot-reloads (tsx watch)
declare global {
  var __prismaClient: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (!globalThis.__prismaClient) {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured. Cannot initialize Prisma Client.');
    }
    const adapter = new PrismaNeon({
      connectionString: env.DATABASE_URL,
    });
    globalThis.__prismaClient = new PrismaClient({ adapter });
  }
  return globalThis.__prismaClient;
}

// Lazy proxy singleton: only instantiates PrismaClient when accessed, preventing connection on import
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export type PrismaClientInstance = PrismaClient;

export interface DatabaseCheckResult {
  connected: boolean;
  latencyMs?: number;
  error?: string;
}

export async function checkDatabaseConnection(): Promise<DatabaseCheckResult> {
  if (!env.DATABASE_URL) {
    return {
      connected: false,
      error: 'DATABASE_URL is not configured',
    };
  }

  const startTime = Date.now();
  try {
    const client = getPrismaClient();
    // Harmless ping to verify connectivity without changing remote state
    await client.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Log error without exposing credentials or secrets
    logger.error('Database connectivity check failed', {
      error: message.replace(/:[^:@]+@/, ':***@'),
    });
    return {
      connected: false,
      error: 'Database connection failed',
    };
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (globalThis.__prismaClient) {
    await globalThis.__prismaClient.$disconnect();
    globalThis.__prismaClient = undefined;
  }
}
