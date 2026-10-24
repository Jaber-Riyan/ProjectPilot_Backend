import { PrismaClient, ContentItem, Prisma } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';

export class ContentRepository {
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

  async findById(id: string): Promise<ContentItem | null> {
    return this.client.contentItem.findUnique({
      where: { id },
    });
  }

  async findDetail(id: string) {
    return this.client.contentItem.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            courseModules: {
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                    isPublished: true,
                  },
                },
              },
            },
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            isPublished: true,
          },
        },
      },
    });
  }

  async findByModuleId(moduleId: string): Promise<ContentItem[]> {
    return this.client.contentItem.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            isPublished: true,
          },
        },
      },
    });
  }

  async getMaxOrder(moduleId: string): Promise<number> {
    const agg = await this.client.contentItem.aggregate({
      where: { moduleId },
      _max: { order: true },
    });
    return agg._max.order ?? 0;
  }

  async create(data: Prisma.ContentItemCreateInput): Promise<ContentItem> {
    return this.client.contentItem.create({ data });
  }

  async update(id: string, data: Prisma.ContentItemUpdateInput): Promise<ContentItem> {
    return this.client.contentItem.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<ContentItem> {
    return this.client.contentItem.delete({
      where: { id },
    });
  }

  /**
   * Reorders content items safely within a parent module using a two-phase transaction
   * to guarantee no unique constraint collisions on (moduleId, order).
   */
  async reorder(moduleId: string, contentItemIds: string[]): Promise<ContentItem[]> {
    return this.client.$transaction(async (tx) => {
      // 1. Phase 1: Set temporary negative orders to avoid @@unique([moduleId, order]) collisions
      for (let i = 0; i < contentItemIds.length; i++) {
        const id = contentItemIds[i];
        if (!id) continue;
        await tx.contentItem.update({
          where: { id },
          data: { order: -(i + 1000) },
        });
      }

      // 2. Phase 2: Set final sequential positive 1-based orders
      for (let i = 0; i < contentItemIds.length; i++) {
        const id = contentItemIds[i];
        if (!id) continue;
        await tx.contentItem.update({
          where: { id },
          data: { order: i + 1 },
        });
      }

      // 3. Return final ordered content items
      return tx.contentItem.findMany({
        where: { moduleId },
        orderBy: { order: 'asc' },
      });
    });
  }
}

export const contentRepository = new ContentRepository();
