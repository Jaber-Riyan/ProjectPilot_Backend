import { Course, Module, ContentItem } from '../../models';
import { PaginatedResult } from '../../repositories/repository.types';

export interface CreateCourseInput {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  isPublished?: boolean;
  slug?: string;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  isPublished?: boolean;
  slug?: string;
}

export interface CourseQueryFilters {
  page?: number;
  limit?: number;
  isPublished?: boolean;
}

export interface CourseWithModuleCount extends Course {
  _count: {
    modules: number;
    courseModules?: number;
  };
}

export interface ModuleWithContent extends Module {
  order?: number;
  courseModuleId?: string;
  contentItems: ContentItem[];
}

export interface CourseDetailWithModules extends Course {
  modules: ModuleWithContent[];
}

export type PaginatedCourses = PaginatedResult<CourseWithModuleCount>;
