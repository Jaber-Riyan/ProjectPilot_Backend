import { Module, Role } from '../../models';
import { AppError } from '../../errors/app-error';
import { AuthenticatedUser } from '../../types/express';
import { courseRepository, CourseRepository } from '../courses/courses.repository';
import { moduleRepository, ModuleRepository } from './modules.repository';
import {
  CreateModuleInput,
  AttachOrAddModuleInput,
  UpdateModuleInput,
  PaginatedModules,
  ModuleDetailWithContent,
} from './modules.types';
import { ModuleQuerySchemaInput } from './modules.schema';
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

  async createIndependentModule(
    input: CreateModuleInput,
    user?: AuthenticatedUser
  ): Promise<Module> {
    return this.repository.create({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      isPublished: input.isPublished ?? false,
      ...(user?.id ? { createdBy: { connect: { id: user.id } } } : {}),
    });
  }

  async listIndependentModules(
    query: ModuleQuerySchemaInput,
    user?: AuthenticatedUser
  ): Promise<PaginatedModules> {
    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    const where: Prisma.ModuleWhereInput = {};

    if (!isMentorOrAdmin) {
      where.isPublished = true;
    } else if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }

    return this.repository.findMany(where, query.page, query.limit);
  }

  async getModuleDetail(moduleId: string, user?: AuthenticatedUser) {
    const module = await this.repository.findDetail(moduleId);
    if (!module) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    if (!module.isPublished && !isMentorOrAdmin) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    return module;
  }

  async updateModule(
    moduleId: string,
    input: UpdateModuleInput,
    user?: AuthenticatedUser
  ): Promise<Module> {
    const existing = await this.repository.findById(moduleId);
    if (!existing) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    if (
      existing.createdById &&
      user &&
      user.role === Role.MENTOR &&
      existing.createdById !== user.id
    ) {
      throw AppError.forbidden('You do not have permission to modify this module', 'FORBIDDEN');
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

  async deleteModule(moduleId: string, user?: AuthenticatedUser): Promise<Module> {
    const existing = await this.repository.findById(moduleId);
    if (!existing) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    if (
      existing.createdById &&
      user &&
      user.role === Role.MENTOR &&
      existing.createdById !== user.id
    ) {
      throw AppError.forbidden('You do not have permission to delete this module', 'FORBIDDEN');
    }

    const attachedCount = await this.repository.countCourseModules(moduleId);
    if (attachedCount > 0) {
      throw AppError.conflict(
        'Cannot delete module that is currently attached to courses. Detach it first.',
        'MODULE_ATTACHED_TO_COURSE'
      );
    }

    return this.repository.delete(moduleId);
  }

  async attachOrAddModuleToCourse(
    courseId: string,
    input: AttachOrAddModuleInput,
    user?: AuthenticatedUser
  ): Promise<ModuleDetailWithContent> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    if (
      course.createdById &&
      user &&
      user.role === Role.MENTOR &&
      course.createdById !== user.id
    ) {
      throw AppError.forbidden('You do not have permission to modify this course', 'FORBIDDEN');
    }

    let targetModuleId: string;
    let targetModule: Module;

    if (input.moduleId) {
      const existing = await this.repository.findById(input.moduleId);
      if (!existing) {
        throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
      }

      const existingRelation = await this.repository.findCourseModule(courseId, input.moduleId);
      if (existingRelation) {
        throw AppError.conflict('Module is already attached to this course', 'MODULE_ALREADY_ATTACHED');
      }

      targetModuleId = input.moduleId;
      targetModule = existing;
    } else if (input.title) {
      targetModule = await this.createIndependentModule(
        {
          title: input.title,
          description: input.description,
          isPublished: input.isPublished ?? false,
        },
        user
      );
      targetModuleId = targetModule.id;
    } else {
      throw AppError.badRequest(
        'Either moduleId or title must be provided',
        'INVALID_REQUEST'
      );
    }

    let order = input.order;
    if (order === undefined || order === null) {
      const maxOrder = await this.repository.getMaxOrder(courseId);
      order = maxOrder + 1;
    }

    const courseModule = await this.repository.attachToCourse(courseId, targetModuleId, order);

    const fullDetail = await this.repository.findDetail(targetModuleId);

    return {
      ...(fullDetail ?? targetModule),
      order: courseModule.order,
      courseModuleId: courseModule.id,
      contentItems: fullDetail?.contentItems ?? [],
    };
  }

  async getModulesByCourse(
    courseId: string,
    user?: AuthenticatedUser
  ): Promise<ModuleDetailWithContent[]> {
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

  async detachModuleFromCourse(
    courseId: string,
    moduleId: string,
    user?: AuthenticatedUser
  ): Promise<{ message: string; courseId: string; moduleId: string }> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    if (
      course.createdById &&
      user &&
      user.role === Role.MENTOR &&
      course.createdById !== user.id
    ) {
      throw AppError.forbidden('You do not have permission to modify this course', 'FORBIDDEN');
    }

    const relation = await this.repository.findCourseModule(courseId, moduleId);
    if (!relation) {
      throw AppError.notFound('Module is not attached to this course', 'MODULE_NOT_ATTACHED');
    }

    await this.repository.detachFromCourse(courseId, moduleId);

    return {
      message: 'Module detached from course successfully',
      courseId,
      moduleId,
    };
  }

  async reorderModules(
    courseId: string,
    moduleIds: string[],
    user?: AuthenticatedUser
  ): Promise<ModuleDetailWithContent[]> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    if (
      course.createdById &&
      user &&
      user.role === Role.MENTOR &&
      course.createdById !== user.id
    ) {
      throw AppError.forbidden('You do not have permission to modify this course', 'FORBIDDEN');
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
          `Module ID ${id} is not attached to course ${courseId}`,
          'INVALID_REORDER_LIST'
        );
      }
    }

    return this.repository.reorder(courseId, moduleIds);
  }
}

export const moduleService = new ModuleService();
