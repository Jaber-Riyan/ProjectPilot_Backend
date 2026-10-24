import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { Role, SubmissionPolicy, ContentType } from '../src/models';
import { signAccessToken } from '../src/lib/jwt';
import { hashPassword } from '../src/lib/password';
import { getPrismaClient, disconnectDatabase } from '../src/db/prisma';

describe('Phase 7 — Assignment APIs, Submission Attempts, and Reusable LMS Resources', { timeout: 35000 }, () => {
  const prisma = getPrismaClient();
  const getTestIp = () =>
    `10.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}`;

  let studentToken: string;
  let otherStudentToken: string;
  let mentorToken: string;
  let _adminToken: string;

  let studentId: string;
  let otherStudentId: string;
  let mentorId: string;
  let adminId: string;

  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdModuleIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  beforeAll(async () => {
    const defaultPasswordHash = await hashPassword('Phase7Secret123!');

    // 1. Create Student 1
    const studentUser = await prisma.user.create({
      data: {
        name: 'Phase 7 Student 1',
        email: `student1_p7_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.STUDENT,
        isActive: true,
      },
    });
    studentId = studentUser.id;
    createdUserIds.push(studentId);
    studentToken = signAccessToken({
      sub: studentId,
      email: studentUser.email,
      role: Role.STUDENT,
      name: studentUser.name,
    });

    // 2. Create Student 2
    const otherStudent = await prisma.user.create({
      data: {
        name: 'Phase 7 Student 2',
        email: `student2_p7_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.STUDENT,
        isActive: true,
      },
    });
    otherStudentId = otherStudent.id;
    createdUserIds.push(otherStudentId);
    otherStudentToken = signAccessToken({
      sub: otherStudentId,
      email: otherStudent.email,
      role: Role.STUDENT,
      name: otherStudent.name,
    });

    // 3. Create Mentor
    const mentorUser = await prisma.user.create({
      data: {
        name: 'Phase 7 Mentor',
        email: `mentor_p7_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.MENTOR,
        isActive: true,
      },
    });
    mentorId = mentorUser.id;
    createdUserIds.push(mentorId);
    mentorToken = signAccessToken({
      sub: mentorId,
      email: mentorUser.email,
      role: Role.MENTOR,
      name: mentorUser.name,
    });

    // 4. Create Admin
    const adminUser = await prisma.user.create({
      data: {
        name: 'Phase 7 Admin',
        email: `admin_p7_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });
    adminId = adminUser.id;
    createdUserIds.push(adminId);
    _adminToken = signAccessToken({
      sub: adminId,
      email: adminUser.email,
      role: Role.ADMIN,
      name: adminUser.name,
    });
  });

  afterAll(async () => {
    try {
      // 1. Delete created assignments (cascades or cleans submissions and feedbacks)
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

      // 2. Delete courses, course_modules, and modules
      if (createdCourseIds.length > 0) {
        await prisma.courseModule.deleteMany({
          where: { courseId: { in: createdCourseIds } },
        });
        await prisma.course.deleteMany({
          where: { id: { in: createdCourseIds } },
        });
      }

      if (createdModuleIds.length > 0) {
        await prisma.contentItem.deleteMany({
          where: { moduleId: { in: createdModuleIds } },
        });
        await prisma.courseModule.deleteMany({
          where: { moduleId: { in: createdModuleIds } },
        });
        await prisma.module.deleteMany({
          where: { id: { in: createdModuleIds } },
        });
      }

      // 3. Delete users
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    } finally {
      await disconnectDatabase();
    }
  });

  describe('1. Reusable Modules and Course-Module Associations', () => {
    let reusableModuleId: string;
    let courseAId: string;
    let courseBId: string;

    it('1. Mentors can create independent modules without parent course', async () => {
      const res = await request(app)
        .post('/api/v1/modules')
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Reusable Git & GitHub Basics',
          description: 'A comprehensive module on version control',
          isPublished: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Reusable Git & GitHub Basics');
      reusableModuleId = res.body.data.id;
      createdModuleIds.push(reusableModuleId);

      // Add a content item to this independent module
      const contentRes = await request(app)
        .post(`/api/v1/modules/${reusableModuleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Git Init and Commit',
          type: ContentType.TEXT,
          body: 'How to commit files to git',
        });

      expect(contentRes.status).toBe(201);
    });

    it('2. The same module can be attached to multiple courses with independent ordering', async () => {
      // Create Course A
      const resA = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({ title: 'Fullstack Bootcamp', isPublished: true });
      expect(resA.status).toBe(201);
      courseAId = resA.body.data.id;
      createdCourseIds.push(courseAId);

      // Create Course B
      const resB = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({ title: 'DevOps & Cloud Fundamentals', isPublished: true });
      expect(resB.status).toBe(201);
      courseBId = resB.body.data.id;
      createdCourseIds.push(courseBId);

      // Attach reusable module to Course A
      const attachA = await request(app)
        .post(`/api/v1/courses/${courseAId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({ moduleId: reusableModuleId });

      expect(attachA.status).toBe(201);
      expect(attachA.body.data.id).toBe(reusableModuleId);
      expect(attachA.body.data.order).toBe(1);

      // Attach the SAME reusable module to Course B
      const attachB = await request(app)
        .post(`/api/v1/courses/${courseBId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({ moduleId: reusableModuleId });

      expect(attachB.status).toBe(201);
      expect(attachB.body.data.id).toBe(reusableModuleId);
      expect(attachB.body.data.order).toBe(1);

      // Duplicate attach to same course is rejected
      const duplicateAttach = await request(app)
        .post(`/api/v1/courses/${courseAId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({ moduleId: reusableModuleId });

      expect(duplicateAttach.status).toBe(409);
    });

    it('3. Detaching a module from one course leaves other courses and module content untouched', async () => {
      // Detach from Course A
      const detachRes = await request(app)
        .delete(`/api/v1/courses/${courseAId}/modules/${reusableModuleId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(detachRes.status).toBe(200);

      // Verify Course A no longer has this module
      const courseAList = await request(app)
        .get(`/api/v1/courses/${courseAId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(courseAList.status).toBe(200);
      expect((courseAList.body.data as unknown[]).length).toBe(0);

      // Verify Course B STILL has this module intact
      const courseBList = await request(app)
        .get(`/api/v1/courses/${courseBId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(courseBList.status).toBe(200);
      expect((courseBList.body.data as Array<{ id: string }>)[0]?.id).toBe(reusableModuleId);

      // Verify module detail and its content item remain intact
      const detailRes = await request(app)
        .get(`/api/v1/modules/${reusableModuleId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.contentItems.length).toBe(1);
    });

    it('4. Deleting a module while attached to courses is rejected (409 Conflict)', async () => {
      // Attempt to delete module while still attached to Course B
      const delRes = await request(app)
        .delete(`/api/v1/modules/${reusableModuleId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(delRes.status).toBe(409);
      expect(delRes.body.error.code).toBe('MODULE_ATTACHED_TO_COURSE');

      // Now detach from Course B and delete successfully
      const detachB = await request(app)
        .delete(`/api/v1/courses/${courseBId}/modules/${reusableModuleId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(detachB.status).toBe(200);

      const successfulDel = await request(app)
        .delete(`/api/v1/modules/${reusableModuleId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(successfulDel.status).toBe(200);
    });
  });

  describe('2. Independent Assignment Management', () => {
    let oneTimeAssignmentId: string;
    let resubmittableAssignmentId: string;

    it('5. Mentors can create independent assignments with ONE_TIME or RESUBMITTABLE policies', async () => {
      // Create ONE_TIME assignment
      const res1 = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Final Certification Exam Project',
          instructions: 'Submit your final exam project repo. Only one attempt is permitted.',
          submissionPolicy: SubmissionPolicy.ONE_TIME,
          isPublished: true,
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.submissionPolicy).toBe('ONE_TIME');
      oneTimeAssignmentId = res1.body.data.id;
      createdAssignmentIds.push(oneTimeAssignmentId);

      // Create RESUBMITTABLE assignment
      const res2 = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Portfolio Website Iterations',
          instructions: 'Build your personal portfolio. You may submit revisions based on mentor reviews.',
          submissionPolicy: SubmissionPolicy.RESUBMITTABLE,
          isPublished: true,
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.submissionPolicy).toBe('RESUBMITTABLE');
      resubmittableAssignmentId = res2.body.data.id;
      createdAssignmentIds.push(resubmittableAssignmentId);
    });

    it('6. Students cannot create assignments (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Unauthorized Student Assignment',
          instructions: 'This should fail',
        });

      expect(res.status).toBe(403);
    });

    it('7. Content items can reference independent assignments across any module', async () => {
      // Create a module
      const moduleRes = await request(app)
        .post('/api/v1/modules')
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({ title: 'Module Hosting Assignment Ref', isPublished: true });
      expect(moduleRes.status).toBe(201);
      const modId = moduleRes.body.data.id;
      createdModuleIds.push(modId);

      // Create content item of type ASSIGNMENT referencing oneTimeAssignmentId
      const contentRes = await request(app)
        .post(`/api/v1/modules/${modId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Checkpoint: Final Exam',
          type: ContentType.ASSIGNMENT,
          assignmentId: oneTimeAssignmentId,
        });

      expect(contentRes.status).toBe(201);
      expect(contentRes.body.data.assignmentId).toBe(oneTimeAssignmentId);
    });

    it('8. Assignments list and detail can be retrieved with appropriate role permissions', async () => {
      // List assignments
      const listRes = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data.items)).toBe(true);

      // Detail retrieval
      const detailRes = await request(app)
        .get(`/api/v1/assignments/${oneTimeAssignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.title).toBe('Final Certification Exam Project');
      expect(detailRes.body.data.submissionPolicy).toBe('ONE_TIME');
    });
  });

  describe('3. Student Submissions, Attempt Policies & Concurrency', () => {
    let oneTimeAssignmentId: string;
    let resubmittableAssignmentId: string;

    beforeAll(async () => {
      const a1 = await prisma.assignment.create({
        data: {
          title: 'Strict Single Submission Exam',
          instructions: 'One shot only',
          submissionPolicy: SubmissionPolicy.ONE_TIME,
          isPublished: true,
          createdById: mentorId,
        },
      });
      oneTimeAssignmentId = a1.id;
      createdAssignmentIds.push(oneTimeAssignmentId);

      const a2 = await prisma.assignment.create({
        data: {
          title: 'Iterative Capstone Project',
          instructions: 'Multiple attempts permitted',
          submissionPolicy: SubmissionPolicy.RESUBMITTABLE,
          isPublished: true,
          createdById: mentorId,
        },
      });
      resubmittableAssignmentId = a2.id;
      createdAssignmentIds.push(resubmittableAssignmentId);
    });

    it('9. Student can submit first attempt for a ONE_TIME assignment', async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${oneTimeAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'My Final Exam Project',
          repoUrl: 'https://github.com/student/final-exam',
          liveUrl: 'https://final-exam.example.com',
          description: 'Initial completed implementation',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attemptNumber).toBe(1);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.student.id).toBe(studentId);
    });

    it('10. Student is rejected when attempting to resubmit to a ONE_TIME assignment (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${oneTimeAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'My Final Exam Project Second Try',
          repoUrl: 'https://github.com/student/final-exam-v2',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SUBMISSION_POLICY_VIOLATION');
    });

    it('11. Another student CAN submit their first attempt to the same ONE_TIME assignment', async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${oneTimeAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Student 2 Exam Submission',
          repoUrl: 'https://github.com/student2/exam',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attemptNumber).toBe(1);
      expect(res.body.data.student.id).toBe(otherStudentId);
    });

    it('12. Resubmittable assignment increments attemptNumber deterministically (1, 2)', async () => {
      // First attempt
      const attempt1 = await request(app)
        .post(`/api/v1/assignments/${resubmittableAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Capstone v1',
          repoUrl: 'https://github.com/student/capstone-v1',
        });

      expect(attempt1.status).toBe(201);
      expect(attempt1.body.data.attemptNumber).toBe(1);
      const sub1Id = attempt1.body.data.id;

      // Add feedback for attempt 1
      await prisma.feedback.create({
        data: {
          submissionId: sub1Id,
          mentorId,
          comment: 'Good start. Please add unit tests and resubmit.',
        },
      });

      // Second attempt
      const attempt2 = await request(app)
        .post(`/api/v1/assignments/${resubmittableAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Capstone v2 (with tests)',
          repoUrl: 'https://github.com/student/capstone-v2',
          description: 'Added 20 unit tests as requested by mentor',
        });

      expect(attempt2.status).toBe(201);
      expect(attempt2.body.data.attemptNumber).toBe(2);

      // Student checks attempt history
      const historyRes = await request(app)
        .get(`/api/v1/assignments/${resubmittableAssignmentId}/submissions/me`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(historyRes.status).toBe(200);
      const attempts = historyRes.body.data as Array<{ attemptNumber: number; feedbacks: unknown[] }>;
      expect(attempts.length).toBe(2);
      expect(attempts[0]?.attemptNumber).toBe(2);
      expect(attempts[1]?.attemptNumber).toBe(1);
      // Historical feedback for attempt 1 is intact!
      expect(attempts[1]?.feedbacks.length).toBe(1);
    });

    it('13. Mentor cannot transition policy from RESUBMITTABLE to ONE_TIME when multiple attempts exist (409 Conflict)', async () => {
      const res = await request(app)
        .patch(`/api/v1/assignments/${resubmittableAssignmentId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          submissionPolicy: SubmissionPolicy.ONE_TIME,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MULTIPLE_ATTEMPTS_EXIST');
    });

    it('14. Cannot delete an assignment that already has student submissions (409 Conflict)', async () => {
      const res = await request(app)
        .delete(`/api/v1/assignments/${oneTimeAssignmentId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ASSIGNMENT_HAS_SUBMISSIONS');
    });

    it('15. Submission detail endpoint enforces authorization', async () => {
      // Find submission by student 1
      const studentSub = await prisma.submission.findFirst({
        where: { studentId, assignmentId: oneTimeAssignmentId },
      });
      expect(studentSub).not.toBeNull();
      const subId = studentSub!.id;

      // Student 1 can view their own submission
      const ownRes = await request(app)
        .get(`/api/v1/submissions/${subId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(ownRes.status).toBe(200);
      expect(ownRes.body.data.id).toBe(subId);

      // Student 2 CANNOT view Student 1's submission (403 Forbidden)
      const otherRes = await request(app)
        .get(`/api/v1/submissions/${subId}`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(otherRes.status).toBe(403);

      // Mentor CAN view Student 1's submission
      const mentorRes = await request(app)
        .get(`/api/v1/submissions/${subId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(mentorRes.status).toBe(200);
      expect(mentorRes.body.data.id).toBe(subId);
    });

    it('16. Concurrency-safe submissions against PostgreSQL: concurrent attempts on ONE_TIME assignment serialize safely', async () => {
      // Create fresh ONE_TIME assignment
      const concurrentAssign = await prisma.assignment.create({
        data: {
          title: 'Concurrent Race Test Assignment',
          instructions: 'Concurrency check',
          submissionPolicy: SubmissionPolicy.ONE_TIME,
          isPublished: true,
          createdById: mentorId,
        },
      });
      createdAssignmentIds.push(concurrentAssign.id);

      // Fire 4 concurrent submissions for the SAME student simultaneously
      const requests = Array.from({ length: 4 }).map((_, i) =>
        request(app)
          .post(`/api/v1/assignments/${concurrentAssign.id}/submissions`)
          .set('Authorization', `Bearer ${studentToken}`)
          .set('X-Forwarded-For', getTestIp())
          .send({
            projectName: `Concurrent Attempt ${i + 1}`,
            repoUrl: `https://github.com/student/concurrent-${i + 1}`,
          })
      );

      const results = await Promise.all(requests);
      const statusCodes = results.map((r) => r.status);

      // Exactly ONE submission must succeed (201), the rest must be 409 Conflict
      const successCount = statusCodes.filter((s) => s === 201).length;
      const conflictCount = statusCodes.filter((s) => s === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(3);

      // Verify in DB that exactly 1 submission row exists
      const totalInDb = await prisma.submission.count({
        where: { assignmentId: concurrentAssign.id, studentId },
      });
      expect(totalInDb).toBe(1);
    });
  });
});
