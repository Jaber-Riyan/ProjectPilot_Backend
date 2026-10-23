import { ContentItem, ContentType } from '../../models';

export interface CreateContentItemInput {
  title: string;
  type: ContentType;
  description?: string | null;
  body?: string | null;
  url?: string | null;
  assignmentId?: string | null;
  order?: number;
}

export interface UpdateContentItemInput {
  title?: string;
  type?: ContentType;
  description?: string | null;
  body?: string | null;
  url?: string | null;
  assignmentId?: string | null;
}

export interface ReorderContentItemsInput {
  contentItemIds?: string[];
  contentIds?: string[];
}

export type ContentItemDetail = ContentItem;
