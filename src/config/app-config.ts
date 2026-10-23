import { env } from './env';

export interface AppConfig {
  env: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  server: {
    port: number;
    apiPrefix: string;
  };
  cors: {
    origin: string;
  };
  pagination: {
    defaultPage: number;
    defaultLimit: number;
    maxLimit: number;
  };
  security: {
    bodyLimit: string;
    jsonLimit: string;
  };
}

export const appConfig: AppConfig = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  server: {
    port: env.PORT,
    apiPrefix: '/api/v1',
  },
  cors: {
    origin: env.CORS_ORIGIN,
  },
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },
  security: {
    bodyLimit: '10mb',
    jsonLimit: '10mb',
  },
};
