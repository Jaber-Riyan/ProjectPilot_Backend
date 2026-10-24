import { Request, Response } from 'express';
import { moduleService, ModuleService } from './modules.service';
import { ApiResponseSuccess } from '../../errors/app-error';
import { Module } from '../../models';
import { ModuleQuerySchemaInput } from './modules.schema';
import { PaginatedModules, ModuleDetailWithContent } from './modules.types';

export class ModuleController {
  private service: ModuleService;

  constructor(service: ModuleService = moduleService) {
    this.service = service;
  }

  createIndependent = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.createIndependentModule(req.body, req.user);
    const response: ApiResponseSuccess<Module> = {
      success: true,
      data: result,
    };
    res.status(201).json(response);
  };

  listIndependent = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listIndependentModules(
      req.query as unknown as ModuleQuerySchemaInput,
      req.user
    );
    const response: ApiResponseSuccess<PaginatedModules> = {
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
    const result = await this.service.updateModule(moduleId, req.body, req.user);
    const response: ApiResponseSuccess<Module> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  deleteIndependent = async (req: Request, res: Response): Promise<void> => {
    const moduleId = req.params.moduleId as string;
    const result = await this.service.deleteModule(moduleId, req.user);
    const response: ApiResponseSuccess<{ id: string; message: string }> = {
      success: true,
      data: {
        id: result.id,
        message: 'Module deleted successfully',
      },
    };
    res.status(200).json(response);
  };

  attachOrAdd = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.attachOrAddModuleToCourse(courseId, req.body, req.user);
    const response: ApiResponseSuccess<ModuleDetailWithContent> = {
      success: true,
      data: result,
    };
    res.status(201).json(response);
  };

  listByCourse = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.getModulesByCourse(courseId, req.user);
    const response: ApiResponseSuccess<ModuleDetailWithContent[]> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  detach = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const moduleId = req.params.moduleId as string;
    const result = await this.service.detachModuleFromCourse(courseId, moduleId, req.user);
    const response: ApiResponseSuccess<{ message: string; courseId: string; moduleId: string }> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  reorder = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.reorderModules(courseId, req.body.moduleIds, req.user);
    const response: ApiResponseSuccess<ModuleDetailWithContent[]> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };
}

export const moduleController = new ModuleController();
