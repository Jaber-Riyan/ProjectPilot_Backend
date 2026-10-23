import { Request, Response } from 'express';
import { moduleService, ModuleService } from './modules.service';
import { ApiResponseSuccess } from '../../errors/app-error';
import { Module } from '../../models';

export class ModuleController {
  private service: ModuleService;

  constructor(service: ModuleService = moduleService) {
    this.service = service;
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.createModule(courseId, req.body);
    const response: ApiResponseSuccess<Module> = {
      success: true,
      data: result,
    };
    res.status(201).json(response);
  };

  listByCourse = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.getModulesByCourse(courseId, req.user);
    const response: ApiResponseSuccess<Module[]> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getDetail = async (req: Request, res: Response): Promise<void> => {
    const moduleId = req.params.moduleId as string;
    const result = await this.service.getModuleDetail(moduleId, req.user);
    const response: ApiResponseSuccess<unknown> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const moduleId = req.params.moduleId as string;
    const result = await this.service.updateModule(moduleId, req.body);
    const response: ApiResponseSuccess<Module> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const moduleId = req.params.moduleId as string;
    const result = await this.service.deleteModule(moduleId);
    const response: ApiResponseSuccess<{ id: string; message: string }> = {
      success: true,
      data: {
        id: result.id,
        message: 'Module deleted successfully',
      },
    };
    res.status(200).json(response);
  };

  reorder = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.reorderModules(courseId, req.body.moduleIds);
    const response: ApiResponseSuccess<Module[]> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };
}

export const moduleController = new ModuleController();
