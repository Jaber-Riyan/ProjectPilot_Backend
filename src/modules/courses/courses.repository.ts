import { PrismaClient, Course, Prisma } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';
import { calculatePagination } from '../../utils/pagination';
import { CourseDetailWithModules, CourseWithModuleCount, PaginatedCourses } from './courses.types';

export class CourseRepository {
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

  async findById(id: string): Promise<Course | null> {
    return this.client.course.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Course | null> {
    return this.client.course.findUnique({
      where: { slug },
    });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.client.course.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) return false;
    if (excludeId && existing.id === excludeId) return false;
    return true;
  }

  async findMany(
    where: Prisma.CourseWhereInput = {},
    page = 1,
    limit = 20
  ): Promise<PaginatedCourses> {
    const total = await this.client.course.count({ where });
    const pagination = calculatePagination({ page, limit }, total);

    const items = await this.client.course.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        _count: {
          select: { modules: true },
        },
      },
    });

    return {
      items: items as CourseWithModuleCount[],
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPrevPage: pagination.hasPrevPage,
    };
  }

  async findDetail(
    idOrSlug: string,
    isMentorOrAdmin: boolean
  ): Promise<CourseDetailWithModules | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const where: Prisma.CourseWhereUniqueInput = isUuid ? { id: idOrSlug } : { slug: idOrSlug };

    // Student/public query filters out draft modules
    const moduleWhere: Prisma.ModuleWhereInput = isMentorOrAdmin ? {} : { isPublished: true };

    const course = await this.client.course.findUnique({
      where,
      include: {
        modules: {
          where: moduleWhere,
          orderBy: { order: 'asc' },
          include: {
            contentItems: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    return course as CourseDetailWithModules | null;
  }

  async create(data: Prisma.CourseCreateInput): Promise<Course> {
    return this.client.course.create({ data });
  }

  async update(id: string, data: Prisma.CourseUpdateInput): Promise<Course> {
    return this.client.course.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Course> {
    return this.client.course.delete({
      where: { id },
    });
  }
}

export const courseRepository = new CourseRepository();
