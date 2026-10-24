import { Assignment, Role, SubmissionPolicy } from '../../models';
import { AppError } from '../../errors/app-error';
import { AuthenticatedUser } from '../../types/express';
import { assignmentRepository, AssignmentRepository } from './assignments.repository';
import {
  CreateAssignmentInput,
  UpdateAssignmentInput,
  PaginatedAssignments,
  AssignmentDetail,
} from './assignments.types';
import { AssignmentQuerySchemaInput } from './assignments.schema';
import { Prisma } from '../../generated/prisma/client';

export class AssignmentService {
  private repository: AssignmentRepository;

  constructor(repository: AssignmentRepository = assignmentRepository) {
    this.repository = repository;
  }

  async createAssignment(
    input: CreateAssignmentInput,
    user?: AuthenticatedUser
  ): Promise<Assignment> {
    return this.repository.create({
      title: input.title.trim(),
      instructions: input.instructions.trim(),
      submissionPolicy: input.submissionPolicy ?? SubmissionPolicy.ONE_TIME,
      isPublished: input.isPublished ?? false,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      ...(user?.id ? { createdBy: { connect: { id: user.id } } } : {}),
    });
  }

  async listAssignments(
    query: AssignmentQuerySchemaInput,
    user?: AuthenticatedUser
  ): Promise<PaginatedAssignments> {
    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    const where: Prisma.AssignmentWhereInput = {};

    if (!isMentorOrAdmin) {
      where.isPublished = true;
    } else {
      if (query.status === 'PUBLISHED' || query.isPublished === true) {
        where.isPublished = true;
      } else if (query.status === 'DRAFT' || query.isPublished === false) {
        where.isPublished = false;
      }
    }

    return this.repository.findMany(where, query.page, query.limit);
  }

  async getAssignmentDetail(
    id: string,
    user?: AuthenticatedUser
  ): Promise<AssignmentDetail> {
    const assignment = await this.repository.findDetail(id);
    if (!assignment) {
      throw AppError.notFound('Assignment not found', 'ASSIGNMENT_NOT_FOUND');
    }

    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    if (!assignment.isPublished && !isMentorOrAdmin) {
      throw AppError.notFound('Assignment not found', 'ASSIGNMENT_NOT_FOUND');
    }

    return assignment;
  }

  async updateAssignment(
    id: string,
    input: UpdateAssignmentInput,
    user?: AuthenticatedUser
  ): Promise<Assignment> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw AppError.notFound('Assignment not found', 'ASSIGNMENT_NOT_FOUND');
    }

    if (
      existing.createdById &&
      user &&
      user.role === Role.MENTOR &&
      existing.createdById !== user.id
    ) {
      throw AppError.forbidden(
        'You do not have permission to modify this assignment',
        'FORBIDDEN'
      );
    }

    // Safeguard: Do not allow transitioning from RESUBMITTABLE to ONE_TIME if any student already has multiple attempts
    if (
      input.submissionPolicy === SubmissionPolicy.ONE_TIME &&
      existing.submissionPolicy === SubmissionPolicy.RESUBMITTABLE
    ) {
      const hasMultiple = await this.repository.hasMultipleAttempts(id);
      if (hasMultiple) {
        throw AppError.conflict(
          'Cannot change submission policy to ONE_TIME: students have already submitted multiple attempts for this assignment',
          'MULTIPLE_ATTEMPTS_EXIST'
        );
      }
    }

    const data: Prisma.AssignmentUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title.trim();
    }
    if (input.instructions !== undefined) {
      data.instructions = input.instructions.trim();
    }
    if (input.submissionPolicy !== undefined) {
      data.submissionPolicy = input.submissionPolicy;
    }
    if (input.isPublished !== undefined) {
      data.isPublished = input.isPublished;
    }
    if (input.dueAt !== undefined) {
      data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    }

    return this.repository.update(id, data);
  }

  async deleteAssignment(id: string, user?: AuthenticatedUser): Promise<Assignment> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw AppError.notFound('Assignment not found', 'ASSIGNMENT_NOT_FOUND');
    }

    if (
      existing.createdById &&
      user &&
      user.role === Role.MENTOR &&
      existing.createdById !== user.id
    ) {
      throw AppError.forbidden(
        'You do not have permission to delete this assignment',
        'FORBIDDEN'
      );
    }

    const submissionCount = await this.repository.countSubmissions(id);
    if (submissionCount > 0) {
      throw AppError.conflict(
        'Cannot delete assignment with existing student submissions',
        'ASSIGNMENT_HAS_SUBMISSIONS'
      );
    }

    return this.repository.delete(id);
  }
}

export const assignmentService = new AssignmentService();
