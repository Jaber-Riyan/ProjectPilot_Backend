import { Request, Response } from 'express';
import { assignmentService, AssignmentService } from './assignments.service';
import { ApiResponseSuccess } from '../../errors/app-error';
import { Assignment } from '../../models';
import { AssignmentQuerySchemaInput } from './assignments.schema';
import { PaginatedAssignments, AssignmentDetail } from './assignments.types';

export class AssignmentController {
  private service: AssignmentService;

  constructor(service: AssignmentService = assignmentService) {
    this.service = service;
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.createAssignment(req.body, req.user);
    const response: ApiResponseSuccess<Assignment> = {
      success: true,
      data: result,
    };
    res.status(201).json(response);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listAssignments(
      req.query as unknown as AssignmentQuerySchemaInput,
      req.user
    );
    const response: ApiResponseSuccess<PaginatedAssignments> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getDetail = async (req: Request, res: Response): Promise<void> => {
    const assignmentId = req.params.assignmentId as string;
    const result = await this.service.getAssignmentDetail(assignmentId, req.user);
    const response: ApiResponseSuccess<AssignmentDetail> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const assignmentId = req.params.assignmentId as string;
    const result = await this.service.updateAssignment(assignmentId, req.body, req.user);
    const response: ApiResponseSuccess<Assignment> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const assignmentId = req.params.assignmentId as string;
    const result = await this.service.deleteAssignment(assignmentId, req.user);
    const response: ApiResponseSuccess<{ id: string; message: string }> = {
      success: true,
      data: {
        id: result.id,
        message: 'Assignment deleted successfully',
      },
    };
    res.status(200).json(response);
  };
}

export const assignmentController = new AssignmentController();
