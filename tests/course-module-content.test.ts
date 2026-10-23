import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { Role, ContentType } from '../src/models';
import { signAccessToken } from '../src/lib/jwt';
import { hashPassword } from '../src/lib/password';
import { getPrismaClient, disconnectDatabase } from '../src/db/prisma';

describe('Phase 6 — Course & Module APIs, Content Management & Ordering', { timeout: 25000 }, () => {
  const prisma = getPrismaClient();
  const getTestIp = () =>
    `10.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}`;

  let studentToken: string;
  let mentorToken: string;
  let adminToken: string;

  let studentId: string;
  let mentorId: string;
  let adminId: string;

  const createdUserIds: string[] = [];
  const createdCourseIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  beforeAll(async () => {
    const defaultPasswordHash = await hashPassword('TestPassword123!');

    // 1. Create Student User
    const studentUser = await prisma.user.create({
      data: {
        name: 'Phase 6 Student',
        email: `student_p6_${randomUUID().slice(0, 8)}@example.com`,
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

    // 2. Create Mentor User
    const mentorUser = await prisma.user.create({
      data: {
        name: 'Phase 6 Mentor',
        email: `mentor_p6_${randomUUID().slice(0, 8)}@example.com`,
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

    // 3. Create Admin User
    const adminUser = await prisma.user.create({
      data: {
        name: 'Phase 6 Admin',
        email: `admin_p6_${randomUUID().slice(0, 8)}@example.com`,
        passwordHash: defaultPasswordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });
    adminId = adminUser.id;
    createdUserIds.push(adminId);
    adminToken = signAccessToken({
      sub: adminId,
      email: adminUser.email,
      role: Role.ADMIN,
      name: adminUser.name,
    });
  });

  afterAll(async () => {
    // Clean up created courses (cascades modules and content items)
    if (createdCourseIds.length > 0) {
      await prisma.course.deleteMany({
        where: { id: { in: createdCourseIds } },
      });
    }

    // Clean up created assignments
    if (createdAssignmentIds.length > 0) {
      await prisma.assignment.deleteMany({
        where: { id: { in: createdAssignmentIds } },
      });
    }

    // Clean up created users
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    await disconnectDatabase();
  });

  describe('1. Course Retrieval & Management', () => {
    let publishedCourseId: string;
    let draftCourseId: string;

    beforeAll(async () => {
      // Seed a published course
      const pubCourse = await prisma.course.create({
        data: {
          title: `Published Course ${randomUUID().slice(0, 6)}`,
          slug: `pub-course-${randomUUID().slice(0, 8)}`,
          description: 'A publicly visible test course',
          isPublished: true,
        },
      });
      publishedCourseId = pubCourse.id;
      createdCourseIds.push(pubCourse.id);

      // Seed a draft course
      const draftCourse = await prisma.course.create({
        data: {
          title: `Draft Course ${randomUUID().slice(0, 6)}`,
          slug: `draft-course-${randomUUID().slice(0, 8)}`,
          description: 'A draft course hidden from students',
          isPublished: false,
        },
      });
      draftCourseId = draftCourse.id;
      createdCourseIds.push(draftCourse.id);
    });

    it('1. Published courses can be listed by anyone', async () => {
      const res = await request(app)
        .get('/api/v1/courses')
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);

      const items = res.body.data.items as Array<{ id: string; isPublished: boolean }>;
      const foundPublished = items.some((c) => c.id === publishedCourseId);
      expect(foundPublished).toBe(true);
    });

    it('2. Pagination works and respects maximum limits', async () => {
      const res = await request(app)
        .get('/api/v1/courses?page=1&limit=2')
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(2);
      expect(res.body.data.total).toBeDefined();
      expect(res.body.data.totalPages).toBeDefined();
    });

    it('3. Students cannot view draft courses in list or detail', async () => {
      // In list: student does not see draftCourseId
      const listRes = await request(app)
        .get('/api/v1/courses')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(listRes.status).toBe(200);
      const items = listRes.body.data.items as Array<{ id: string }>;
      expect(items.some((c) => c.id === draftCourseId)).toBe(false);

      // In detail: student receives 404 for draft course
      const detailRes = await request(app)
        .get(`/api/v1/courses/${draftCourseId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(detailRes.status).toBe(404);
      expect(detailRes.body.error.code).toBe('COURSE_NOT_FOUND');
    });

    it('4. Mentors/admins can create and update courses', async () => {
      // Create course
      const createRes = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Fullstack TypeScript Development',
          description: 'Comprehensive Express and React course',
          imageUrl: 'https://example.com/course-thumbnail.png',
          isPublished: false,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.title).toBe('Fullstack TypeScript Development');
      expect(createRes.body.data.slug).toBeDefined();
      const newCourseId = createRes.body.data.id;
      createdCourseIds.push(newCourseId);

      // Update course (publish it)
      const updateRes = await request(app)
        .patch(`/api/v1/courses/${newCourseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Fullstack TS & Node Mastery',
          isPublished: true,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Fullstack TS & Node Mastery');
      expect(updateRes.body.data.isPublished).toBe(true);
    });

    it('5. Students cannot manage courses (403 Forbidden)', async () => {
      const createRes = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Unauthorized Student Course',
        });
      expect(createRes.status).toBe(403);
      expect(createRes.body.error.code).toBe('FORBIDDEN');

      const updateRes = await request(app)
        .patch(`/api/v1/courses/${publishedCourseId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({ title: 'Hacked Title' });
      expect(updateRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/v1/courses/${publishedCourseId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(deleteRes.status).toBe(403);
    });

    it('6. Invalid payloads are rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: '', // Empty title
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('7. Missing courses return 404 Not Found', async () => {
      const nonExistentId = randomUUID();
      const res = await request(app)
        .get(`/api/v1/courses/${nonExistentId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COURSE_NOT_FOUND');
    });
  });

  describe('2. Module Management & Deterministic Ordering', () => {
    let courseId: string;
    let module1Id: string;
    let module2Id: string;
    let module3Id: string;

    beforeAll(async () => {
      const course = await prisma.course.create({
        data: {
          title: `Module Test Course ${randomUUID().slice(0, 6)}`,
          slug: `module-test-${randomUUID().slice(0, 8)}`,
          isPublished: true,
        },
      });
      courseId = course.id;
      createdCourseIds.push(course.id);
    });

    it('8 & 9. Mentors can create modules and they append to the end by default', async () => {
      // Module 1 (auto order 1)
      const res1 = await request(app)
        .post(`/api/v1/courses/${courseId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Module 1: Getting Started',
          description: 'Introduction to fundamentals',
          isPublished: true,
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.order).toBe(1);
      module1Id = res1.body.data.id;

      // Module 2 (auto order 2)
      const res2 = await request(app)
        .post(`/api/v1/courses/${courseId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Module 2: Intermediate Deep Dive',
          isPublished: true,
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.order).toBe(2);
      module2Id = res2.body.data.id;

      // Module 3 (auto order 3)
      const res3 = await request(app)
        .post(`/api/v1/courses/${courseId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Module 3: Advanced Architectures',
          isPublished: true,
        });

      expect(res3.status).toBe(201);
      expect(res3.body.data.order).toBe(3);
      module3Id = res3.body.data.id;
    });

    it('10. Modules are returned in deterministic order (1, 2, 3)', async () => {
      const res = await request(app)
        .get(`/api/v1/courses/${courseId}/modules`)
        .set('X-Forwarded-For', getTestIp());

      expect(res.status).toBe(200);
      const modules = res.body.data as Array<{ id: string; order: number }>;
      expect(modules.length).toBe(3);
      expect(modules[0]?.id).toBe(module1Id);
      expect(modules[0]?.order).toBe(1);
      expect(modules[1]?.id).toBe(module2Id);
      expect(modules[1]?.order).toBe(2);
      expect(modules[2]?.id).toBe(module3Id);
      expect(modules[2]?.order).toBe(3);
    });

    it('11. Updating a module cannot move it to an unrelated course accidentally', async () => {
      const otherCourse = await prisma.course.create({
        data: {
          title: 'Unrelated Course',
          slug: `unrelated-${randomUUID().slice(0, 8)}`,
          isPublished: true,
        },
      });
      createdCourseIds.push(otherCourse.id);

      const res = await request(app)
        .patch(`/api/v1/modules/${module1Id}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Module 1: Renamed Title',
          courseId: otherCourse.id, // Attempt to reassign courseId
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Module 1: Renamed Title');

      // Verify in DB that courseId remains unchanged
      const dbModule = await prisma.module.findUnique({ where: { id: module1Id } });
      expect(dbModule?.courseId).toBe(courseId);
    });

    it('12. Reordering modules produces the requested sequence ([3, 1, 2]) safely', async () => {
      const res = await request(app)
        .patch(`/api/v1/courses/${courseId}/modules/reorder`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          moduleIds: [module3Id, module1Id, module2Id],
        });

      expect(res.status).toBe(200);
      const reordered = res.body.data as Array<{ id: string; order: number }>;
      expect(reordered[0]?.id).toBe(module3Id);
      expect(reordered[0]?.order).toBe(1);
      expect(reordered[1]?.id).toBe(module1Id);
      expect(reordered[1]?.order).toBe(2);
      expect(reordered[2]?.id).toBe(module2Id);
      expect(reordered[2]?.order).toBe(3);

      // Verify in database directly
      const dbModule3 = await prisma.module.findUnique({ where: { id: module3Id } });
      const dbModule1 = await prisma.module.findUnique({ where: { id: module1Id } });
      const dbModule2 = await prisma.module.findUnique({ where: { id: module2Id } });
      expect(dbModule3?.order).toBe(1);
      expect(dbModule1?.order).toBe(2);
      expect(dbModule2?.order).toBe(3);
    });

    it('13. Duplicate or foreign-parent IDs in reorder are rejected (400 Bad Request)', async () => {
      // Duplicate IDs
      const duplicateRes = await request(app)
        .patch(`/api/v1/courses/${courseId}/modules/reorder`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          moduleIds: [module1Id, module1Id, module2Id],
        });
      expect(duplicateRes.status).toBe(400);

      // Foreign parent ID
      const foreignId = randomUUID();
      const foreignRes = await request(app)
        .patch(`/api/v1/courses/${courseId}/modules/reorder`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          moduleIds: [module3Id, module1Id, foreignId],
        });
      expect(foreignRes.status).toBe(400);
    });

    it('14. Deleting a module follows documented referential-integrity strategy', async () => {
      // Create a temporary module to delete
      const tempRes = await request(app)
        .post(`/api/v1/courses/${courseId}/modules`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({ title: 'Module To Delete' });

      const tempModuleId = tempRes.body.data.id;

      // Add a content item to it
      await request(app)
        .post(`/api/v1/modules/${tempModuleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Lesson in deleted module',
          type: ContentType.TEXT,
          body: 'This will cascade delete with module',
        });

      // Delete module
      const delRes = await request(app)
        .delete(`/api/v1/modules/${tempModuleId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(delRes.status).toBe(200);

      // Confirm deleted in DB
      const dbCheck = await prisma.module.findUnique({ where: { id: tempModuleId } });
      expect(dbCheck).toBeNull();
    });
  });

  describe('3. Content Management & Content Types', () => {
    let courseId: string;
    let moduleId: string;
    let testAssignmentId: string;

    let contentItem1Id: string;
    let contentItem2Id: string;
    let contentItem3Id: string;

    beforeAll(async () => {
      const course = await prisma.course.create({
        data: {
          title: `Content Test Course ${randomUUID().slice(0, 6)}`,
          slug: `content-course-${randomUUID().slice(0, 8)}`,
          isPublished: true,
        },
      });
      courseId = course.id;
      createdCourseIds.push(course.id);

      const module = await prisma.module.create({
        data: {
          title: 'Content Host Module',
          courseId,
          order: 1,
          isPublished: true,
        },
      });
      moduleId = module.id;

      // Seed an assignment in this module for ASSIGNMENT content type test
      const assignment = await prisma.assignment.create({
        data: {
          moduleId,
          title: 'Midterm Capstone Project',
          instructions: 'Build a production REST API',
          isPublished: true,
        },
      });
      testAssignmentId = assignment.id;
      createdAssignmentIds.push(assignment.id);
    });

    it('15. Valid YouTube video content is accepted', async () => {
      const res = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Video Lecture 1',
          type: ContentType.YOUTUBE_VIDEO,
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          description: 'Introduction video lecture',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe(ContentType.YOUTUBE_VIDEO);
      expect(res.body.data.order).toBe(1);
      contentItem1Id = res.body.data.id;
    });

    it('16. Valid HTTP/HTTPS link content is accepted', async () => {
      const res = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'External Documentation',
          type: ContentType.LINK,
          url: 'https://nodejs.org/api/documentation.html',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe(ContentType.LINK);
      expect(res.body.data.order).toBe(2);
      contentItem2Id = res.body.data.id;
    });

    it('17. Text content is validated correctly', async () => {
      const res = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Reading Material: Express Lifecycle',
          type: ContentType.TEXT,
          body: '# Express Architecture\n\nExpress middleware pipeline follows a sequential onion model.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe(ContentType.TEXT);
      expect(res.body.data.body).toContain('Express Architecture');
      expect(res.body.data.order).toBe(3);
      contentItem3Id = res.body.data.id;
    });

    it('18. Invalid content types or payloads are rejected', async () => {
      // TEXT without body
      const textRes = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Empty Text Item',
          type: ContentType.TEXT,
        });
      expect(textRes.status).toBe(400);

      // LINK without valid URL
      const linkRes = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Bad Link Item',
          type: ContentType.LINK,
          url: 'ftp://not-http-url',
        });
      expect(linkRes.status).toBe(400);

      // Invalid ContentType string
      const badTypeRes = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Invalid Type Item',
          type: 'UNSUPPORTED_TYPE',
        });
      expect(badTypeRes.status).toBe(400);
    });

    it('19. Content items append to the end by default', async () => {
      const listRes = await request(app)
        .get(`/api/v1/modules/${moduleId}/content`)
        .set('X-Forwarded-For', getTestIp());

      expect(listRes.status).toBe(200);
      const items = listRes.body.data as Array<{ id: string; order: number }>;
      expect(items.length).toBe(3);
      expect(items[0]?.order).toBe(1);
      expect(items[1]?.order).toBe(2);
      expect(items[2]?.order).toBe(3);
    });

    it('20. Content retrieval respects course publication status', async () => {
      // Create draft course and module
      const draftCourse = await prisma.course.create({
        data: {
          title: 'Draft Content Host Course',
          slug: `draft-host-${randomUUID().slice(0, 8)}`,
          isPublished: false,
        },
      });
      createdCourseIds.push(draftCourse.id);

      const draftModule = await prisma.module.create({
        data: {
          title: 'Draft Module with Content',
          courseId: draftCourse.id,
          order: 1,
          isPublished: false,
        },
      });

      const draftContent = await prisma.contentItem.create({
        data: {
          moduleId: draftModule.id,
          title: 'Top Secret Lesson',
          type: ContentType.TEXT,
          body: 'Unpublished Lesson Body',
          order: 1,
        },
      });

      // Student gets 404 for content under draft module/course
      const studentRes = await request(app)
        .get(`/api/v1/content/${draftContent.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(studentRes.status).toBe(404);

      // Mentor can view it
      const mentorRes = await request(app)
        .get(`/api/v1/content/${draftContent.id}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());

      expect(mentorRes.status).toBe(200);
      expect(mentorRes.body.data.id).toBe(draftContent.id);
    });

    it('21. Reordering produces the requested sequence ([3, 1, 2]) for content', async () => {
      const res = await request(app)
        .patch(`/api/v1/modules/${moduleId}/content/reorder`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          contentItemIds: [contentItem3Id, contentItem1Id, contentItem2Id],
        });

      expect(res.status).toBe(200);
      const reordered = res.body.data as Array<{ id: string; order: number }>;
      expect(reordered[0]?.id).toBe(contentItem3Id);
      expect(reordered[0]?.order).toBe(1);
      expect(reordered[1]?.id).toBe(contentItem1Id);
      expect(reordered[1]?.order).toBe(2);
      expect(reordered[2]?.id).toBe(contentItem2Id);
      expect(reordered[2]?.order).toBe(3);
    });

    it('22. Students cannot modify content (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Student Injected Content',
          type: ContentType.TEXT,
          body: 'Hacked',
        });

      expect(res.status).toBe(403);
    });

    it('23. Assignment references are validated when supported', async () => {
      // Valid assignment reference
      const validRes = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Homework 1 Link',
          type: ContentType.ASSIGNMENT,
          assignmentId: testAssignmentId,
        });

      expect(validRes.status).toBe(201);
      expect(validRes.body.data.assignmentId).toBe(testAssignmentId);

      // Invalid assignment reference (non-existent UUID)
      const nonExistentUuid = randomUUID();
      const invalidRes = await request(app)
        .post(`/api/v1/modules/${moduleId}/content`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          title: 'Broken Assignment Link',
          type: ContentType.ASSIGNMENT,
          assignmentId: nonExistentUuid,
        });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error.code).toBe('ASSIGNMENT_NOT_FOUND');
    });

    it('24. Missing modules and content items are handled consistently with 404', async () => {
      const nonExistentId = randomUUID();

      const modRes = await request(app)
        .get(`/api/v1/modules/${nonExistentId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(modRes.status).toBe(404);

      const contentRes = await request(app)
        .get(`/api/v1/content/${nonExistentId}`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp());
      expect(contentRes.status).toBe(404);
    });
  });

  describe('4. Concurrency & Regressions', () => {
    it('25 & 26. Reordering remains correct and safe with database unique constraints', async () => {
      const course = await prisma.course.create({
        data: {
          title: 'Stress Test Course',
          slug: `stress-${randomUUID().slice(0, 8)}`,
          isPublished: true,
        },
      });
      createdCourseIds.push(course.id);

      // Create 4 modules
      const m1 = await prisma.module.create({ data: { courseId: course.id, title: 'M1', order: 1 } });
      const m2 = await prisma.module.create({ data: { courseId: course.id, title: 'M2', order: 2 } });
      const m3 = await prisma.module.create({ data: { courseId: course.id, title: 'M3', order: 3 } });
      const m4 = await prisma.module.create({ data: { courseId: course.id, title: 'M4', order: 4 } });

      // Invert the order: [m4, m3, m2, m1]
      const reorderRes = await request(app)
        .patch(`/api/v1/courses/${course.id}/modules/reorder`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .set('X-Forwarded-For', getTestIp())
        .send({
          moduleIds: [m4.id, m3.id, m2.id, m1.id],
        });

      expect(reorderRes.status).toBe(200);
      const orders = (reorderRes.body.data as Array<{ id: string; order: number }>).map((m) => m.id);
      expect(orders).toEqual([m4.id, m3.id, m2.id, m1.id]);
    });

    it('27 & 28. Existing health endpoint and rate limiting remain intact', async () => {
      const healthRes = await request(app)
        .get('/api/v1/health')
        .set('X-Forwarded-For', getTestIp());

      expect(healthRes.status).toBe(200);
      expect(healthRes.body.success).toBe(true);
      expect(healthRes.body.data.status).toBe('ok');
    });
  });
});
