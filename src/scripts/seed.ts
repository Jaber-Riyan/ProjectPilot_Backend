import { env } from '../config/env';
import { getPrismaClient, disconnectDatabase } from '../db/prisma';
import { Role } from '../models';
import { hashPassword } from '../lib/password';
import { logger } from '../lib/logger';

export interface SeedResult {
  mentorCreated: boolean;
  adminCreated: boolean;
  mentorEmail: string;
  adminEmail: string;
}

export async function seedDatabase(): Promise<SeedResult> {
  const prisma = getPrismaClient();

  const mentorEmail = env.SEED_MENTOR_EMAIL.trim().toLowerCase();
  const mentorPassword = env.SEED_MENTOR_PASSWORD;

  const adminEmail = env.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const adminPassword = env.SEED_ADMIN_PASSWORD;

  let mentorCreated = false;
  let adminCreated = false;

  logger.info('Starting idempotent database seeding...');

  // 1. Seed Mentor Account
  const existingMentor = await prisma.user.findUnique({
    where: { email: mentorEmail },
  });

  if (!existingMentor) {
    logger.info(`Creating initial mentor account for: ${mentorEmail}`);
    const passwordHash = await hashPassword(mentorPassword);

    await prisma.user.create({
      data: {
        name: 'Default Mentor',
        email: mentorEmail,
        passwordHash,
        role: Role.MENTOR,
        isActive: true,
      },
    });
    mentorCreated = true;
    logger.info(`Successfully created mentor account: ${mentorEmail}`);
  } else {
    logger.info(`Mentor account already exists: ${mentorEmail} (skipping creation)`);
    // Ensure mentor role is correctly aligned
    if (existingMentor.role !== Role.MENTOR || !existingMentor.isActive) {
      await prisma.user.update({
        where: { id: existingMentor.id },
        data: { role: Role.MENTOR, isActive: true },
      });
      logger.info(`Updated existing mentor account permissions: ${mentorEmail}`);
    }
  }

  // 2. Seed Admin Account
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    logger.info(`Creating initial admin account for: ${adminEmail}`);
    const passwordHash = await hashPassword(adminPassword);

    await prisma.user.create({
      data: {
        name: 'System Admin',
        email: adminEmail,
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });
    adminCreated = true;
    logger.info(`Successfully created admin account: ${adminEmail}`);
  } else {
    logger.info(`Admin account already exists: ${adminEmail} (skipping creation)`);
    // Ensure admin role is correctly aligned
    if (existingAdmin.role !== Role.ADMIN || !existingAdmin.isActive) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: Role.ADMIN, isActive: true },
      });
      logger.info(`Updated existing admin account permissions: ${adminEmail}`);
    }
  }

  logger.info('Database seeding completed successfully', {
    mentorEmail,
    adminEmail,
    mentorCreated,
    adminCreated,
  });

  return {
    mentorCreated,
    adminCreated,
    mentorEmail,
    adminEmail,
  };
}

async function main(): Promise<void> {
  try {
    await seedDatabase();
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed with error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await disconnectDatabase();
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
