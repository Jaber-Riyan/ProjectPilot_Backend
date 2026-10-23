import { PrismaClient, Module, Prisma } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';

export class ModuleRepository {
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

  async findById(id: string): Promise<Module | null> {
    return this.client.module.findUnique({
      where: { id },
    });
  }

  async findDetail(id: string) {
    return this.client.module.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            isPublished: true,
          },
        },
        contentItems: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findByCourseId(courseId: string, onlyPublished = false): Promise<Module[]> {
    const where: Prisma.ModuleWhereInput = {
      courseId,
      ...(onlyPublished ? { isPublished: true } : {}),
    };

    return this.client.module.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        contentItems: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async getMaxOrder(courseId: string): Promise<number> {
    const agg = await this.client.module.aggregate({
      where: { courseId },
      _max: { order: true },
    });
    return agg._max.order ?? 0;
  }

  async create(data: Prisma.ModuleCreateInput): Promise<Module> {
    return this.client.module.create({ data });
  }

  async update(id: string, data: Prisma.ModuleUpdateInput): Promise<Module> {
    return this.client.module.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Module> {
    return this.client.module.delete({
      where: { id },
    });
  }

  /**
   * Reorders modules safely within a parent course using a two-phase transaction
   * to guarantee no unique constraint collisions on (courseId, order).
   */
  async reorder(courseId: string, moduleIds: string[]): Promise<Module[]> {
    return this.client.$transaction(async (tx) => {
      // 1. Phase 1: Set temporary negative orders to avoid @@unique([courseId, order]) collisions
      for (let i = 0; i < moduleIds.length; i++) {
        const id = moduleIds[i];
        if (!id) continue;
        await tx.module.update({
          where: { id },
          data: { order: -(i + 1000) },
        });
      }

      // 2. Phase 2: Set final sequential positive 1-based orders
      for (let i = 0; i < moduleIds.length; i++) {
        const id = moduleIds[i];
        if (!id) continue;
        await tx.module.update({
          where: { id },
          data: { order: i + 1 },
        });
      }

      // 3. Return final ordered modules
      return tx.module.findMany({
        where: { courseId },
        orderBy: { order: 'asc' },
      });
    });
  }
}

export const moduleRepository = new ModuleRepository();
