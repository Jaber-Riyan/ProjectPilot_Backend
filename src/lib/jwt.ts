import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '../models';

export interface TokenPayload {
  sub: string; // User ID
  email: string;
  role: Role;
  name?: string;
}

export interface DecodedToken extends TokenPayload {
  name: string;
  iat: number;
  exp: number;
}

/**
 * Signs a short-lived access JWT token with HS256 algorithm.
 */
export function signAccessToken(
  payload: TokenPayload,
  expiresIn: string = env.JWT_EXPIRES_IN
): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: expiresIn as SignOptions['expiresIn'],
    subject: payload.sub,
  };

  return jwt.sign(
    {
      email: payload.email,
      role: payload.role,
      name: payload.name ?? '',
    },
    env.JWT_SECRET,
    options
  );
}

/**
 * Verifies and decodes a signed JWT access token.
 */
export function verifyAccessToken(token: string): DecodedToken {
  const options: VerifyOptions = {
    algorithms: ['HS256'],
  };

  const decoded = jwt.verify(token, env.JWT_SECRET, options) as jwt.JwtPayload;

  if (!decoded.sub || typeof decoded.sub !== 'string') {
    throw new Error('Token subject claim (sub) is missing or invalid');
  }

  return {
    sub: decoded.sub,
    email: (decoded.email as string) || '',
    role: decoded.role as Role,
    name: (decoded.name as string) || '',
    iat: decoded.iat ?? 0,
    exp: decoded.exp ?? 0,
  };
}

// Aliases for convenience and flexible imports
export const generateToken = signAccessToken;
export const verifyToken = verifyAccessToken;
