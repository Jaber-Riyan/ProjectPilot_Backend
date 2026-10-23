import { Module, ContentItem } from '../../models';

export interface CreateModuleInput {
  title: string;
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

export interface ModuleDetailWithContent extends Module {
  contentItems: ContentItem[];
}
