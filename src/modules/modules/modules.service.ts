import { Module, Role } from '../../models';
import { AppError } from '../../errors/app-error';
import { AuthenticatedUser } from '../../types/express';
import { courseRepository, CourseRepository } from '../courses/courses.repository';
import { moduleRepository, ModuleRepository } from './modules.repository';
import { CreateModuleInput, UpdateModuleInput } from './modules.types';
import { Prisma } from '../../generated/prisma/client';

export class ModuleService {
  private repository: ModuleRepository;
  private courseRepo: CourseRepository;

  constructor(
    repository: ModuleRepository = moduleRepository,
    courseRepo: CourseRepository = courseRepository
  ) {
    this.repository = repository;
    this.courseRepo = courseRepo;
  }

  async createModule(courseId: string, input: CreateModuleInput): Promise<Module> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    let order = input.order;
    if (order === undefined || order === null) {
      const maxOrder = await this.repository.getMaxOrder(courseId);
      order = maxOrder + 1;
    }

    return this.repository.create({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      order,
      isPublished: input.isPublished ?? false,
      course: {
        connect: { id: courseId },
      },
    });
  }

  async getModulesByCourse(courseId: string, user?: AuthenticatedUser): Promise<Module[]> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    if (!course.isPublished && !isMentorOrAdmin) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    return this.repository.findByCourseId(courseId, !isMentorOrAdmin);
  }

  async getModuleDetail(moduleId: string, user?: AuthenticatedUser) {
    const module = await this.repository.findDetail(moduleId);
    if (!module) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    if ((!module.isPublished || !module.course.isPublished) && !isMentorOrAdmin) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    return module;
  }

  async updateModule(moduleId: string, input: UpdateModuleInput): Promise<Module> {
    const existing = await this.repository.findById(moduleId);
    if (!existing) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    const data: Prisma.ModuleUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title.trim();
    }
    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }
    if (input.isPublished !== undefined) {
      data.isPublished = input.isPublished;
    }

    return this.repository.update(moduleId, data);
  }

  async deleteModule(moduleId: string): Promise<Module> {
    const existing = await this.repository.findById(moduleId);
    if (!existing) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    return this.repository.delete(moduleId);
  }

  async reorderModules(courseId: string, moduleIds: string[]): Promise<Module[]> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    const existingModules = await this.repository.findByCourseId(courseId);
    const existingIds = new Set(existingModules.map((m) => m.id));

    if (moduleIds.length !== existingModules.length) {
      throw AppError.badRequest(
        `Reorder list must contain all ${existingModules.length} module IDs belonging to this course`,
        'INVALID_REORDER_LIST'
      );
    }

    for (const id of moduleIds) {
      if (!existingIds.has(id)) {
        throw AppError.badRequest(
          `Module ID ${id} does not belong to course ${courseId}`,
          'INVALID_REORDER_LIST'
        );
      }
    }

    return this.repository.reorder(courseId, moduleIds);
  }
}

export const moduleService = new ModuleService();
