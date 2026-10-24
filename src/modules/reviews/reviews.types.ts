import { Submission, SubmissionStatus, SubmissionPolicy, Feedback } from '../../models';
import { PaginatedResult } from '../../repositories/repository.types';

export interface CreateReviewInput {
  status: SubmissionStatus;
  comment?: string | null;
}

export interface UpdateReviewInput {
  status?: SubmissionStatus;
  comment?: string | null;
}

export interface ReviewQueueQueryFilters {
  page?: number;
  limit?: number;
  status?: SubmissionStatus;
  assignmentId?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReviewQueueItem extends Submission {
  student: {
    id: string;
    name: string;
    email: string;
  };
  assignment: {
    id: string;
    title: string;
    submissionPolicy: SubmissionPolicy;
    createdById?: string | null;
  };
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  _count: {
    feedbacks: number;
  };
}

export interface ReviewSubmissionDetail extends Submission {
  student: {
    id: string;
    name: string;
    email: string;
  };
  assignment: {
    id: string;
    title: string;
    instructions: string;
    submissionPolicy: SubmissionPolicy;
    createdById?: string | null;
  };
  reviewedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  feedbacks: Array<
    Feedback & {
      mentor: {
        id: string;
        name: string;
        email: string;
      };
    }
  >;
}

export type PaginatedReviewQueue = PaginatedResult<ReviewQueueItem>;
