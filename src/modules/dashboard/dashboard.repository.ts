import { PrismaClient, Prisma, SubmissionStatus } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';
import { calculatePagination, buildPaginatedResult } from '../../utils/pagination';
import {
  StudentDashboardSummary,
  MentorDashboardSummary,
  AdminDashboardSummary,
  SubmissionStatusCounts,
  StudentSubmissionsQuery,
  MentorSubmissionsQuery,
  MentorCoursesQuery,
  AdminUsersQuery,
  AdminSubmissionsQuery,
  PaginatedStudentSubmissions,
  PaginatedMentorSubmissions,
  PaginatedMentorCourses,
  PaginatedAdminUsers,
  PaginatedAdminSubmissions,
} from './dashboard.types';

export class DashboardRepository {
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

  private emptyStatusCounts(): SubmissionStatusCounts {
    return {
      PENDING: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      RESUBMISSION_REQUESTED: 0,
    };
  }

  // ==========================================
  // Student Dashboard Methods
  // ==========================================

  async getStudentSummary(
    studentId: string,
    dateRange?: { from?: string; to?: string }
  ): Promise<StudentDashboardSummary> {
    const subWhere: Prisma.SubmissionWhereInput = { studentId };
    if (dateRange?.from || dateRange?.to) {
      subWhere.createdAt = {
        ...(dateRange.from && { gte: new Date(dateRange.from) }),
        ...(dateRange.to && { lte: new Date(dateRange.to) }),
      };
    }

    const accessibleCoursesCount = await this.client.course.count({
      where: { isPublished: true },
    });
    const accessibleAssignmentsCount = await this.client.assignment.count({
      where: { isPublished: true },
    });
    const statusGroups = await this.client.submission.groupBy({
      by: ['status'],
      where: subWhere,
      _count: { id: true },
    });
    const approvedAssignmentGroups = await this.client.submission.groupBy({
      by: ['assignmentId'],
      where: { ...subWhere, status: SubmissionStatus.APPROVED },
    });
    const recentSubmissions = await this.client.submission.findMany({
      where: subWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 5,
      include: {
        assignment: {
          select: { id: true, title: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
        feedbacks: {
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 1,
          include: {
            mentor: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { feedbacks: true },
        },
      },
    });

    const submissionsByStatus = this.emptyStatusCounts();
    let totalSubmissionsCount = 0;
    for (const group of statusGroups) {
      submissionsByStatus[group.status] = group._count.id;
      totalSubmissionsCount += group._count.id;
    }

    const completedAssignmentsCount = approvedAssignmentGroups.length;
    const pendingReviewsCount =
      submissionsByStatus.PENDING + submissionsByStatus.UNDER_REVIEW;
    const completionRate =
      accessibleAssignmentsCount > 0
        ? Number(
            (
              (completedAssignmentsCount / accessibleAssignmentsCount) *
              100
            ).toFixed(1)
          )
        : 0;

    return {
      overview: {
        accessibleCoursesCount,
        accessibleAssignmentsCount,
        totalSubmissionsCount,
        completedAssignmentsCount,
        pendingReviewsCount,
        completionRate,
      },
      submissionsByStatus,
      recentSubmissions: recentSubmissions.map((sub) => {
        const latestFb = sub.feedbacks[0];
        return {
          id: sub.id,
          projectName: sub.projectName,
          attemptNumber: sub.attemptNumber,
          status: sub.status,
          repoUrl: sub.repoUrl,
          liveUrl: sub.liveUrl,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
          reviewedAt: sub.reviewedAt,
          assignment: sub.assignment,
          reviewedBy: sub.reviewedBy,
          feedbacksCount: sub._count.feedbacks,
          latestFeedback: latestFb
            ? {
                id: latestFb.id,
                comment: latestFb.comment,
                createdAt: latestFb.createdAt,
                mentor: latestFb.mentor,
              }
            : null,
        };
      }),
      notes: {
        enrollmentModel:
          'Open learning catalog: student has access to all published courses and assignments.',
        completionCriteria:
          'An assignment is counted as completed once a submission attempt receives APPROVED status.',
      },
    };
  }

  async findStudentSubmissions(
    studentId: string,
    query: StudentSubmissionsQuery
  ): Promise<PaginatedStudentSubmissions> {
    const where: Prisma.SubmissionWhereInput = { studentId };

    if (query.search) {
      where.projectName = { contains: query.search, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.assignmentId) {
      where.assignmentId = query.assignmentId;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: query.from }),
        ...(query.to && { lte: query.to }),
      };
    }

    const total = await this.client.submission.count({ where });
    const pagination = calculatePagination(
      { page: query.page, limit: query.limit },
      total
    );

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const items = await this.client.submission.findMany({
      where,
      orderBy: [{ [sortField]: sortOrder }, { id: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        assignment: { select: { id: true, title: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { feedbacks: true } },
      },
    });

    const mappedItems = items.map((sub) => ({
      id: sub.id,
      assignmentId: sub.assignmentId,
      studentId: sub.studentId,
      attemptNumber: sub.attemptNumber,
      projectName: sub.projectName,
      repoUrl: sub.repoUrl,
      liveUrl: sub.liveUrl,
      status: sub.status,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      reviewedAt: sub.reviewedAt,
      assignment: sub.assignment,
      reviewedBy: sub.reviewedBy,
      feedbacksCount: sub._count.feedbacks,
    }));

    return buildPaginatedResult(mappedItems, total, pagination);
  }

  // ==========================================
  // Mentor Dashboard Methods
  // ==========================================

  async getMentorSummary(
    mentorId: string,
    dateRange?: { from?: string; to?: string }
  ): Promise<MentorDashboardSummary> {
    const subWhere: Prisma.SubmissionWhereInput = {
      assignment: { createdById: mentorId },
    };
    if (dateRange?.from || dateRange?.to) {
      subWhere.createdAt = {
        ...(dateRange.from && { gte: new Date(dateRange.from) }),
        ...(dateRange.to && { lte: new Date(dateRange.to) }),
      };
    }

    const manageableCoursesCount = await this.client.course.count({
      where: { createdById: mentorId },
    });
    const manageableModulesCount = await this.client.module.count({
      where: { createdById: mentorId },
    });
    const manageableAssignmentsCount = await this.client.assignment.count({
      where: { createdById: mentorId },
    });
    const statusGroups = await this.client.submission.groupBy({
      by: ['status'],
      where: subWhere,
      _count: { id: true },
    });
    const reviewedSubmissionsCount = await this.client.submission.count({
      where: { reviewedById: mentorId },
    });
    const totalFeedbacksGiven = await this.client.feedback.count({
      where: { mentorId },
    });
    const recentSubmissions = await this.client.submission.findMany({
      where: subWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 5,
      include: {
        student: { select: { id: true, name: true, email: true } },
        assignment: { select: { id: true, title: true } },
      },
    });
    const recentReviews = await this.client.feedback.findMany({
      where: { mentorId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 5,
      include: {
        submission: {
          select: {
            id: true,
            projectName: true,
            status: true,
            attemptNumber: true,
            student: { select: { id: true, name: true, email: true } },
            assignment: { select: { id: true, title: true } },
          },
        },
      },
    });

    const submissionsByStatus = this.emptyStatusCounts();
    let totalSubmissionsReceived = 0;
    for (const group of statusGroups) {
      submissionsByStatus[group.status] = group._count.id;
      totalSubmissionsReceived += group._count.id;
    }

    const pendingReviewsCount =
      submissionsByStatus.PENDING + submissionsByStatus.UNDER_REVIEW;

    return {
      overview: {
        manageableCoursesCount,
        manageableModulesCount,
        manageableAssignmentsCount,
        pendingReviewsCount,
        totalSubmissionsReceived,
        reviewedSubmissionsCount,
        totalFeedbacksGiven,
      },
      submissionsByStatus,
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id,
        projectName: s.projectName,
        attemptNumber: s.attemptNumber,
        status: s.status,
        repoUrl: s.repoUrl,
        liveUrl: s.liveUrl,
        createdAt: s.createdAt,
        student: s.student,
        assignment: s.assignment,
      })),
      recentReviews: recentReviews.map((fb) => ({
        id: fb.id,
        comment: fb.comment,
        createdAt: fb.createdAt,
        submission: fb.submission,
      })),
    };
  }

  async findMentorSubmissions(
    mentorId: string,
    query: MentorSubmissionsQuery
  ): Promise<PaginatedMentorSubmissions> {
    const assignmentWhere: Prisma.AssignmentWhereInput = {
      createdById: mentorId,
    };

    if (query.courseId) {
      assignmentWhere.contentItems = {
        some: {
          module: {
            courseModules: {
              some: {
                courseId: query.courseId,
              },
            },
          },
        },
      };
    }

    const where: Prisma.SubmissionWhereInput = {
      assignment: assignmentWhere,
    };

    if (query.search) {
      where.OR = [
        { projectName: { contains: query.search, mode: 'insensitive' } },
        { student: { name: { contains: query.search, mode: 'insensitive' } } },
        { student: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.assignmentId) {
      where.assignmentId = query.assignmentId;
    }
    if (query.studentId) {
      where.studentId = query.studentId;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: query.from }),
        ...(query.to && { lte: query.to }),
      };
    }

    const total = await this.client.submission.count({ where });
    const pagination = calculatePagination(
      { page: query.page, limit: query.limit },
      total
    );

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const items = await this.client.submission.findMany({
      where,
      orderBy: [{ [sortField]: sortOrder }, { id: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        student: { select: { id: true, name: true, email: true } },
        assignment: { select: { id: true, title: true } },
        _count: { select: { feedbacks: true } },
      },
    });

    const mappedItems = items.map((sub) => ({
      id: sub.id,
      assignmentId: sub.assignmentId,
      studentId: sub.studentId,
      attemptNumber: sub.attemptNumber,
      projectName: sub.projectName,
      repoUrl: sub.repoUrl,
      liveUrl: sub.liveUrl,
      status: sub.status,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      reviewedAt: sub.reviewedAt,
      student: sub.student,
      assignment: sub.assignment,
      feedbacksCount: sub._count.feedbacks,
    }));

    return buildPaginatedResult(mappedItems, total, pagination);
  }

  async findMentorCourses(
    mentorId: string,
    query: MentorCoursesQuery
  ): Promise<PaginatedMentorCourses> {
    const where: Prisma.CourseWhereInput = {
      createdById: mentorId,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) {
      where.isPublished = query.status === 'published';
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: query.from }),
        ...(query.to && { lte: query.to }),
      };
    }

    const total = await this.client.course.count({ where });
    const pagination = calculatePagination(
      { page: query.page, limit: query.limit },
      total
    );

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const items = await this.client.course.findMany({
      where,
      orderBy: [{ [sortField]: sortOrder }, { id: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        _count: {
          select: { courseModules: true },
        },
      },
    });

    const mappedItems = items.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      isPublished: c.isPublished,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      modulesCount: c._count.courseModules,
    }));

    return buildPaginatedResult(mappedItems, total, pagination);
  }

  // ==========================================
  // Admin Dashboard Methods
  // ==========================================

  async getAdminSummary(
    dateRange?: { from?: string; to?: string }
  ): Promise<AdminDashboardSummary> {
    const subWhere: Prisma.SubmissionWhereInput = {};
    if (dateRange?.from || dateRange?.to) {
      subWhere.createdAt = {
        ...(dateRange.from && { gte: new Date(dateRange.from) }),
        ...(dateRange.to && { lte: new Date(dateRange.to) }),
      };
    }

    const userGroups = await this.client.user.groupBy({
      by: ['role', 'isActive'],
      _count: { id: true },
    });
    const courseGroups = await this.client.course.groupBy({
      by: ['isPublished'],
      _count: { id: true },
    });
    const moduleGroups = await this.client.module.groupBy({
      by: ['isPublished'],
      _count: { id: true },
    });
    const assignmentGroups = await this.client.assignment.groupBy({
      by: ['isPublished'],
      _count: { id: true },
    });
    const submissionGroups = await this.client.submission.groupBy({
      by: ['status'],
      where: subWhere,
      _count: { id: true },
    });
    const recentUsers = await this.client.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 5,
    });
    const recentSubmissions = await this.client.submission.findMany({
      where: subWhere,
      select: {
        id: true,
        projectName: true,
        status: true,
        attemptNumber: true,
        createdAt: true,
        student: { select: { id: true, name: true, email: true } },
        assignment: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 5,
    });

    // Compute user breakdown
    let totalUsers = 0;
    const byRole = { STUDENT: 0, MENTOR: 0, ADMIN: 0 };
    const byStatus = { active: 0, inactive: 0 };

    for (const group of userGroups) {
      const count = group._count.id;
      totalUsers += count;
      byRole[group.role] += count;
      if (group.isActive) {
        byStatus.active += count;
      } else {
        byStatus.inactive += count;
      }
    }

    // Compute courses breakdown
    let totalCourses = 0;
    let publishedCourses = 0;
    for (const group of courseGroups) {
      totalCourses += group._count.id;
      if (group.isPublished) publishedCourses += group._count.id;
    }

    // Compute modules breakdown
    let totalModules = 0;
    let publishedModules = 0;
    for (const group of moduleGroups) {
      totalModules += group._count.id;
      if (group.isPublished) publishedModules += group._count.id;
    }

    // Compute assignments breakdown
    let totalAssignments = 0;
    let publishedAssignments = 0;
    for (const group of assignmentGroups) {
      totalAssignments += group._count.id;
      if (group.isPublished) publishedAssignments += group._count.id;
    }

    // Compute submissions breakdown
    const submissionsByStatus = this.emptyStatusCounts();
    let totalSubmissions = 0;
    for (const group of submissionGroups) {
      submissionsByStatus[group.status] = group._count.id;
      totalSubmissions += group._count.id;
    }
    const pendingReviewTotal =
      submissionsByStatus.PENDING + submissionsByStatus.UNDER_REVIEW;

    return {
      users: {
        total: totalUsers,
        byRole,
        byStatus,
      },
      courses: {
        total: totalCourses,
        published: publishedCourses,
        draft: totalCourses - publishedCourses,
      },
      modules: {
        total: totalModules,
        published: publishedModules,
        draft: totalModules - publishedModules,
      },
      assignments: {
        total: totalAssignments,
        published: publishedAssignments,
        draft: totalAssignments - publishedAssignments,
      },
      submissions: {
        total: totalSubmissions,
        byStatus: submissionsByStatus,
        pendingReviewTotal,
      },
      recentActivity: {
        recentUsers,
        recentSubmissions,
      },
    };
  }

  async findAdminUsers(query: AdminUsersQuery): Promise<PaginatedAdminUsers> {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) {
      where.role = query.role;
    }
    if (query.status) {
      where.isActive = query.status === 'active';
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: query.from }),
        ...(query.to && { lte: query.to }),
      };
    }

    const total = await this.client.user.count({ where });
    const pagination = calculatePagination(
      { page: query.page, limit: query.limit },
      total
    );

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const items = await this.client.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ [sortField]: sortOrder }, { id: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
    });

    return buildPaginatedResult(items, total, pagination);
  }

  async findAdminSubmissions(
    query: AdminSubmissionsQuery
  ): Promise<PaginatedAdminSubmissions> {
    const where: Prisma.SubmissionWhereInput = {};

    if (query.search) {
      where.OR = [
        { projectName: { contains: query.search, mode: 'insensitive' } },
        { student: { name: { contains: query.search, mode: 'insensitive' } } },
        { student: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.assignmentId) {
      where.assignmentId = query.assignmentId;
    }
    if (query.studentId) {
      where.studentId = query.studentId;
    }
    if (query.courseId) {
      where.assignment = {
        contentItems: {
          some: {
            module: {
              courseModules: {
                some: {
                  courseId: query.courseId,
                },
              },
            },
          },
        },
      };
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from && { gte: query.from }),
        ...(query.to && { lte: query.to }),
      };
    }

    const total = await this.client.submission.count({ where });
    const pagination = calculatePagination(
      { page: query.page, limit: query.limit },
      total
    );

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const items = await this.client.submission.findMany({
      where,
      orderBy: [{ [sortField]: sortOrder }, { id: 'asc' }],
      skip: pagination.skip,
      take: pagination.limit,
      include: {
        student: { select: { id: true, name: true, email: true } },
        assignment: { select: { id: true, title: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { feedbacks: true } },
      },
    });

    const mappedItems = items.map((sub) => ({
      id: sub.id,
      assignmentId: sub.assignmentId,
      studentId: sub.studentId,
      attemptNumber: sub.attemptNumber,
      projectName: sub.projectName,
      repoUrl: sub.repoUrl,
      liveUrl: sub.liveUrl,
      status: sub.status,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      reviewedAt: sub.reviewedAt,
      student: sub.student,
      assignment: sub.assignment,
      reviewedBy: sub.reviewedBy,
      feedbacksCount: sub._count.feedbacks,
    }));

    return buildPaginatedResult(mappedItems, total, pagination);
  }
}

export const dashboardRepository = new DashboardRepository();
