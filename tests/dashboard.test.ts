import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { Role, SubmissionPolicy, SubmissionStatus, ContentType } from '../src/models';
import { signAccessToken } from '../src/lib/jwt';
import { hashPassword } from '../src/lib/password';
import { getPrismaClient, disconnectDatabase } from '../src/db/prisma';

describe('Phase 9 — Dashboard APIs: Aggregates, Pagination, and Scoped Role Access', { timeout: 45000 }, () => {
  const prisma = getPrismaClient();
  const getTestIp = () =>
    `10.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}`;

  let student1Token: string;
  let student2Token: string;
  let mentor1Token: string;
  let mentor2Token: string;
  let adminToken: string;

  let student1Id: string;
  let student1Email: string;
  let student2Id: string;
  let mentor1Id: string;
  let mentor2Id: string;
  let adminId: string;

  let course1Id: string;
  let course2DraftId: string;
  let course3M2Id: string;
  let module1Id: string;
  let assignment1M1Id: string;
  let assignment2M1DraftId: string;
  let assignment3M2Id: string;
  let submission1Id: string;
  let submission2Id: string;
  let submission3Id: string;
  let submission4Id: string;

  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdModuleIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await hashPassword('DashboardSecret123!');

    // 1. Batch Create Users (1 roundtrip with createManyAndReturn)
    const users = await prisma.user.createManyAndReturn({
      data: [
        {
          name: 'Dashboard Student 1',
          email: `student1_d9_${randomUUID().slice(0, 8)}@example.com`,
          passwordHash,
          role: Role.STUDENT,
          isActive: true,
        },
        {
          name: 'Dashboard Student 2',
          email: `student2_d9_${randomUUID().slice(0, 8)}@example.com`,
          passwordHash,
          role: Role.STUDENT,
          isActive: true,
        },
        {
          name: 'Dashboard Mentor 1',
          email: `mentor1_d9_${randomUUID().slice(0, 8)}@example.com`,
          passwordHash,
          role: Role.MENTOR,
          isActive: true,
        },
        {
          name: 'Dashboard Mentor 2',
          email: `mentor2_d9_${randomUUID().slice(0, 8)}@example.com`,
          passwordHash,
          role: Role.MENTOR,
          isActive: true,
        },
        {
          name: 'Dashboard Admin',
          email: `admin_d9_${randomUUID().slice(0, 8)}@example.com`,
          passwordHash,
          role: Role.ADMIN,
          isActive: true,
        },
      ],
    });

    const s1 = users[0];
    const s2 = users[1];
    const m1 = users[2];
    const m2 = users[3];
    const adm = users[4];

    student1Id = s1.id;
    student1Email = s1.email;
    student2Id = s2.id;
    mentor1Id = m1.id;
    mentor2Id = m2.id;
    adminId = adm.id;
    createdUserIds.push(student1Id, student2Id, mentor1Id, mentor2Id, adminId);

    student1Token = signAccessToken({
      sub: student1Id,
      email: s1.email,
      role: Role.STUDENT,
      name: s1.name,
    });
    student2Token = signAccessToken({
      sub: student2Id,
      email: s2.email,
      role: Role.STUDENT,
      name: s2.name,
    });
    mentor1Token = signAccessToken({
      sub: mentor1Id,
      email: m1.email,
      role: Role.MENTOR,
      name: m1.name,
    });
    mentor2Token = signAccessToken({
      sub: mentor2Id,
      email: m2.email,
      role: Role.MENTOR,
      name: m2.name,
    });
    adminToken = signAccessToken({
      sub: adminId,
      email: adm.email,
      role: Role.ADMIN,
      name: adm.name,
    });

    // 2. Batch Create Courses (1 roundtrip)
    const courses = await prisma.course.createManyAndReturn({
      data: [
        {
          title: 'Fullstack TypeScript Mastery',
          slug: `fullstack-ts-d9-${randomUUID().slice(0, 6)}`,
          description: 'Complete TS Course',
          isPublished: true,
          createdById: mentor1Id,
        },
        {
          title: 'Draft React Course',
          slug: `draft-react-d9-${randomUUID().slice(0, 6)}`,
          description: 'Work in progress',
          isPublished: false,
          createdById: mentor1Id,
        },
        {
          title: 'Mentor 2 Python Course',
          slug: `python-m2-d9-${randomUUID().slice(0, 6)}`,
          isPublished: true,
          createdById: mentor2Id,
        },
      ],
    });

    course1Id = courses[0].id;
    course2DraftId = courses[1].id;
    course3M2Id = courses[2].id;
    createdCourseIds.push(course1Id, course2DraftId, course3M2Id);

    // 3. Module & CourseModule
    const mod1 = await prisma.module.create({
      data: {
        title: 'Module 1: Backend Architecture',
        isPublished: true,
        createdById: mentor1Id,
      },
    });
    module1Id = mod1.id;
    createdModuleIds.push(module1Id);

    await prisma.courseModule.create({
      data: {
        courseId: course1Id,
        moduleId: module1Id,
        order: 1,
      },
    });

    // 4. Batch Create Assignments (1 roundtrip)
    const assignments = await prisma.assignment.createManyAndReturn({
      data: [
        {
          title: 'Capstone Backend API (M1)',
          instructions: 'Build REST endpoints',
          submissionPolicy: SubmissionPolicy.RESUBMITTABLE,
          isPublished: true,
          createdById: mentor1Id,
        },
        {
          title: 'Draft Assignment (M1)',
          instructions: 'Not published yet',
          submissionPolicy: SubmissionPolicy.ONE_TIME,
          isPublished: false,
          createdById: mentor1Id,
        },
        {
          title: 'Algorithms Assignment (M2)',
          instructions: 'Data structures and algorithms',
          submissionPolicy: SubmissionPolicy.ONE_TIME,
          isPublished: true,
          createdById: mentor2Id,
        },
      ],
    });

    assignment1M1Id = assignments[0].id;
    assignment2M1DraftId = assignments[1].id;
    assignment3M2Id = assignments[2].id;
    createdAssignmentIds.push(assignment1M1Id, assignment2M1DraftId, assignment3M2Id);

    // 5. Connect ContentItem
    await prisma.contentItem.create({
      data: {
        moduleId: module1Id,
        type: ContentType.ASSIGNMENT,
        title: 'Capstone Content Item',
        order: 1,
        assignmentId: assignment1M1Id,
      },
    });

    // 6. Batch Create Submissions (1 roundtrip)
    const submissions = await prisma.submission.createManyAndReturn({
      data: [
        {
          assignmentId: assignment1M1Id,
          studentId: student1Id,
          attemptNumber: 1,
          projectName: 'Alpha Express App',
          repoUrl: 'https://github.com/s1/alpha',
          status: SubmissionStatus.APPROVED,
          reviewedById: mentor1Id,
          reviewedAt: new Date(),
        },
        {
          assignmentId: assignment3M2Id,
          studentId: student1Id,
          attemptNumber: 1,
          projectName: 'Beta Algo Solver',
          repoUrl: 'https://github.com/s1/beta',
          status: SubmissionStatus.PENDING,
        },
        {
          assignmentId: assignment1M1Id,
          studentId: student2Id,
          attemptNumber: 1,
          projectName: 'Gamma Express Service',
          repoUrl: 'https://github.com/s2/gamma',
          status: SubmissionStatus.UNDER_REVIEW,
          reviewedById: mentor1Id,
        },
        {
          assignmentId: assignment3M2Id,
          studentId: student2Id,
          attemptNumber: 1,
          projectName: 'Delta Algo Tree',
          repoUrl: 'https://github.com/s2/delta',
          status: SubmissionStatus.REJECTED,
          reviewedById: mentor2Id,
          reviewedAt: new Date(),
        },
      ],
    });

    submission1Id = submissions[0].id;
    submission2Id = submissions[1].id;
    submission3Id = submissions[2].id;
    submission4Id = submissions[3].id;

    // 7. Batch Create Feedbacks (1 roundtrip)
    await prisma.feedback.createMany({
      data: [
        {
          submissionId: submission1Id,
          mentorId: mentor1Id,
          comment: 'Great job! Meets all criteria.',
        },
        {
          submissionId: submission4Id,
          mentorId: mentor2Id,
          comment: 'Missing test suite for binary search tree.',
        },
      ],
    });
  }, 45000);

  afterAll(async () => {
    try {
      if (createdAssignmentIds.length > 0) {
        await prisma.feedback.deleteMany({
          where: { submission: { assignmentId: { in: createdAssignmentIds } } },
        });
        await prisma.submission.deleteMany({
          where: { assignmentId: { in: createdAssignmentIds } },
        });
        await prisma.contentItem.deleteMany({
          where: { assignmentId: { in: createdAssignmentIds } },
        });
        await prisma.assignment.deleteMany({
          where: { id: { in: createdAssignmentIds } },
        });
      }
      if (createdModuleIds.length > 0) {
        await prisma.courseModule.deleteMany({
          where: { moduleId: { in: createdModuleIds } },
        });
        await prisma.contentItem.deleteMany({
          where: { moduleId: { in: createdModuleIds } },
        });
        await prisma.module.deleteMany({
          where: { id: { in: createdModuleIds } },
        });
      }
      if (createdCourseIds.length > 0) {
        await prisma.course.deleteMany({
          where: { id: { in: createdCourseIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
      await disconnectDatabase();
    } catch {
      // ignore cleanup errors
    }
  }, 35000);

  // ==========================================
  // 1. Role-based Dashboard Authorization
  // ==========================================
  describe('1. Role-based Dashboard Authorization & Scoping', () => {
    it('1. Student can access student dashboard, but receives 403 on mentor & admin dashboards', async () => {
      // Student dashboard -> 200
      const resStudent = await request(app)
        .get('/api/v1/dashboard/student')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resStudent.status).toBe(200);
      expect(resStudent.body.success).toBe(true);

      // Student -> Mentor dashboard -> 403
      const resMentor = await request(app)
        .get('/api/v1/dashboard/mentor')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resMentor.status).toBe(403);
      expect(resMentor.body.error.code).toBe('FORBIDDEN');

      // Student -> Admin dashboard -> 403
      const resAdmin = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resAdmin.status).toBe(403);
      expect(resAdmin.body.error.code).toBe('FORBIDDEN');
    });

    it('2. Mentor can access mentor dashboard, but receives 403 on student & admin dashboards', async () => {
      // Mentor dashboard -> 200
      const resMentor = await request(app)
        .get('/api/v1/dashboard/mentor')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resMentor.status).toBe(200);
      expect(resMentor.body.success).toBe(true);

      // Mentor -> Student dashboard -> 403
      const resStudent = await request(app)
        .get('/api/v1/dashboard/student')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resStudent.status).toBe(403);

      // Mentor -> Admin dashboard -> 403
      const resAdmin = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resAdmin.status).toBe(403);
    });

    it('3. Admin can access admin dashboard, but receives 403 on student & mentor dashboards', async () => {
      // Admin dashboard -> 200
      const resAdmin = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.success).toBe(true);

      // Admin -> Student dashboard -> 403
      const resStudent = await request(app)
        .get('/api/v1/dashboard/student')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resStudent.status).toBe(403);

      // Admin -> Mentor dashboard -> 403
      const resMentor = await request(app)
        .get('/api/v1/dashboard/mentor')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resMentor.status).toBe(403);
    });

    it('4. Unauthenticated requests are rejected with 401 across all dashboards', async () => {
      const endpoints = [
        '/api/v1/dashboard/student',
        '/api/v1/dashboard/mentor',
        '/api/v1/dashboard/admin',
        '/api/v1/dashboard/student/submissions',
        '/api/v1/dashboard/mentor/submissions',
        '/api/v1/dashboard/admin/users',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set('X-Forwarded-For', getTestIp());
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  // ==========================================
  // 2. Student Dashboard Metrics & List Isolation
  // ==========================================
  describe('2. Student Dashboard Metrics & List Isolation', () => {
    it('5. Student 1 dashboard summary calculates accurate aggregates from persisted data', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/student')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Accessible courses & assignments (published only)
      expect(data.overview.accessibleCoursesCount).toBeGreaterThanOrEqual(2);
      expect(data.overview.accessibleAssignmentsCount).toBeGreaterThanOrEqual(2);

      // Submissions counts
      expect(data.overview.totalSubmissionsCount).toBe(2);
      expect(data.overview.completedAssignmentsCount).toBe(1); // 1 approved
      expect(data.overview.pendingReviewsCount).toBe(1); // 1 pending

      // Status breakdown
      expect(data.submissionsByStatus.APPROVED).toBe(1);
      expect(data.submissionsByStatus.PENDING).toBe(1);
      expect(data.submissionsByStatus.UNDER_REVIEW).toBe(0);
      expect(data.submissionsByStatus.REJECTED).toBe(0);

      // Completion rate calculation
      expect(data.overview.completionRate).toBeGreaterThan(0);

      // Recent submissions (at least the 2 submitted by student 1)
      expect(data.recentSubmissions.length).toBe(2);
      const submissionIds = data.recentSubmissions.map((s: { id: string }) => s.id);
      expect(submissionIds).toContain(submission1Id);
      expect(submissionIds).toContain(submission2Id);
      expect(submissionIds).not.toContain(submission3Id); // S2 submission excluded

      // Latest feedback present on approved submission
      const approvedSub = data.recentSubmissions.find((s: { id: string }) => s.id === submission1Id);
      expect(approvedSub.latestFeedback).not.toBeNull();
      expect(approvedSub.latestFeedback.comment).toBe('Great job! Meets all criteria.');
      expect(approvedSub.latestFeedback.mentor.name).toBe('Dashboard Mentor 1');

      // Notes present
      expect(data.notes.enrollmentModel).toBeDefined();
      expect(data.notes.completionCriteria).toBeDefined();
    });

    it('6. Student 2 dashboard summary isolates Student 2 metrics cleanly', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/student')
        .set('Authorization', `Bearer ${student2Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.overview.totalSubmissionsCount).toBe(2);
      expect(data.overview.completedAssignmentsCount).toBe(0); // 0 approved
      expect(data.overview.pendingReviewsCount).toBe(1); // 1 UNDER_REVIEW
      expect(data.submissionsByStatus.UNDER_REVIEW).toBe(1);
      expect(data.submissionsByStatus.REJECTED).toBe(1);
      expect(data.submissionsByStatus.APPROVED).toBe(0);

      const submissionIds = data.recentSubmissions.map((s: { id: string }) => s.id);
      expect(submissionIds).toContain(submission3Id);
      expect(submissionIds).toContain(submission4Id);
      expect(submissionIds).not.toContain(submission1Id); // S1 submission excluded
    });

    it('7. Student can paginate, search, and filter their own submissions', async () => {
      // 1. Full list
      const resAll = await request(app)
        .get('/api/v1/dashboard/student/submissions?page=1&limit=10')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resAll.status).toBe(200);
      expect(resAll.body.data.total).toBe(2);
      expect(resAll.body.data.items.length).toBe(2);
      expect(resAll.body.data.page).toBe(1);
      expect(resAll.body.data.limit).toBe(10);
      expect(resAll.body.data.totalPages).toBe(1);

      // 2. Filter by status: APPROVED
      const resApproved = await request(app)
        .get('/api/v1/dashboard/student/submissions?status=APPROVED')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resApproved.status).toBe(200);
      expect(resApproved.body.data.total).toBe(1);
      expect(resApproved.body.data.items[0].id).toBe(submission1Id);

      // 3. Search by projectName case-insensitive
      const resSearch = await request(app)
        .get('/api/v1/dashboard/student/submissions?search=alpha')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resSearch.status).toBe(200);
      expect(resSearch.body.data.total).toBe(1);
      expect(resSearch.body.data.items[0].projectName).toBe('Alpha Express App');

      // 4. Sort by attemptNumber asc
      const resSort = await request(app)
        .get('/api/v1/dashboard/student/submissions?sortBy=attemptNumber&sortOrder=asc')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resSort.status).toBe(200);
      expect(resSort.body.data.items.length).toBe(2);
    });
  });

  // ==========================================
  // 3. Mentor Dashboard Metrics & Scoping
  // ==========================================
  describe('3. Mentor Dashboard Metrics & Scoping', () => {
    it('8. Mentor 1 dashboard overview reports scoped courses, assignments, and reviews', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/mentor')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Manageable entities created by Mentor 1
      expect(data.overview.manageableCoursesCount).toBe(2); // c1 (published) and c2 (draft)
      expect(data.overview.manageableModulesCount).toBe(1); // module 1
      expect(data.overview.manageableAssignmentsCount).toBe(2); // a1 and a2 (draft)

      // Submissions received for Mentor 1's assignments (a1 has 2 submissions: sub1 and sub3)
      expect(data.overview.totalSubmissionsReceived).toBe(2);
      expect(data.submissionsByStatus.APPROVED).toBe(1);
      expect(data.submissionsByStatus.UNDER_REVIEW).toBe(1);
      expect(data.submissionsByStatus.PENDING).toBe(0);
      expect(data.submissionsByStatus.REJECTED).toBe(0);

      // Pending reviews for mentor 1's assignments
      expect(data.overview.pendingReviewsCount).toBe(1); // sub3 is UNDER_REVIEW

      // Review activity: Mentor 1 reviewed 2 submissions (sub1 and sub3) and gave 1 feedback
      expect(data.overview.reviewedSubmissionsCount).toBe(2);
      expect(data.overview.totalFeedbacksGiven).toBe(1);

      // Recent submissions contain only submissions for a1
      const subIds = data.recentSubmissions.map((s: { id: string }) => s.id);
      expect(subIds).toContain(submission1Id);
      expect(subIds).toContain(submission3Id);
      expect(subIds).not.toContain(submission2Id); // belongs to Mentor 2
      expect(subIds).not.toContain(submission4Id); // belongs to Mentor 2

      // Recent reviews contain feedback given by Mentor 1
      expect(data.recentReviews.length).toBe(1);
      expect(data.recentReviews[0].comment).toBe('Great job! Meets all criteria.');
    });

    it('9. Mentor 2 dashboard isolates Mentor 2 manageable entities and submissions', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/mentor')
        .set('Authorization', `Bearer ${mentor2Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.overview.manageableCoursesCount).toBe(1); // course 3
      expect(data.overview.manageableAssignmentsCount).toBe(1); // assignment 3
      expect(data.overview.totalSubmissionsReceived).toBe(2); // sub2 (pending) and sub4 (rejected)
      expect(data.submissionsByStatus.PENDING).toBe(1);
      expect(data.submissionsByStatus.REJECTED).toBe(1);
      expect(data.submissionsByStatus.APPROVED).toBe(0);

      // Submissions outside Mentor 2's assignments are not visible
      const subIds = data.recentSubmissions.map((s: { id: string }) => s.id);
      expect(subIds).toContain(submission2Id);
      expect(subIds).toContain(submission4Id);
      expect(subIds).not.toContain(submission1Id);
    });

    it('10. Mentor can query paginated submissions with courseId, assignmentId, and search', async () => {
      // 1. Submissions for assignment 1
      const resA1 = await request(app)
        .get(`/api/v1/dashboard/mentor/submissions?assignmentId=${assignment1M1Id}`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resA1.status).toBe(200);
      expect(resA1.body.data.total).toBe(2);

      // 2. Submissions filtered by courseId (course 1 has module 1 with content item linking to assignment 1)
      const resCourse = await request(app)
        .get(`/api/v1/dashboard/mentor/submissions?courseId=${course1Id}`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resCourse.status).toBe(200);
      expect(resCourse.body.data.total).toBe(2);

      // 3. Search by student name
      const resSearch = await request(app)
        .get('/api/v1/dashboard/mentor/submissions?search=Student 1')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resSearch.status).toBe(200);
      expect(resSearch.body.data.total).toBe(1);
      expect(resSearch.body.data.items[0].student.name).toBe('Dashboard Student 1');
    });

    it('11. Mentor can list manageable courses with publication filter', async () => {
      // Published only
      const resPublished = await request(app)
        .get('/api/v1/dashboard/mentor/courses?status=published')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resPublished.status).toBe(200);
      expect(resPublished.body.data.total).toBe(1);
      expect(resPublished.body.data.items[0].id).toBe(course1Id);

      // Draft only
      const resDraft = await request(app)
        .get('/api/v1/dashboard/mentor/courses?status=draft')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resDraft.status).toBe(200);
      expect(resDraft.body.data.total).toBe(1);
      expect(resDraft.body.data.items[0].id).toBe(course2DraftId);
    });
  });

  // ==========================================
  // 4. Admin Dashboard Metrics & Management Lists
  // ==========================================
  describe('4. Admin Dashboard Metrics & Management Lists', () => {
    it('12. Admin dashboard summary calculates system-wide aggregates safely', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Users
      expect(data.users.total).toBeGreaterThanOrEqual(5);
      expect(data.users.byRole.STUDENT).toBeGreaterThanOrEqual(2);
      expect(data.users.byRole.MENTOR).toBeGreaterThanOrEqual(2);
      expect(data.users.byRole.ADMIN).toBeGreaterThanOrEqual(1);
      expect(data.users.byStatus.active).toBeGreaterThanOrEqual(5);

      // Courses
      expect(data.courses.total).toBeGreaterThanOrEqual(3);
      expect(data.courses.published).toBeGreaterThanOrEqual(2);
      expect(data.courses.draft).toBeGreaterThanOrEqual(1);

      // Assignments & Submissions
      expect(data.assignments.total).toBeGreaterThanOrEqual(3);
      expect(data.submissions.total).toBeGreaterThanOrEqual(4);
      expect(data.submissions.pendingReviewTotal).toBeGreaterThanOrEqual(2); // PENDING + UNDER_REVIEW

      // Recent users list does NOT contain password hashes
      expect(data.recentActivity.recentUsers.length).toBeGreaterThan(0);
      for (const u of data.recentActivity.recentUsers) {
        expect((u as Record<string, unknown>).passwordHash).toBeUndefined();
        expect((u as Record<string, unknown>).password).toBeUndefined();
        expect(u.id).toBeDefined();
        expect(u.email).toBeDefined();
      }

      // Recent submissions
      expect(data.recentActivity.recentSubmissions.length).toBeGreaterThanOrEqual(4);
    });

    it('13. Admin can paginate, search, and filter users without leaking password hashes', async () => {
      // Filter by role: MENTOR
      const resMentors = await request(app)
        .get('/api/v1/dashboard/admin/users?role=MENTOR&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resMentors.status).toBe(200);
      expect(resMentors.body.data.total).toBeGreaterThanOrEqual(2);
      for (const user of resMentors.body.data.items) {
        expect(user.role).toBe('MENTOR');
        expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
      }

      // Search by exact unique email
      const resSearch = await request(app)
        .get(`/api/v1/dashboard/admin/users?search=${encodeURIComponent(student1Email)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resSearch.status).toBe(200);
      expect(resSearch.body.data.total).toBe(1);
      expect(resSearch.body.data.items[0].id).toBe(student1Id);
      expect(resSearch.body.data.items[0].email).toBe(student1Email);

      // Filter by status: active
      const resActive = await request(app)
        .get('/api/v1/dashboard/admin/users?status=active&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resActive.status).toBe(200);
      expect(resActive.body.data.items.length).toBeGreaterThan(0);
      for (const user of resActive.body.data.items) {
        expect(user.isActive).toBe(true);
      }
    });

    it('14. Admin can list system-wide submissions with pagination and status filters', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/admin/submissions?status=APPROVED&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      for (const sub of res.body.data.items) {
        expect(sub.status).toBe('APPROVED');
      }
    });
  });

  // ==========================================
  // 5. Validation, Query Guards & Empty Results
  // ==========================================
  describe('5. Validation, Query Guards & Empty Results', () => {
    it('15. Rejects invalid pagination values (page < 1 or limit > 100) with 400 Bad Request', async () => {
      const resZeroPage = await request(app)
        .get('/api/v1/dashboard/student/submissions?page=0')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resZeroPage.status).toBe(400);
      expect(resZeroPage.body.error.code).toBe('VALIDATION_ERROR');

      const resExcessLimit = await request(app)
        .get('/api/v1/dashboard/student/submissions?limit=500')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());
      expect(resExcessLimit.status).toBe(400);
      expect(resExcessLimit.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('16. Rejects unsupported sort fields with 400 Bad Request', async () => {
      const resInvalidSort = await request(app)
        .get('/api/v1/dashboard/student/submissions?sortBy=passwordHash')
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resInvalidSort.status).toBe(400);
      expect(resInvalidSort.body.error.code).toBe('VALIDATION_ERROR');

      const resInvalidAdminSort = await request(app)
        .get('/api/v1/dashboard/admin/users?sortBy=nonExistentField')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resInvalidAdminSort.status).toBe(400);
    });

    it('17. Rejects invalid UUID query parameters with 400 Bad Request', async () => {
      const resBadUuid = await request(app)
        .get('/api/v1/dashboard/mentor/submissions?assignmentId=not-a-valid-uuid')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(resBadUuid.status).toBe(400);
      expect(resBadUuid.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('18. Rejects inverted date ranges (from > to) with 400 Bad Request', async () => {
      const from = '2026-10-25T00:00:00.000Z';
      const to = '2026-10-20T00:00:00.000Z';

      const res = await request(app)
        .get(`/api/v1/dashboard/student/submissions?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('19. Handles empty query results cleanly with predictable metadata', async () => {
      const nonExistentUuid = randomUUID();
      const res = await request(app)
        .get(`/api/v1/dashboard/student/submissions?assignmentId=${nonExistentUuid}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.totalPages).toBe(0);
      expect(res.body.data.hasNextPage).toBe(false);
      expect(res.body.data.hasPrevPage).toBe(false);
    });
  });
});
