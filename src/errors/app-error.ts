export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponseError {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(400, code, message, true, details);
  }

  static unauthorized(message = 'Unauthorized access', code = 'UNAUTHORIZED'): AppError {
    return new AppError(401, code, message, true);
  }

  static forbidden(message = 'Forbidden access', code = 'FORBIDDEN'): AppError {
    return new AppError(403, code, message, true);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND'): AppError {
    return new AppError(404, code, message, true);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(409, code, message, true);
  }

  static unprocessableEntity(message: string, details?: unknown, code = 'VALIDATION_ERROR'): AppError {
    return new AppError(422, code, message, true, details);
  }

  static internal(message = 'An unexpected internal error occurred', code = 'INTERNAL_SERVER_ERROR'): AppError {
    return new AppError(500, code, message, false);
  }
}
