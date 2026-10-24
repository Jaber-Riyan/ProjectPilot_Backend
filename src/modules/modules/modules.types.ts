import { Module, ContentItem } from '../../models';
import { PaginatedResult } from '../../repositories/repository.types';

export interface CreateModuleInput {
  title: string;
  description?: string | null;
  isPublished?: boolean;
}

export interface AttachOrAddModuleInput {
  moduleId?: string;
  title?: string;
  description?: string | null;
  isPublished?: boolean;
  order?: number;
}

export interface UpdateModuleInput {
  title?: string;
  description?: string | null;
  isPublished?: boolean;
}

export interface ReorderModulesInput {
  moduleIds: string[];
}

export interface CourseModuleInfo {
  id: string;
  courseId: string;
  moduleId: string;
  order: number;
  course: {
    id: string;
    title: string;
    isPublished: boolean;
  };
}

export interface ModuleDetailWithContent extends Module {
  order?: number;
  courseModuleId?: string;
  contentItems: ContentItem[];
  courseModules?: CourseModuleInfo[];
}

export interface ModuleWithCount extends Module {
  _count: {
    contentItems: number;
    courseModules: number;
  };
}

export type PaginatedModules = PaginatedResult<ModuleWithCount>;
