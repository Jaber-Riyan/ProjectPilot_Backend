import { PrismaClient, Submission, Prisma } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';
import { calculatePagination } from '../../utils/pagination';
import { AppError } from '../../errors/app-error';
import {
  CreateSubmissionInput,
  PaginatedSubmissions,
  SubmissionDetail,
  SubmissionWithStudent,
} from './submissions.types';

export class SubmissionRepository {
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

  async findById(id: string): Promise<Submission | null> {
    return this.client.submission.findUnique({
      where: { id },
    });
  }

  async findDetail(id: string): Promise<SubmissionDetail | null> {
    const submission = await this.client.submission.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            instructions: true,
            submissionPolicy: true,
          },
        },
        feedbacks: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return submission as SubmissionDetail | null;
  }

  async findAttemptsByStudent(
    assignmentId: string,
    studentId: string
  ): Promise<SubmissionDetail[]> {
    const submissions = await this.client.submission.findMany({
      where: {
        assignmentId,
        studentId,
      },
      orderBy: { attemptNumber: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            instructions: true,
            submissionPolicy: true,
          },
        },
        feedbacks: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return submissions as SubmissionDetail[];
  }

  async findMany(
    assignmentId: string,
    where: Prisma.SubmissionWhereInput = {},
    page = 1,
    limit = 20
  ): Promise<PaginatedSubmissions> {
    const combinedWhere: Prisma.SubmissionWhereInput = {
      ...where,
      assignmentId,
    };

    const total = await this.client.submission.count({ where: combinedWhere });
    const pagination = calculatePagination({ page, limit }, total);

    const items = await this.client.submission.findMany({
      where: combinedWhere,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        student: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            submissionPolicy: true,
          },
        },
        _count: {
          select: {
            feedbacks: true,
          },
        },
      },
    });

    return {
      items: items as unknown as SubmissionWithStudent[],
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPrevPage: pagination.hasPrevPage,
    };
  }

  /**
   * Concurrency-safe atomic submission creation using PostgreSQL transaction-level
   * advisory lock and database unique constraint.
   */
  async createAtomicSubmission(
    assignmentId: string,
    studentId: string,
    input: CreateSubmissionInput
  ): Promise<SubmissionDetail> {
    return this.client.$transaction(async (tx) => {
      // 1. Acquire transaction advisory lock scoped to assignment and student
      const lockKey = `sub:${assignmentId}:${studentId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // 2. Fetch assignment to inspect submission policy and existence
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
      });

      if (!assignment) {
        throw AppError.notFound('Assignment not found', 'ASSIGNMENT_NOT_FOUND');
      }

      if (!assignment.isPublished) {
        throw AppError.notFound('Assignment not found', 'ASSIGNMENT_NOT_FOUND');
      }

      // 3. Find existing attempts
      const existingAttempts = await tx.submission.findMany({
        where: { assignmentId, studentId },
        orderBy: { attemptNumber: 'desc' },
        select: { attemptNumber: true },
      });

      if (assignment.submissionPolicy === 'ONE_TIME' && existingAttempts.length > 0) {
        throw AppError.conflict(
          'This assignment only allows a single submission attempt.',
          'SUBMISSION_POLICY_VIOLATION'
        );
      }

      const nextAttemptNumber =
        existingAttempts.length > 0 ? (existingAttempts[0]?.attemptNumber ?? 0) + 1 : 1;

      // 4. Create new submission attempt row
      const newSubmission = await tx.submission.create({
        data: {
          assignmentId,
          studentId,
          attemptNumber: nextAttemptNumber,
          projectName: input.projectName.trim(),
          repoUrl: input.repoUrl.trim(),
          liveUrl: input.liveUrl?.trim() || null,
          description: input.description?.trim() || null,
        },
        include: {
          student: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          assignment: {
            select: {
              id: true,
              title: true,
              instructions: true,
              submissionPolicy: true,
            },
          },
          feedbacks: {
            include: {
              mentor: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return newSubmission as SubmissionDetail;
    });
  }
}

export const submissionRepository = new SubmissionRepository();
