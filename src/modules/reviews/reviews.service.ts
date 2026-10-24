import { Role, SubmissionPolicy, SubmissionStatus } from '../../models';
import { AppError } from '../../errors/app-error';
import { AuthenticatedUser } from '../../types/express';
import { reviewRepository, ReviewRepository } from './reviews.repository';
import {
  CreateReviewInput,
  UpdateReviewInput,
  PaginatedReviewQueue,
  ReviewSubmissionDetail,
} from './reviews.types';
import { ReviewQueueQuerySchemaInput } from './reviews.schema';
import { Prisma } from '../../generated/prisma/client';

export class ReviewService {
  private repository: ReviewRepository;

  // Explicit, protected state transition matrix
  private readonly validTransitions: Record<SubmissionStatus, SubmissionStatus[]> = {
    [SubmissionStatus.PENDING]: [
      SubmissionStatus.UNDER_REVIEW,
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.RESUBMISSION_REQUESTED,
    ],
    [SubmissionStatus.UNDER_REVIEW]: [
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.RESUBMISSION_REQUESTED,
    ],
    [SubmissionStatus.APPROVED]: [],
    [SubmissionStatus.REJECTED]: [],
    [SubmissionStatus.RESUBMISSION_REQUESTED]: [],
  };

  constructor(repository: ReviewRepository = reviewRepository) {
    this.repository = repository;
  }

  async getReviewQueue(
    query: ReviewQueueQuerySchemaInput,
    user: AuthenticatedUser
  ): Promise<PaginatedReviewQueue> {
    const where: Prisma.SubmissionWhereInput = {};

    // 1. Reviewer Authorization Scope
    if (user.role === Role.MENTOR) {
      // Mentors only see submissions for assignments they own
      where.assignment = {
        createdById: user.id,
      };
      if (query.assignmentId) {
        where.assignment.id = query.assignmentId;
      }
    } else if (user.role === Role.ADMIN) {
      // Admins can see all submissions or filter by assignmentId
      if (query.assignmentId) {
        where.assignmentId = query.assignmentId;
      }
    } else {
      throw AppError.forbidden('Only mentors and administrators can access the review queue', 'FORBIDDEN');
    }

    // 2. Status filter (default to submissions awaiting review if status is omitted)
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = {
        in: [SubmissionStatus.PENDING, SubmissionStatus.UNDER_REVIEW],
      };
    }

    // 3. Student filter
    if (query.studentId) {
      where.studentId = query.studentId;
    }

    // 4. Date range filter
    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    return this.repository.findQueue(where, query.page, query.limit);
  }

  async getSubmissionDetailForReview(
    submissionId: string,
    user: AuthenticatedUser
  ): Promise<ReviewSubmissionDetail> {
    const submission = await this.repository.findSubmissionForReview(submissionId);
    if (!submission) {
      throw AppError.notFound('Submission not found', 'SUBMISSION_NOT_FOUND');
    }

    // Scope check: Mentor must own the assignment
    if (
      user.role === Role.MENTOR &&
      submission.assignment.createdById &&
      submission.assignment.createdById !== user.id
    ) {
      throw AppError.forbidden(
        'You do not have permission to view submissions for this assignment',
        'FORBIDDEN'
      );
    }

    return submission;
  }

  async createReview(
    submissionId: string,
    input: CreateReviewInput,
    user: AuthenticatedUser
  ): Promise<ReviewSubmissionDetail> {
    try {
      return await this.repository.executeReviewAtomic(submissionId, async (tx, current) => {
        // 1. Mentor Scope check
        if (
          user.role === Role.MENTOR &&
          current.assignment.createdById &&
          current.assignment.createdById !== user.id
        ) {
          throw AppError.forbidden(
            'You do not have permission to review submissions for this assignment',
            'FORBIDDEN'
          );
        }

        // 2. State transition validation
        const allowedNextStates = this.validTransitions[current.status] || [];
        if (!allowedNextStates.includes(input.status)) {
          throw AppError.conflict(
            `Invalid status transition from ${current.status} to ${input.status}`,
            'INVALID_STATUS_TRANSITION'
          );
        }

        // 3. Resubmission Policy check
        if (input.status === SubmissionStatus.RESUBMISSION_REQUESTED) {
          if (current.assignment.submissionPolicy !== SubmissionPolicy.RESUBMITTABLE) {
            throw AppError.conflict(
              'Cannot request resubmission for an assignment with a ONE_TIME submission policy',
              'RESUBMISSION_NOT_ALLOWED'
            );
          }
        }

        // 4. Feedback requirement check
        if (
          input.status === SubmissionStatus.REJECTED ||
          input.status === SubmissionStatus.RESUBMISSION_REQUESTED
        ) {
          if (!input.comment || input.comment.trim().length === 0) {
            throw AppError.badRequest(
              'Written feedback is required when rejecting a submission or requesting resubmission',
              'FEEDBACK_REQUIRED'
            );
          }
        }

        // 5. Update submission record
        await tx.submission.update({
          where: { id: submissionId },
          data: {
            status: input.status,
            reviewedBy: { connect: { id: user.id } },
            reviewedAt: new Date(),
          },
        });

        // 6. Record feedback entry if written feedback is provided
        if (input.comment && input.comment.trim().length > 0) {
          await tx.feedback.create({
            data: {
              submissionId,
              mentorId: user.id,
              comment: input.comment.trim(),
            },
          });
        }

        // 7. Fetch and return complete updated state
        const updated = await tx.submission.findUnique({
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

        return updated as unknown as ReviewSubmissionDetail;
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SUBMISSION_NOT_FOUND') {
        throw AppError.notFound('Submission not found', 'SUBMISSION_NOT_FOUND');
      }
      throw err;
    }
  }

  async updateReview(
    submissionId: string,
    input: UpdateReviewInput,
    user: AuthenticatedUser
  ): Promise<ReviewSubmissionDetail> {
    try {
      return await this.repository.executeReviewAtomic(submissionId, async (tx, current) => {
        // 1. Mentor Scope and Ownership check
        if (user.role === Role.MENTOR) {
          if (
            current.assignment.createdById &&
            current.assignment.createdById !== user.id
          ) {
            throw AppError.forbidden(
              'You do not have permission to review submissions for this assignment',
              'FORBIDDEN'
            );
          }
          if (current.reviewedById && current.reviewedById !== user.id) {
            throw AppError.forbidden(
              'Only the original reviewer or an administrator may update this review',
              'FORBIDDEN'
            );
          }
        }

        // 2. Validate transition if status is being updated
        if (input.status !== undefined && input.status !== current.status) {
          const allowedNextStates = this.validTransitions[current.status] || [];
          if (!allowedNextStates.includes(input.status) && user.role !== Role.ADMIN) {
            throw AppError.conflict(
              `Invalid status transition from ${current.status} to ${input.status}`,
              'INVALID_STATUS_TRANSITION'
            );
          }

          if (input.status === SubmissionStatus.RESUBMISSION_REQUESTED) {
            if (current.assignment.submissionPolicy !== SubmissionPolicy.RESUBMITTABLE) {
              throw AppError.conflict(
                'Cannot request resubmission for an assignment with a ONE_TIME submission policy',
                'RESUBMISSION_NOT_ALLOWED'
              );
            }
          }
        }

        // 3. Update submission record
        const updateData: Prisma.SubmissionUpdateInput = {
          reviewedBy: { connect: { id: user.id } },
          reviewedAt: new Date(),
        };

        if (input.status !== undefined) {
          updateData.status = input.status;
        }

        await tx.submission.update({
          where: { id: submissionId },
          data: updateData,
        });

        // 4. Create new feedback entry if comment provided
        if (input.comment && input.comment.trim().length > 0) {
          await tx.feedback.create({
            data: {
              submissionId,
              mentorId: user.id,
              comment: input.comment.trim(),
            },
          });
        }

        // 5. Fetch updated detail
        const updated = await tx.submission.findUnique({
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

        return updated as unknown as ReviewSubmissionDetail;
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SUBMISSION_NOT_FOUND') {
        throw AppError.notFound('Submission not found', 'SUBMISSION_NOT_FOUND');
      }
      throw err;
    }
  }
}

export const reviewService = new ReviewService();
