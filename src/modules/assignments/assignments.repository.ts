import { PrismaClient, Assignment, Prisma } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';
import { calculatePagination } from '../../utils/pagination';
import { PaginatedAssignments, AssignmentDetail, AssignmentWithCount } from './assignments.types';

export class AssignmentRepository {
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

  async findById(id: string): Promise<Assignment | null> {
    return this.client.assignment.findUnique({
      where: { id },
    });
  }

  async findDetail(id: string): Promise<AssignmentDetail | null> {
    const assignment = await this.client.assignment.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        contentItems: {
          select: {
            id: true,
            title: true,
            moduleId: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            submissions: true,
            contentItems: true,
          },
        },
      },
    });

    return assignment as AssignmentDetail | null;
  }

  async findMany(
    where: Prisma.AssignmentWhereInput = {},
    page = 1,
    limit = 20
  ): Promise<PaginatedAssignments> {
    const total = await this.client.assignment.count({ where });
    const pagination = calculatePagination({ page, limit }, total);

    const items = await this.client.assignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            submissions: true,
            contentItems: true,
          },
        },
      },
    });

    return {
      items: items as AssignmentWithCount[],
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPrevPage: pagination.hasPrevPage,
    };
  }

  async create(data: Prisma.AssignmentCreateInput): Promise<Assignment> {
    return this.client.assignment.create({ data });
  }

  async update(id: string, data: Prisma.AssignmentUpdateInput): Promise<Assignment> {
    return this.client.assignment.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Assignment> {
    return this.client.assignment.delete({
      where: { id },
    });
  }

  async countSubmissions(assignmentId: string): Promise<number> {
    return this.client.submission.count({
      where: { assignmentId },
    });
  }

  async hasMultipleAttempts(assignmentId: string): Promise<boolean> {
    const multiple = await this.client.submission.findFirst({
      where: {
        assignmentId,
        attemptNumber: { gt: 1 },
      },
      select: { id: true },
    });
    return !!multiple;
  }
}

export const assignmentRepository = new AssignmentRepository();
