import { Role } from '../../models';
import { AppError } from '../../errors/app-error';
import { AuthenticatedUser } from '../../types/express';
import { submissionRepository, SubmissionRepository } from './submissions.repository';
import {
  CreateSubmissionInput,
  PaginatedSubmissions,
  SubmissionDetail,
} from './submissions.types';
import { SubmissionQuerySchemaInput } from './submissions.schema';
import { Prisma } from '../../generated/prisma/client';

export class SubmissionService {
  private repository: SubmissionRepository;

  constructor(repository: SubmissionRepository = submissionRepository) {
    this.repository = repository;
  }

  async submitAssignment(
    assignmentId: string,
    studentId: string,
    input: CreateSubmissionInput
  ): Promise<SubmissionDetail> {
    return this.repository.createAtomicSubmission(assignmentId, studentId, input);
  }

  async getMyAttempts(
    assignmentId: string,
    studentId: string
  ): Promise<SubmissionDetail[]> {
    return this.repository.findAttemptsByStudent(assignmentId, studentId);
  }

  async listSubmissions(
    assignmentId: string,
    query: SubmissionQuerySchemaInput
  ): Promise<PaginatedSubmissions> {
    const where: Prisma.SubmissionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.studentId) {
      where.studentId = query.studentId;
    }

    return this.repository.findMany(assignmentId, where, query.page, query.limit);
  }

  async getSubmissionDetail(
    submissionId: string,
    user: AuthenticatedUser
  ): Promise<SubmissionDetail> {
    const submission = await this.repository.findDetail(submissionId);
    if (!submission) {
      throw AppError.notFound('Submission not found', 'SUBMISSION_NOT_FOUND');
    }

    // Role check: Only the student who submitted or a Mentor/Admin may view
    const isMentorOrAdmin = user.role === Role.MENTOR || user.role === Role.ADMIN;
    if (user.role === Role.STUDENT && submission.studentId !== user.id) {
      throw AppError.forbidden(
        'You do not have permission to view this submission',
        'FORBIDDEN'
      );
    }

    if (!isMentorOrAdmin && submission.studentId !== user.id) {
      throw AppError.forbidden(
        'You do not have permission to view this submission',
        'FORBIDDEN'
      );
    }

    return submission;
  }
}

export const submissionService = new SubmissionService();
