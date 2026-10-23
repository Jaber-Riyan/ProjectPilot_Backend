import { ContentItem, Role } from '../../models';
import { AppError } from '../../errors/app-error';
import { AuthenticatedUser } from '../../types/express';
import { getPrismaClient } from '../../db/prisma';
import { moduleRepository, ModuleRepository } from '../modules/modules.repository';
import { contentRepository, ContentRepository } from './content.repository';
import { CreateContentItemInput, UpdateContentItemInput } from './content.types';
import { Prisma } from '../../generated/prisma/client';

export class ContentService {
  private repository: ContentRepository;
  private moduleRepo: ModuleRepository;

  constructor(
    repository: ContentRepository = contentRepository,
    moduleRepo: ModuleRepository = moduleRepository
  ) {
    this.repository = repository;
    this.moduleRepo = moduleRepo;
  }

  async createContentItem(
    moduleId: string,
    input: CreateContentItemInput
  ): Promise<ContentItem> {
    const module = await this.moduleRepo.findById(moduleId);
    if (!module) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    if (input.assignmentId) {
      const prisma = getPrismaClient();
      const assignment = await prisma.assignment.findUnique({
        where: { id: input.assignmentId },
      });
      if (!assignment) {
        throw AppError.badRequest(
          `Referenced assignment ${input.assignmentId} does not exist`,
          'ASSIGNMENT_NOT_FOUND'
        );
      }
    }

    let order = input.order;
    if (order === undefined || order === null) {
      const maxOrder = await this.repository.getMaxOrder(moduleId);
      order = maxOrder + 1;
    }

    return this.repository.create({
      title: input.title.trim(),
      type: input.type,
      description: input.description?.trim() || null,
      body: input.body?.trim() || null,
      url: input.url?.trim() || null,
      order,
      module: {
        connect: { id: moduleId },
      },
      ...(input.assignmentId ? { assignment: { connect: { id: input.assignmentId } } } : {}),
    });
  }

  async getContentItemsByModule(
    moduleId: string,
    user?: AuthenticatedUser
  ): Promise<ContentItem[]> {
    const module = await this.moduleRepo.findDetail(moduleId);
    if (!module) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    if ((!module.isPublished || !module.course.isPublished) && !isMentorOrAdmin) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    return this.repository.findByModuleId(moduleId);
  }

  async getContentItemDetail(contentId: string, user?: AuthenticatedUser) {
    const item = await this.repository.findDetail(contentId);
    if (!item) {
      throw AppError.notFound('Content item not found', 'CONTENT_ITEM_NOT_FOUND');
    }

    const isMentorOrAdmin = user?.role === Role.MENTOR || user?.role === Role.ADMIN;
    if (
      (!item.module.isPublished || !item.module.course.isPublished) &&
      !isMentorOrAdmin
    ) {
      throw AppError.notFound('Content item not found', 'CONTENT_ITEM_NOT_FOUND');
    }

    return item;
  }

  async updateContentItem(
    contentId: string,
    input: UpdateContentItemInput
  ): Promise<ContentItem> {
    const existing = await this.repository.findById(contentId);
    if (!existing) {
      throw AppError.notFound('Content item not found', 'CONTENT_ITEM_NOT_FOUND');
    }

    if (input.assignmentId) {
      const prisma = getPrismaClient();
      const assignment = await prisma.assignment.findUnique({
        where: { id: input.assignmentId },
      });
      if (!assignment) {
        throw AppError.badRequest(
          `Referenced assignment ${input.assignmentId} does not exist`,
          'ASSIGNMENT_NOT_FOUND'
        );
      }
    }

    const data: Prisma.ContentItemUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title.trim();
    }
    if (input.type !== undefined) {
      data.type = input.type;
    }
    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }
    if (input.body !== undefined) {
      data.body = input.body?.trim() || null;
    }
    if (input.url !== undefined) {
      data.url = input.url?.trim() || null;
    }
    if (input.assignmentId !== undefined) {
      if (input.assignmentId === null) {
        data.assignment = { disconnect: true };
      } else {
        data.assignment = { connect: { id: input.assignmentId } };
      }
    }

    return this.repository.update(contentId, data);
  }

  async deleteContentItem(contentId: string): Promise<ContentItem> {
    const existing = await this.repository.findById(contentId);
    if (!existing) {
      throw AppError.notFound('Content item not found', 'CONTENT_ITEM_NOT_FOUND');
    }

    return this.repository.delete(contentId);
  }

  async reorderContentItems(moduleId: string, inputIds: string[]): Promise<ContentItem[]> {
    const module = await this.moduleRepo.findById(moduleId);
    if (!module) {
      throw AppError.notFound('Module not found', 'MODULE_NOT_FOUND');
    }

    const existingItems = await this.repository.findByModuleId(moduleId);
    const existingIds = new Set(existingItems.map((item) => item.id));

    if (inputIds.length !== existingItems.length) {
      throw AppError.badRequest(
        `Reorder list must contain all ${existingItems.length} content item IDs belonging to this module`,
        'INVALID_REORDER_LIST'
      );
    }

    for (const id of inputIds) {
      if (!existingIds.has(id)) {
        throw AppError.badRequest(
          `Content item ID ${id} does not belong to module ${moduleId}`,
          'INVALID_REORDER_LIST'
        );
      }
    }

    return this.repository.reorder(moduleId, inputIds);
  }
}

export const contentService = new ContentService();
