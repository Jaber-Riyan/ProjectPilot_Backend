type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'auth',
  'jwt',
  'secret',
  'cookie',
  'database_url',
  'direct_url',
  'api_key',
  'apikey',
]);

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return '[REDACTED]';
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map((item, index) => sanitizeValue(String(index), item));
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitizedObj[k] = sanitizeValue(k, v);
    }
    return sanitizedObj;
  }

  return value;
}

function formatContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  return sanitizeValue('root', context) as LogContext;
}

class Logger {
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const sanitizedContext = formatContext(context);

    if (this.isProduction) {
      const payload: Record<string, unknown> = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...sanitizedContext,
      };
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    } else {
      const contextStr = sanitizedContext && Object.keys(sanitizedContext).length > 0
        ? ` ${JSON.stringify(sanitizedContext)}`
        : '';
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

      if (level === 'error') {
        process.stderr.write(`${prefix} ${message}${contextStr}\n`);
      } else {
        process.stdout.write(`${prefix} ${message}${contextStr}\n`);
      }
    }
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, context);
    }
  }
}

export const logger = new Logger();
