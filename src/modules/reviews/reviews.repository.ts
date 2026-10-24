import { PrismaClient, Prisma } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';
import { calculatePagination } from '../../utils/pagination';
import {
  PaginatedReviewQueue,
  ReviewQueueItem,
  ReviewSubmissionDetail,
} from './reviews.types';

export class ReviewRepository {
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

  async findQueue(
    where: Prisma.SubmissionWhereInput = {},
    page = 1,
    limit = 20
  ): Promise<PaginatedReviewQueue> {
    const total = await this.client.submission.count({ where });
    const pagination = calculatePagination({ page, limit }, total);

    const items = await this.client.submission.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            submissionPolicy: true,
            createdById: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
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
      items: items as unknown as ReviewQueueItem[],
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPrevPage: pagination.hasPrevPage,
    };
  }

  async findSubmissionForReview(
    submissionId: string
  ): Promise<ReviewSubmissionDetail | null> {
    const submission = await this.client.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            instructions: true,
            submissionPolicy: true,
            createdById: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        feedbacks: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return submission as ReviewSubmissionDetail | null;
  }

  /**
   * Concurrency-safe review execution inside an isolated database transaction
   * using a PostgreSQL transaction-level advisory lock scoped to the submission.
   */
  async executeReviewAtomic<T>(
    submissionId: string,
    callback: (tx: Prisma.TransactionClient, currentSubmission: ReviewSubmissionDetail) => Promise<T>
  ): Promise<T> {
    return this.client.$transaction(async (tx) => {
      // 1. Acquire transaction-level advisory lock scoped to this submission
      const lockKey = `review:${submissionId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // 2. Fetch fresh locked submission state
      const current = (await tx.submission.findUnique({
        where: { id: submissionId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignment: {
            select: {
              id: true,
              title: true,
              instructions: true,
              submissionPolicy: true,
              createdById: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          feedbacks: {
            include: {
              mentor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })) as ReviewSubmissionDetail | null;

      if (!current) {
        throw new Error('SUBMISSION_NOT_FOUND');
      }

      // 3. Execute review logic under the lock
      return callback(tx, current);
    },
    {
      maxWait: 10000,
      timeout: 15000,
    });
  }
}

export const reviewRepository = new ReviewRepository();
