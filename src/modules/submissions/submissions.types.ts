import { Submission, SubmissionStatus, SubmissionPolicy, Feedback } from '../../models';
import { PaginatedResult } from '../../repositories/repository.types';

export interface CreateSubmissionInput {
  projectName: string;
  repoUrl: string;
  liveUrl?: string | null;
  description?: string | null;
}

export interface SubmissionQueryFilters {
  page?: number;
  limit?: number;
  status?: SubmissionStatus;
  studentId?: string;
}

export interface SubmissionWithStudent extends Submission {
  student: {
    id: string;
    email: string;
    name: string;
  };
  assignment: {
    id: string;
    title: string;
    submissionPolicy: SubmissionPolicy;
  };
  feedbacks?: Feedback[];
  _count?: {
    feedbacks: number;
  };
}

export interface SubmissionDetail extends Submission {
  student: {
    id: string;
    email: string;
    name: string;
  };
  assignment: {
    id: string;
    title: string;
    instructions: string;
    submissionPolicy: SubmissionPolicy;
  };
  feedbacks: Array<
    Feedback & {
      mentor: {
        id: string;
        name: string;
      };
    }
  >;
}

export type PaginatedSubmissions = PaginatedResult<SubmissionWithStudent>;
