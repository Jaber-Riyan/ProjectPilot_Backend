import { PrismaClient, Module, CourseModule, Prisma } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';
import { calculatePagination } from '../../utils/pagination';
import { PaginatedModules, ModuleDetailWithContent } from './modules.types';

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
        contentItems: {
          orderBy: { order: 'asc' },
        },
        courseModules: {
          orderBy: { order: 'asc' },
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                isPublished: true,
              },
            },
          },
        },
      },
    });
  }

  async findMany(
    where: Prisma.ModuleWhereInput = {},
    page = 1,
    limit = 20
  ): Promise<PaginatedModules> {
    const total = await this.client.module.count({ where });
    const pagination = calculatePagination({ page, limit }, total);

    const items = await this.client.module.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        _count: {
          select: {
            contentItems: true,
            courseModules: true,
          },
        },
      },
    });

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPrevPage: pagination.hasPrevPage,
    };
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

  async findCourseModule(courseId: string, moduleId: string): Promise<CourseModule | null> {
    return this.client.courseModule.findUnique({
      where: {
        courseId_moduleId: {
          courseId,
          moduleId,
        },
      },
    });
  }

  async findByCourseId(
    courseId: string,
    onlyPublished = false
  ): Promise<ModuleDetailWithContent[]> {
    const courseModules = await this.client.courseModule.findMany({
      where: {
        courseId,
        ...(onlyPublished ? { module: { isPublished: true } } : {}),
      },
      orderBy: { order: 'asc' },
      include: {
        module: {
          include: {
            contentItems: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    return courseModules.map((cm) => ({
      ...cm.module,
      order: cm.order,
      courseModuleId: cm.id,
    }));
  }

  async getMaxOrder(courseId: string): Promise<number> {
    const agg = await this.client.courseModule.aggregate({
      where: { courseId },
      _max: { order: true },
    });
    return agg._max.order ?? 0;
  }

  async attachToCourse(
    courseId: string,
    moduleId: string,
    order: number
  ): Promise<CourseModule> {
    return this.client.courseModule.create({
      data: {
        courseId,
        moduleId,
        order,
      },
    });
  }

  async detachFromCourse(courseId: string, moduleId: string): Promise<CourseModule> {
    return this.client.courseModule.delete({
      where: {
        courseId_moduleId: {
          courseId,
          moduleId,
        },
      },
    });
  }

  async countCourseModules(moduleId: string): Promise<number> {
    return this.client.courseModule.count({
      where: { moduleId },
    });
  }

  /**
   * Reorders modules safely within a parent course using a two-phase transaction
   * to guarantee no unique constraint collisions on (courseId, order).
   */
  async reorder(courseId: string, moduleIds: string[]): Promise<ModuleDetailWithContent[]> {
    return this.client.$transaction(async (tx) => {
      // 1. Phase 1: Set temporary negative orders to avoid @@unique([courseId, order]) collisions
      for (let i = 0; i < moduleIds.length; i++) {
        const moduleId = moduleIds[i];
        if (!moduleId) continue;
        await tx.courseModule.update({
          where: { courseId_moduleId: { courseId, moduleId } },
          data: { order: -(i + 1000) },
        });
      }

      // 2. Phase 2: Set final sequential positive 1-based orders
      for (let i = 0; i < moduleIds.length; i++) {
        const moduleId = moduleIds[i];
        if (!moduleId) continue;
        await tx.courseModule.update({
          where: { courseId_moduleId: { courseId, moduleId } },
          data: { order: i + 1 },
        });
      }

      // 3. Return final ordered modules
      const courseModules = await tx.courseModule.findMany({
        where: { courseId },
        orderBy: { order: 'asc' },
        include: {
          module: {
            include: {
              contentItems: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      return courseModules.map((cm) => ({
        ...cm.module,
        order: cm.order,
        courseModuleId: cm.id,
      }));
    });
  }
}

export const moduleRepository = new ModuleRepository();
