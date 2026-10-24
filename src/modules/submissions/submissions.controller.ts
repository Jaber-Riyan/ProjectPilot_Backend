import { Request, Response } from 'express';
import { submissionService, SubmissionService } from './submissions.service';
import { ApiResponseSuccess, AppError } from '../../errors/app-error';
import { SubmissionQuerySchemaInput } from './submissions.schema';
import { PaginatedSubmissions, SubmissionDetail } from './submissions.types';

export class SubmissionController {
  private service: SubmissionService;

  constructor(service: SubmissionService = submissionService) {
    this.service = service;
  }

  submit = async (req: Request, res: Response): Promise<void> => {
    const assignmentId = req.params.assignmentId as string;
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const result = await this.service.submitAssignment(assignmentId, req.user.id, req.body);
    const response: ApiResponseSuccess<SubmissionDetail> = {
      success: true,
      data: result,
    };
    res.status(201).json(response);
  };

  getMyAttempts = async (req: Request, res: Response): Promise<void> => {
    const assignmentId = req.params.assignmentId as string;
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const result = await this.service.getMyAttempts(assignmentId, req.user.id);
    const response: ApiResponseSuccess<SubmissionDetail[]> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const assignmentId = req.params.assignmentId as string;
    const result = await this.service.listSubmissions(
      assignmentId,
      req.query as unknown as SubmissionQuerySchemaInput
    );
    const response: ApiResponseSuccess<PaginatedSubmissions> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getDetail = async (req: Request, res: Response): Promise<void> => {
    const submissionId = req.params.submissionId as string;
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const result = await this.service.getSubmissionDetail(submissionId, req.user);
    const response: ApiResponseSuccess<SubmissionDetail> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };
}

export const submissionController = new SubmissionController();
