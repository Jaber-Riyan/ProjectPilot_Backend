import type { Role } from '../models';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
      user?: AuthenticatedUser;
    }
  }
}

export {};
