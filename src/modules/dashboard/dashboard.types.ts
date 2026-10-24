import { Role, SubmissionStatus } from '../../models';
import { PaginatedResult } from '../../utils/pagination';

/**
 * Status counts mapping for all valid SubmissionStatus enums.
 */
export interface SubmissionStatusCounts {
  PENDING: number;
  UNDER_REVIEW: number;
  APPROVED: number;
  REJECTED: number;
  RESUBMISSION_REQUESTED: number;
}

/**
 * Student Dashboard Summary data contract.
 */
export interface StudentDashboardSummary {
  overview: {
    accessibleCoursesCount: number;
    accessibleAssignmentsCount: number;
    totalSubmissionsCount: number;
    completedAssignmentsCount: number;
    pendingReviewsCount: number;
    completionRate: number; // Percentage: (completedAssignments / accessibleAssignments) * 100
  };
  submissionsByStatus: SubmissionStatusCounts;
  recentSubmissions: Array<{
    id: string;
    projectName: string;
    attemptNumber: number;
    status: SubmissionStatus;
    repoUrl: string;
    liveUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    reviewedAt: Date | null;
    assignment: {
      id: string;
      title: string;
    };
    reviewedBy: {
      id: string;
      name: string;
    } | null;
    feedbacksCount: number;
    latestFeedback: {
      id: string;
      comment: string;
      createdAt: Date;
      mentor: {
        id: string;
        name: string;
      };
    } | null;
  }>;
  notes: {
    enrollmentModel: string;
    completionCriteria: string;
  };
}

/**
 * Mentor Dashboard Summary data contract.
 */
export interface MentorDashboardSummary {
  overview: {
    manageableCoursesCount: number;
    manageableModulesCount: number;
    manageableAssignmentsCount: number;
    pendingReviewsCount: number;
    totalSubmissionsReceived: number;
    reviewedSubmissionsCount: number;
    totalFeedbacksGiven: number;
  };
  submissionsByStatus: SubmissionStatusCounts;
  recentSubmissions: Array<{
    id: string;
    projectName: string;
    attemptNumber: number;
    status: SubmissionStatus;
    repoUrl: string;
    liveUrl: string | null;
    createdAt: Date;
    student: {
      id: string;
      name: string;
      email: string;
    };
    assignment: {
      id: string;
      title: string;
    };
  }>;
  recentReviews: Array<{
    id: string;
    comment: string;
    createdAt: Date;
    submission: {
      id: string;
      projectName: string;
      status: SubmissionStatus;
      attemptNumber: number;
      student: {
        id: string;
        name: string;
        email: string;
      };
      assignment: {
        id: string;
        title: string;
      };
    };
  }>;
}

/**
 * Admin Dashboard Summary data contract.
 */
export interface AdminDashboardSummary {
  users: {
    total: number;
    byRole: {
      STUDENT: number;
      MENTOR: number;
      ADMIN: number;
    };
    byStatus: {
      active: number;
      inactive: number;
    };
  };
  courses: {
    total: number;
    published: number;
    draft: number;
  };
  modules: {
    total: number;
    published: number;
    draft: number;
  };
  assignments: {
    total: number;
    published: number;
    draft: number;
  };
  submissions: {
    total: number;
    byStatus: SubmissionStatusCounts;
    pendingReviewTotal: number;
  };
  recentActivity: {
    recentUsers: Array<{
      id: string;
      name: string;
      email: string;
      role: Role;
      isActive: boolean;
      createdAt: Date;
    }>;
    recentSubmissions: Array<{
      id: string;
      projectName: string;
      status: SubmissionStatus;
      attemptNumber: number;
      createdAt: Date;
      student: {
        id: string;
        name: string;
        email: string;
      };
      assignment: {
        id: string;
        title: string;
      };
    }>;
  };
}

/**
 * Query filters interfaces.
 */
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export type SortOrder = 'asc' | 'desc';

export interface StudentSubmissionsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: SubmissionStatus;
  assignmentId?: string;
  from?: Date;
  to?: Date;
  sortBy?: 'createdAt' | 'updatedAt' | 'attemptNumber' | 'projectName' | 'status';
  sortOrder?: SortOrder;
}

export interface MentorSubmissionsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: SubmissionStatus;
  assignmentId?: string;
  courseId?: string;
  studentId?: string;
  from?: Date;
  to?: Date;
  sortBy?: 'createdAt' | 'updatedAt' | 'attemptNumber' | 'projectName' | 'status';
  sortOrder?: SortOrder;
}

export interface MentorCoursesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'published' | 'draft';
  from?: Date;
  to?: Date;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: SortOrder;
}

export interface AdminUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  status?: 'active' | 'inactive';
  from?: Date;
  to?: Date;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'email' | 'role';
  sortOrder?: SortOrder;
}

export interface AdminSubmissionsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: SubmissionStatus;
  assignmentId?: string;
  courseId?: string;
  studentId?: string;
  from?: Date;
  to?: Date;
  sortBy?: 'createdAt' | 'updatedAt' | 'attemptNumber' | 'projectName' | 'status';
  sortOrder?: SortOrder;
}

/**
 * Item types for list queries.
 */
export interface StudentSubmissionListItem {
  id: string;
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
  projectName: string;
  repoUrl: string;
  liveUrl: string | null;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  assignment: {
    id: string;
    title: string;
  };
  reviewedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  feedbacksCount: number;
}

export interface MentorSubmissionListItem {
  id: string;
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
  projectName: string;
  repoUrl: string;
  liveUrl: string | null;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  student: {
    id: string;
    name: string;
    email: string;
  };
  assignment: {
    id: string;
    title: string;
  };
  feedbacksCount: number;
}

export interface MentorCourseListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  modulesCount: number;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSubmissionListItem {
  id: string;
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
  projectName: string;
  repoUrl: string;
  liveUrl: string | null;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  student: {
    id: string;
    name: string;
    email: string;
  };
  assignment: {
    id: string;
    title: string;
  };
  reviewedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  feedbacksCount: number;
}

export type PaginatedStudentSubmissions = PaginatedResult<StudentSubmissionListItem>;
export type PaginatedMentorSubmissions = PaginatedResult<MentorSubmissionListItem>;
export type PaginatedMentorCourses = PaginatedResult<MentorCourseListItem>;
export type PaginatedAdminUsers = PaginatedResult<AdminUserListItem>;
export type PaginatedAdminSubmissions = PaginatedResult<AdminSubmissionListItem>;
