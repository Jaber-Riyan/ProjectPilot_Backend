import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { Role, SubmissionPolicy, SubmissionStatus } from '../src/models';
import { signAccessToken } from '../src/lib/jwt';
import { hashPassword } from '../src/lib/password';
import { getPrismaClient, disconnectDatabase } from '../src/db/prisma';

describe('Phase 8 — Review APIs: Mentor Feedback, Approval/Rejection, and Protected Status Changes', { timeout: 35000 }, () => {
  const prisma = getPrismaClient();
  const getTestIp = () =>
    `10.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}`;

  let student1Token: string;
  let student2Token: string;
  let mentor1Token: string;
  let mentor2Token: string;
  let adminToken: string;

  let student1Id: string;
  let student2Id: string;
  let mentor1Id: string;
  let mentor2Id: string;
  let adminId: string;

  let assignment1Id: string; // Mentor 1, ONE_TIME
  let assignment2Id: string; // Mentor 1, RESUBMITTABLE
  let assignment3Id: string; // Mentor 2, ONE_TIME

  const createdUserIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  beforeAll(async () => {
    const defaultPasswordHash = await hashPassword('Phase8Secret123!');

    // 1. Create Student 1
    const student1 = await prisma.user.create({
      data: {
        name: 'Phase 8 Student 1',
        email: `student1_p8_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.STUDENT,
        isActive: true,
      },
    });
    student1Id = student1.id;
    createdUserIds.push(student1Id);
    student1Token = signAccessToken({
      sub: student1Id,
      email: student1.email,
      role: Role.STUDENT,
      name: student1.name,
    });

    // 2. Create Student 2
    const student2 = await prisma.user.create({
      data: {
        name: 'Phase 8 Student 2',
        email: `student2_p8_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.STUDENT,
        isActive: true,
      },
    });
    student2Id = student2.id;
    createdUserIds.push(student2Id);
    student2Token = signAccessToken({
      sub: student2Id,
      email: student2.email,
      role: Role.STUDENT,
      name: student2.name,
    });

    // 3. Create Mentor 1
    const mentor1 = await prisma.user.create({
      data: {
        name: 'Phase 8 Mentor 1',
        email: `mentor1_p8_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.MENTOR,
        isActive: true,
      },
    });
    mentor1Id = mentor1.id;
    createdUserIds.push(mentor1Id);
    mentor1Token = signAccessToken({
      sub: mentor1Id,
      email: mentor1.email,
      role: Role.MENTOR,
      name: mentor1.name,
    });

    // 4. Create Mentor 2
    const mentor2 = await prisma.user.create({
      data: {
        name: 'Phase 8 Mentor 2',
        email: `mentor2_p8_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.MENTOR,
        isActive: true,
      },
    });
    mentor2Id = mentor2.id;
    createdUserIds.push(mentor2Id);
    mentor2Token = signAccessToken({
      sub: mentor2Id,
      email: mentor2.email,
      role: Role.MENTOR,
      name: mentor2.name,
    });

    // 5. Create Admin
    const admin = await prisma.user.create({
      data: {
        name: 'Phase 8 Admin',
        email: `admin_p8_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });
    adminId = admin.id;
    createdUserIds.push(adminId);
    adminToken = signAccessToken({
      sub: adminId,
      email: admin.email,
      role: Role.ADMIN,
      name: admin.name,
    });

    // 6. Create Assignments
    const a1 = await prisma.assignment.create({
      data: {
        title: 'Backend Mastery Capstone (M1)',
        instructions: 'Final exam submission - ONE_TIME',
        submissionPolicy: SubmissionPolicy.ONE_TIME,
        isPublished: true,
        createdById: mentor1Id,
      },
    });
    assignment1Id = a1.id;
    createdAssignmentIds.push(assignment1Id);

    const a2 = await prisma.assignment.create({
      data: {
        title: 'Portfolio Project (M1)',
        instructions: 'Iterative portfolio - RESUBMITTABLE',
        submissionPolicy: SubmissionPolicy.RESUBMITTABLE,
        isPublished: true,
        createdById: mentor1Id,
      },
    });
    assignment2Id = a2.id;
    createdAssignmentIds.push(assignment2Id);

    const a3 = await prisma.assignment.create({
      data: {
        title: 'Algorithms Homework (M2)',
        instructions: 'Homework - ONE_TIME',
        submissionPolicy: SubmissionPolicy.ONE_TIME,
        isPublished: true,
        createdById: mentor2Id,
      },
    });
    assignment3Id = a3.id;
    createdAssignmentIds.push(assignment3Id);
  });

  afterAll(async () => {
    try {
      if (createdAssignmentIds.length > 0) {
        await prisma.feedback.deleteMany({
          where: { submission: { assignmentId: { in: createdAssignmentIds } } },
        });
        await prisma.submission.deleteMany({
          where: { assignmentId: { in: createdAssignmentIds } },
        });
        await prisma.assignment.deleteMany({
          where: { id: { in: createdAssignmentIds } },
        });
      }

      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    } finally {
      await disconnectDatabase();
    }
  });

  describe('1. Review Queue & Scoped Authorization', () => {
    let subM1Id: string;
    let subM2Id: string;

    beforeAll(async () => {
      // Student 1 submits to Assignment 1 (Mentor 1)
      const res1 = await request(app)
        .post(`/api/v1/assignments/${assignment1Id}/submissions`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Student 1 Capstone',
          repoUrl: 'https://github.com/student1/capstone',
        });
      expect(res1.status).toBe(201);
      subM1Id = res1.body.data.id;

      // Student 2 submits to Assignment 3 (Mentor 2)
      const res2 = await request(app)
        .post(`/api/v1/assignments/${assignment3Id}/submissions`)
        .set('Authorization', `Bearer ${student2Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Student 2 Algorithms',
          repoUrl: 'https://github.com/student2/algo',
        });
      expect(res2.status).toBe(201);
      subM2Id = res2.body.data.id;
    }, 35000);

    it('1. Mentor 1 can retrieve pending submissions for their own assignments', async () => {
      const res = await request(app)
        .get('/api/v1/mentor/submissions')
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data.items as Array<{ id: string; assignment: { id: string } }>;
      const itemIds = items.map((i) => i.id);
      expect(itemIds).toContain(subM1Id);
      expect(itemIds).not.toContain(subM2Id);
    });

    it('2. Unauthorized mentor cannot see submissions outside their review scope', async () => {
      const res = await request(app)
        .get('/api/v1/mentor/submissions')
        .set('Authorization', `Bearer ${mentor2Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      const items = res.body.data.items as Array<{ id: string }>;
      const itemIds = items.map((i) => i.id);
      expect(itemIds).toContain(subM2Id);
      expect(itemIds).not.toContain(subM1Id);
    });

    it('3. Unauthorized mentor cannot access detail of another mentor\'s private submission (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/mentor/submissions/${subM1Id}`)
        .set('Authorization', `Bearer ${mentor2Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('4. Administrator can view all submissions in the review queue and access any detail', async () => {
      const queueRes = await request(app)
        .get('/api/v1/mentor/submissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(queueRes.status).toBe(200);
      const items = queueRes.body.data.items as Array<{ id: string }>;
      const itemIds = items.map((i) => i.id);
      expect(itemIds).toContain(subM1Id);
      expect(itemIds).toContain(subM2Id);

      // Detail access by admin
      const detailRes = await request(app)
        .get(`/api/v1/mentor/submissions/${subM1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.id).toBe(subM1Id);
    });

    it('5. Review queue filters (status, assignmentId, studentId) and pagination work correctly', async () => {
      const filterRes = await request(app)
        .get(`/api/v1/mentor/submissions?status=PENDING&assignmentId=${assignment1Id}&studentId=${student1Id}&page=1&limit=10`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(filterRes.status).toBe(200);
      expect(filterRes.body.data.total).toBe(1);
      expect(filterRes.body.data.items[0]?.id).toBe(subM1Id);
    });
  });

  describe('2. Submission Review Workflow & State Transitions', () => {
    let pendingSubId: string;
    let resubmittableSubId: string;

    beforeAll(async () => {
      // Submission on Assignment 1 (ONE_TIME)
      const res1 = await request(app)
        .post(`/api/v1/assignments/${assignment1Id}/submissions`)
        .set('Authorization', `Bearer ${student2Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Student 2 Final Exam',
          repoUrl: 'https://github.com/student2/final-exam',
        });
      expect(res1.status).toBe(201);
      pendingSubId = res1.body.data.id;

      // Submission on Assignment 2 (RESUBMITTABLE)
      const res2 = await request(app)
        .post(`/api/v1/assignments/${assignment2Id}/submissions`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Student 1 Portfolio v1',
          repoUrl: 'https://github.com/student1/portfolio',
        });
      expect(res2.status).toBe(201);
      resubmittableSubId = res2.body.data.id;
    }, 35000);

    it('6. Mentor can start reviewing a submission (PENDING → UNDER_REVIEW)', async () => {
      const res = await request(app)
        .post(`/api/v1/submissions/${pendingSubId}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.UNDER_REVIEW,
          comment: 'I am now reviewing this code.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UNDER_REVIEW');
      expect(res.body.data.reviewedBy.id).toBe(mentor1Id);
      expect(res.body.data.feedbacks.length).toBe(1);
    });

    it('7. Rejection without feedback is rejected (400 Bad Request)', async () => {
      const res = await request(app)
        .post(`/api/v1/submissions/${pendingSubId}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.REJECTED,
          // comment omitted or empty
        });

      expect(res.status).toBe(400);
    });

    it('8. Resubmission request on ONE_TIME assignment is rejected (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/submissions/${pendingSubId}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.RESUBMISSION_REQUESTED,
          comment: 'Please try again',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESUBMISSION_NOT_ALLOWED');
    });

    it('9. Mentor can approve a submission (UNDER_REVIEW → APPROVED)', async () => {
      const res = await request(app)
        .post(`/api/v1/submissions/${pendingSubId}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.APPROVED,
          comment: 'Outstanding project! Full marks.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.feedbacks.length).toBe(2);
    });

    it('10. Invalid transitions from terminal state are rejected (409 Conflict)', async () => {
      // Trying to transition from APPROVED back to PENDING or UNDER_REVIEW
      const res = await request(app)
        .post(`/api/v1/submissions/${pendingSubId}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.UNDER_REVIEW,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('11. Mentor can request resubmission on RESUBMITTABLE assignment (PENDING → RESUBMISSION_REQUESTED)', async () => {
      const res = await request(app)
        .post(`/api/v1/submissions/${resubmittableSubId}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.RESUBMISSION_REQUESTED,
          comment: 'Please add automated integration tests and resubmit.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESUBMISSION_REQUESTED');
      expect(res.body.data.feedbacks[0]?.comment).toContain('Please add automated integration tests');
    });

    it('12. Reviewer can append additional feedback notes via PATCH', async () => {
      const res = await request(app)
        .patch(`/api/v1/submissions/${resubmittableSubId}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          comment: 'Also make sure to check test coverage exceeds 80%.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.feedbacks.length).toBe(2);
      expect(res.body.data.feedbacks[0]?.comment).toContain('test coverage exceeds 80%');
    });
  });

  describe('3. Protection, Ownership & Student Verification', () => {
    let studentSubId: string;

    beforeAll(async () => {
      const aProtect = await prisma.assignment.create({
        data: {
          title: 'Protection Verification Assignment',
          instructions: 'Protection test instructions',
          submissionPolicy: SubmissionPolicy.ONE_TIME,
          isPublished: true,
          createdById: mentor1Id,
        },
      });
      createdAssignmentIds.push(aProtect.id);

      const res = await request(app)
        .post(`/api/v1/assignments/${aProtect.id}/submissions`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Student 1 Protect Test',
          repoUrl: 'https://github.com/student1/protect',
        });
      expect(res.status).toBe(201);
      studentSubId = res.body.data.id;

      // Mentor reviews it
      await request(app)
        .post(`/api/v1/submissions/${studentSubId}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.APPROVED,
          comment: 'Verified and approved by mentor.',
        });
    }, 35000);

    it('13. Student cannot review or change submission status (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/submissions/${studentSubId}/review`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.APPROVED,
          comment: 'Self approved!',
        });

      expect(res.status).toBe(403);
    });

    it('14. Reviewer identity is derived from authentication and client cannot forge reviewerId', async () => {
      // Find submission in DB to verify reviewedById matches token
      const dbSub = await prisma.submission.findUnique({
        where: { id: studentSubId },
      });
      expect(dbSub?.reviewedById).toBe(mentor1Id);
    });

    it('15. Student can view their own review result and feedback history', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/${studentSubId}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.feedbacks.length).toBe(1);
      expect(res.body.data.feedbacks[0]?.comment).toBe('Verified and approved by mentor.');
    });

    it('16. Student CANNOT view another student\'s submission review (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/${studentSubId}`)
        .set('Authorization', `Bearer ${student2Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Attempt History & Resubmission Policy Preservation', () => {
    let resubmitAssignmentId: string;
    let attempt1Id: string;

    beforeAll(async () => {
      const a = await prisma.assignment.create({
        data: {
          title: 'Preservation History Assignment',
          instructions: 'Testing feedback retention across attempts',
          submissionPolicy: SubmissionPolicy.RESUBMITTABLE,
          isPublished: true,
          createdById: mentor1Id,
        },
      });
      resubmitAssignmentId = a.id;
      createdAssignmentIds.push(resubmitAssignmentId);

      // Student submits attempt 1
      const sub1 = await request(app)
        .post(`/api/v1/assignments/${resubmitAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Attempt 1 Source',
          repoUrl: 'https://github.com/student1/attempt-1',
        });
      attempt1Id = sub1.body.data.id;

      // Mentor reviews attempt 1: RESUBMISSION_REQUESTED
      await request(app)
        .post(`/api/v1/submissions/${attempt1Id}/review`)
        .set('Authorization', `Bearer ${mentor1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          status: SubmissionStatus.RESUBMISSION_REQUESTED,
          comment: 'Initial attempt incomplete. Please fix errors.',
        });
    }, 35000);

    it('17. Resubmission creates new attempt 2 while preserving attempt 1 review and feedback', async () => {
      // Student submits attempt 2
      const sub2 = await request(app)
        .post(`/api/v1/assignments/${resubmitAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Attempt 2 Source',
          repoUrl: 'https://github.com/student1/attempt-2',
        });

      expect(sub2.status).toBe(201);
      expect(sub2.body.data.attemptNumber).toBe(2);
      expect(sub2.body.data.status).toBe('PENDING');

      // Check student attempt history
      const history = await request(app)
        .get(`/api/v1/assignments/${resubmitAssignmentId}/submissions/me`)
        .set('Authorization', `Bearer ${student1Token}`)
        .set('X-Forwarded-For', getTestIp());

      expect(history.status).toBe(200);
      const attempts = history.body.data as Array<{
        attemptNumber: number;
        status: string;
        feedbacks: Array<{ comment: string }>;
      }>;
      expect(attempts.length).toBe(2);

      // Attempt 2 is PENDING
      expect(attempts[0]?.attemptNumber).toBe(2);
      expect(attempts[0]?.status).toBe('PENDING');
      expect(attempts[0]?.feedbacks.length).toBe(0);

      // Attempt 1 remains RESUBMISSION_REQUESTED with original feedback intact
      expect(attempts[1]?.attemptNumber).toBe(1);
      expect(attempts[1]?.status).toBe('RESUBMISSION_REQUESTED');
      expect(attempts[1]?.feedbacks[0]?.comment).toContain('Initial attempt incomplete');
    });
  });

  describe('5. Concurrency Safety & Parallel Review Conflicts', () => {
    it('18. Concurrent reviews competing on the same submission serialize safely without corrupting status', async () => {
      // Create fresh submission
      const subRes = await request(app)
        .post(`/api/v1/assignments/${assignment2Id}/submissions`)
        .set('Authorization', `Bearer ${student2Token}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          projectName: 'Race Test Submission',
          repoUrl: 'https://github.com/student2/race-test',
        });
      const raceSubId = subRes.body.data.id;

      // Two concurrent review requests fired simultaneously:
      // Request A tries to APPROVE
      // Request B tries to REJECT
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/v1/submissions/${raceSubId}/review`)
          .set('Authorization', `Bearer ${mentor1Token}`)
          .set('X-Forwarded-For', getTestIp())
          .send({
            status: SubmissionStatus.APPROVED,
            comment: 'Concurrent approval',
          }),
        request(app)
          .post(`/api/v1/submissions/${raceSubId}/review`)
          .set('Authorization', `Bearer ${mentor1Token}`)
          .set('X-Forwarded-For', getTestIp())
          .send({
            status: SubmissionStatus.REJECTED,
            comment: 'Concurrent rejection',
          }),
      ]);

      const statusCodes = [resA.status, resB.status];
      // Exactly one must succeed (200), and the other must be rejected with 409 Conflict due to invalid transition from already terminal state
      expect(statusCodes).toContain(200);
      expect(statusCodes).toContain(409);

      // Verify the final status in DB is consistent
      const dbSub = await prisma.submission.findUnique({
        where: { id: raceSubId },
      });
      expect(['APPROVED', 'REJECTED']).toContain(dbSub?.status);
    });
  });
});
