import { PrismaClient, User } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { getPrismaClient } from '../../db/prisma';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
  isActive?: boolean;
}

export class AuthRepository {
  private clientGetter: () => PrismaClient;

  constructor(clientOrGetter?: PrismaClient | (() => PrismaClient)) {
    if (typeof clientOrGetter === 'function') {
      this.clientGetter = clientOrGetter;
    } else if (clientOrGetter) {
      this.clientGetter = () => clientOrGetter;
    } else {
      this.clientGetter = () => getPrismaClient();
    }
  }

  private get client(): PrismaClient {
    return this.clientGetter();
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.client.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.client.user.findUnique({
      where: { id },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    const normalizedEmail = data.email.trim().toLowerCase();
    return this.client.user.create({
      data: {
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash: data.passwordHash,
        role: data.role ?? Role.STUDENT,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.client.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async updateActiveStatus(id: string, isActive: boolean): Promise<User> {
    return this.client.user.update({
      where: { id },
      data: { isActive },
    });
  }

  async delete(id: string): Promise<User> {
    return this.client.user.delete({
      where: { id },
    });
  }
}

export const authRepository = new AuthRepository();
