import { Request, Response } from 'express';
import { reviewService, ReviewService } from './reviews.service';
import { ApiResponseSuccess, AppError } from '../../errors/app-error';
import { ReviewQueueQuerySchemaInput } from './reviews.schema';
import { PaginatedReviewQueue, ReviewSubmissionDetail } from './reviews.types';

export class ReviewController {
  private service: ReviewService;

  constructor(service: ReviewService = reviewService) {
    this.service = service;
  }

  getReviewQueue = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const result = await this.service.getReviewQueue(
      req.query as unknown as ReviewQueueQuerySchemaInput,
      req.user
    );
    const response: ApiResponseSuccess<PaginatedReviewQueue> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getSubmissionDetailForReview = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const submissionId = req.params.submissionId as string;
    const result = await this.service.getSubmissionDetailForReview(submissionId, req.user);
    const response: ApiResponseSuccess<ReviewSubmissionDetail> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  createReview = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const submissionId = req.params.submissionId as string;
    const result = await this.service.createReview(submissionId, req.body, req.user);
    const response: ApiResponseSuccess<ReviewSubmissionDetail> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  updateReview = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'UNAUTHORIZED');
    }

    const submissionId = req.params.submissionId as string;
    const result = await this.service.updateReview(submissionId, req.body, req.user);
    const response: ApiResponseSuccess<ReviewSubmissionDetail> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };
}

export const reviewController = new ReviewController();
