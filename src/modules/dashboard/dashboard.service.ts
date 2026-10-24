import { DashboardRepository, dashboardRepository } from './dashboard.repository';
import {
  StudentDashboardSummary,
  MentorDashboardSummary,
  AdminDashboardSummary,
  PaginatedStudentSubmissions,
  PaginatedMentorSubmissions,
  PaginatedMentorCourses,
  PaginatedAdminUsers,
  PaginatedAdminSubmissions,
} from './dashboard.types';
import {
  DashboardSummaryQueryInput,
  StudentSubmissionsQueryInput,
  MentorSubmissionsQueryInput,
  MentorCoursesQueryInput,
  AdminUsersQueryInput,
  AdminSubmissionsQueryInput,
} from './dashboard.schema';

export class DashboardService {
  private repository: DashboardRepository;

  constructor(repository: DashboardRepository = dashboardRepository) {
    this.repository = repository;
  }

  // ==========================================
  // Student Dashboard Services
  // ==========================================

  async getStudentDashboard(
    studentId: string,
    query?: DashboardSummaryQueryInput
  ): Promise<StudentDashboardSummary> {
    return this.repository.getStudentSummary(studentId, query);
  }

  async getStudentSubmissions(
    studentId: string,
    query: StudentSubmissionsQueryInput
  ): Promise<PaginatedStudentSubmissions> {
    return this.repository.findStudentSubmissions(studentId, {
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  // ==========================================
  // Mentor Dashboard Services
  // ==========================================

  async getMentorDashboard(
    mentorId: string,
    query?: DashboardSummaryQueryInput
  ): Promise<MentorDashboardSummary> {
    return this.repository.getMentorSummary(mentorId, query);
  }

  async getMentorSubmissions(
    mentorId: string,
    query: MentorSubmissionsQueryInput
  ): Promise<PaginatedMentorSubmissions> {
    return this.repository.findMentorSubmissions(mentorId, {
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  async getMentorCourses(
    mentorId: string,
    query: MentorCoursesQueryInput
  ): Promise<PaginatedMentorCourses> {
    return this.repository.findMentorCourses(mentorId, {
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  // ==========================================
  // Admin Dashboard Services
  // ==========================================

  async getAdminDashboard(
    query?: DashboardSummaryQueryInput
  ): Promise<AdminDashboardSummary> {
    return this.repository.getAdminSummary(query);
  }

  async getAdminUsers(
    query: AdminUsersQueryInput
  ): Promise<PaginatedAdminUsers> {
    return this.repository.findAdminUsers({
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  async getAdminSubmissions(
    query: AdminSubmissionsQueryInput
  ): Promise<PaginatedAdminSubmissions> {
    return this.repository.findAdminSubmissions({
      ...query,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}

export const dashboardService = new DashboardService();
