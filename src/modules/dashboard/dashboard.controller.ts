import { Request, Response } from 'express';
import { dashboardService, DashboardService } from './dashboard.service';
import { ApiResponseSuccess, AppError } from '../../errors/app-error';
import {
  DashboardSummaryQueryInput,
  StudentSubmissionsQueryInput,
  MentorSubmissionsQueryInput,
  MentorCoursesQueryInput,
  AdminUsersQueryInput,
  AdminSubmissionsQueryInput,
} from './dashboard.schema';
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

export class DashboardController {
  private service: DashboardService;

  constructor(service: DashboardService = dashboardService) {
    this.service = service;
  }

  // ==========================================
  // Student Dashboard Handlers
  // ==========================================

  getStudentDashboard = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const query = req.query as unknown as DashboardSummaryQueryInput;
    const result = await this.service.getStudentDashboard(req.user.id, query);
    const response: ApiResponseSuccess<StudentDashboardSummary> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getStudentSubmissions = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const query = req.query as unknown as StudentSubmissionsQueryInput;
    const result = await this.service.getStudentSubmissions(req.user.id, query);
    const response: ApiResponseSuccess<PaginatedStudentSubmissions> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  // ==========================================
  // Mentor Dashboard Handlers
  // ==========================================

  getMentorDashboard = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const query = req.query as unknown as DashboardSummaryQueryInput;
    const result = await this.service.getMentorDashboard(req.user.id, query);
    const response: ApiResponseSuccess<MentorDashboardSummary> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getMentorSubmissions = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const query = req.query as unknown as MentorSubmissionsQueryInput;
    const result = await this.service.getMentorSubmissions(req.user.id, query);
    const response: ApiResponseSuccess<PaginatedMentorSubmissions> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getMentorCourses = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const query = req.query as unknown as MentorCoursesQueryInput;
    const result = await this.service.getMentorCourses(req.user.id, query);
    const response: ApiResponseSuccess<PaginatedMentorCourses> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  // ==========================================
  // Admin Dashboard Handlers
  // ==========================================

  getAdminDashboard = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const query = req.query as unknown as DashboardSummaryQueryInput;
    const result = await this.service.getAdminDashboard(query);
    const response: ApiResponseSuccess<AdminDashboardSummary> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getAdminUsers = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const query = req.query as unknown as AdminUsersQueryInput;
    const result = await this.service.getAdminUsers(query);
    const response: ApiResponseSuccess<PaginatedAdminUsers> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getAdminSubmissions = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const query = req.query as unknown as AdminSubmissionsQueryInput;
    const result = await this.service.getAdminSubmissions(query);
    const response: ApiResponseSuccess<PaginatedAdminSubmissions> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };
}

export const dashboardController = new DashboardController();
