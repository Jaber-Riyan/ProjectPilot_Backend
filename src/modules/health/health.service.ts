import { env } from '../../config/env';
import { checkDatabaseConnection } from '../../db/prisma';

export interface HealthLivenessData {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  version: string;
}

export interface HealthReadinessData {
  status: 'ok' | 'degraded';
  services: {
    http: 'up';
    database: 'connected' | 'disconnected' | 'not_configured';
  };
  latencyMs?: number;
  error?: string;
  timestamp: string;
}

export class HealthService {
  getLiveness(): HealthLivenessData {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '1.0.0',
    };
  }

  async getReadiness(): Promise<HealthReadinessData> {
    const timestamp = new Date().toISOString();

    if (!env.DATABASE_URL) {
      return {
        status: 'degraded',
        services: {
          http: 'up',
          database: 'not_configured',
        },
        timestamp,
      };
    }

    const check = await checkDatabaseConnection();

    if (check.connected) {
      return {
        status: 'ok',
        services: {
          http: 'up',
          database: 'connected',
        },
        latencyMs: check.latencyMs,
        timestamp,
      };
    }

    return {
      status: 'degraded',
      services: {
        http: 'up',
        database: 'disconnected',
      },
      error: check.error,
      timestamp,
    };
  }
}

export const healthService = new HealthService();
