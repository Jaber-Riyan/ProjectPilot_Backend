import { User } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { AppError } from '../../errors/app-error';
import { hashPassword, verifyPassword } from '../../lib/password';
import { generateToken } from '../../lib/jwt';
import { authRepository, AuthRepository } from './auth.repository';
import { SignupInput, LoginInput, AuthUserDto, AuthResponseData } from './auth.types';

export class AuthService {
  private repository: AuthRepository;

  constructor(repository: AuthRepository = authRepository) {
    this.repository = repository;
  }

  /**
   * Sanitizes a User entity by removing sensitive fields (e.g. passwordHash).
   */
  public sanitizeUser(user: User): AuthUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  /**
   * Registers a new student account.
   * Public signup strictly assigns Role.STUDENT regardless of client input.
   */
  async signup(input: SignupInput): Promise<AuthResponseData> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Check for existing account with the same email
    const existingUser = await this.repository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw AppError.conflict(
        'An account with this email address already exists',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // 2. Hash password using Argon2id
    const passwordHash = await hashPassword(input.password);

    // 3. Persist new user with strictly STUDENT role
    const user = await this.repository.create({
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: Role.STUDENT,
      isActive: true,
    });

    // 4. Generate JWT access token
    const token = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Authenticates any existing active user (STUDENT, MENTOR, ADMIN).
   * Returns identical generic 401 response for non-existent email and wrong password.
   */
  async login(input: LoginInput): Promise<AuthResponseData> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Look up user by normalized email
    const user = await this.repository.findByEmail(normalizedEmail);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // 2. Verify password with Argon2id
    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // 3. Verify user account is active
    if (!user.isActive) {
      throw AppError.unauthorized(
        'Account is deactivated. Please contact support.',
        'ACCOUNT_DEACTIVATED'
      );
    }

    // 4. Generate JWT access token
    const token = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }
}

export const authService = new AuthService();
