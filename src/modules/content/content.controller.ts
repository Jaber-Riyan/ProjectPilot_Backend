import { Request, Response } from 'express';
import { contentService, ContentService } from './content.service';
import { ApiResponseSuccess } from '../../errors/app-error';
import { ContentItem } from '../../models';

export class ContentController {
  private service: ContentService;

  constructor(service: ContentService = contentService) {
    this.service = service;
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const moduleId = req.params.moduleId as string;
    const result = await this.service.createContentItem(moduleId, req.body);
    const response: ApiResponseSuccess<ContentItem> = {
      success: true,
      data: result,
    };
    res.status(201).json(response);
  };

  listByModule = async (req: Request, res: Response): Promise<void> => {
    const moduleId = req.params.moduleId as string;
    const result = await this.service.getContentItemsByModule(moduleId, req.user);
    const response: ApiResponseSuccess<ContentItem[]> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getDetail = async (req: Request, res: Response): Promise<void> => {
    const contentId = req.params.contentId as string;
    const result = await this.service.getContentItemDetail(contentId, req.user);
    const response: ApiResponseSuccess<unknown> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const contentId = req.params.contentId as string;
    const result = await this.service.updateContentItem(contentId, req.body);
    const response: ApiResponseSuccess<ContentItem> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const contentId = req.params.contentId as string;
    const result = await this.service.deleteContentItem(contentId);
    const response: ApiResponseSuccess<{ id: string; message: string }> = {
      success: true,
      data: {
        id: result.id,
        message: 'Content item deleted successfully',
      },
    };
    res.status(200).json(response);
  };

  reorder = async (req: Request, res: Response): Promise<void> => {
    const moduleId = req.params.moduleId as string;
    const ids: string[] = req.body.contentItemIds || req.body.contentIds;
    const result = await this.service.reorderContentItems(moduleId, ids);
    const response: ApiResponseSuccess<ContentItem[]> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };
}

export const contentController = new ContentController();
