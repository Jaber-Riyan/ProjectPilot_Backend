import { Course, Role } from '../../models';
import { AppError } from '../../errors/app-error';
import { slugify } from '../../utils/slug';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../../types/express';
import { courseRepository, CourseRepository } from './courses.repository';
import {
  CreateCourseInput,
  UpdateCourseInput,
  CourseDetailWithModules,
  PaginatedCourses,
} from './courses.types';
import { CourseQuerySchemaInput } from './courses.schema';
import { Prisma } from '../../generated/prisma/client';

export class CourseService {
  private repository: CourseRepository;

  constructor(repository: CourseRepository = courseRepository) {
    this.repository = repository;
  }

  async listCourses(
    query: CourseQuerySchemaInput,
    user?: AuthenticatedUser
  ): Promise<PaginatedCourses> {
    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    const where: Prisma.CourseWhereInput = {};

    if (!isMentorOrAdmin) {
      // Students and public guests strictly only see published courses
      where.isPublished = true;
    } else {
      // Mentors and admins can filter by publication status or view all
      if (query.status === 'PUBLISHED' || query.isPublished === true) {
        where.isPublished = true;
      } else if (query.status === 'DRAFT' || query.isPublished === false) {
        where.isPublished = false;
      }
    }

    return this.repository.findMany(where, query.page, query.limit);
  }

  async getCourseDetail(
    idOrSlug: string,
    user?: AuthenticatedUser
  ): Promise<CourseDetailWithModules> {
    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    const course = await this.repository.findDetail(idOrSlug, isMentorOrAdmin);

    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    // Conceal draft courses from students
    if (!course.isPublished && !isMentorOrAdmin) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    return course;
  }

  async createCourse(input: CreateCourseInput): Promise<Course> {
    let baseSlug = input.slug ? slugify(input.slug) : slugify(input.title);
    if (!baseSlug) {
      baseSlug = `course-${randomUUID().slice(0, 8)}`;
    }

    let slug = baseSlug;
    if (await this.repository.slugExists(slug)) {
      slug = `${baseSlug}-${randomUUID().slice(0, 6)}`;
    }

    return this.repository.create({
      title: input.title.trim(),
      slug,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      isPublished: input.isPublished ?? false,
    });
  }

  async updateCourse(id: string, input: UpdateCourseInput): Promise<Course> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    const data: Prisma.CourseUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title.trim();
    }
    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }
    if (input.imageUrl !== undefined) {
      data.imageUrl = input.imageUrl?.trim() || null;
    }
    if (input.isPublished !== undefined) {
      data.isPublished = input.isPublished;
    }
    if (input.slug !== undefined) {
      const formattedSlug = slugify(input.slug);
      if (await this.repository.slugExists(formattedSlug, id)) {
        throw AppError.conflict('Course slug already exists', 'SLUG_ALREADY_EXISTS');
      }
      data.slug = formattedSlug;
    }

    return this.repository.update(id, data);
  }

  async deleteCourse(id: string): Promise<Course> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    return this.repository.delete(id);
  }
}

export const courseService = new CourseService();
