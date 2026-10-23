import { Request, Response } from 'express';
import { courseService, CourseService } from './courses.service';
import { ApiResponseSuccess } from '../../errors/app-error';
import { Course } from '../../models';
import { CourseDetailWithModules, PaginatedCourses } from './courses.types';
import { CourseQuerySchemaInput } from './courses.schema';

export class CourseController {
  private service: CourseService;

  constructor(service: CourseService = courseService) {
    this.service = service;
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listCourses(
      req.query as unknown as CourseQuerySchemaInput,
      req.user
    );
    const response: ApiResponseSuccess<PaginatedCourses> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  getDetail = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.getCourseDetail(courseId, req.user);
    const response: ApiResponseSuccess<CourseDetailWithModules> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.createCourse(req.body);
    const response: ApiResponseSuccess<Course> = {
      success: true,
      data: result,
    };
    res.status(201).json(response);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.updateCourse(courseId, req.body);
    const response: ApiResponseSuccess<Course> = {
      success: true,
      data: result,
    };
    res.status(200).json(response);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const courseId = req.params.courseId as string;
    const result = await this.service.deleteCourse(courseId);
    const response: ApiResponseSuccess<{ id: string; message: string }> = {
      success: true,
      data: {
        id: result.id,
        message: 'Course deleted successfully',
      },
    };
    res.status(200).json(response);
  };
}

export const courseController = new CourseController();
