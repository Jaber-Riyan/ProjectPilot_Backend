import { Assignment, SubmissionPolicy } from '../../models';
import { PaginatedResult } from '../../repositories/repository.types';

export interface CreateAssignmentInput {
  title: string;
  instructions: string;
  submissionPolicy?: SubmissionPolicy;
  isPublished?: boolean;
  dueAt?: Date | string | null;
}

export interface UpdateAssignmentInput {
  title?: string;
  instructions?: string;
  submissionPolicy?: SubmissionPolicy;
  isPublished?: boolean;
  dueAt?: Date | string | null;
}

export interface AssignmentWithCount extends Assignment {
  _count: {
    submissions: number;
    contentItems: number;
  };
  createdBy?: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface AssignmentDetail extends Assignment {
  createdBy?: {
    id: string;
    email: string;
    name: string;
  } | null;
  contentItems?: Array<{
    id: string;
    title: string;
    moduleId: string;
    order: number;
  }>;
  _count: {
    submissions: number;
    contentItems: number;
  };
}

export type PaginatedAssignments = PaginatedResult<AssignmentWithCount>;
