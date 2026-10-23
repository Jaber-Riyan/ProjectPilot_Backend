/**
 * Source of truth for database domain entities and enums.
 * Re-exports the generated Prisma models directly without duplication.
 */
export type {
  User,
  Course,
  Module,
  ContentItem,
  Assignment,
  Submission,
  Feedback,
} from '../generated/prisma/client';

export {
  Role,
  ContentType,
  SubmissionPolicy,
  SubmissionStatus,
} from '../generated/prisma/enums';
