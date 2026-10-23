# Repositories (`src/repositories`)

This directory contains the database abstraction layer following the Repository pattern.

---

## Architecture Guidelines

### 1. `BaseRepository`
`BaseRepository` provides generic, type-safe CRUD operations:
- `findById(id: string)`
- `findUnique(where: TWhereUniqueInput)`
- `findMany(options: FindManyOptions)` with automated pagination
- `create(data: TCreateInput)`
- `update(where: TWhereUniqueInput, data: TUpdateInput)`
- `delete(where: TWhereUniqueInput)`
- `count(where: TWhereInput)`
- `exists(where: TWhereUniqueInput)`

### 2. Feature-Specific Repositories
Feature repositories encapsulate all domain-specific queries and database operations. They can either extend `BaseRepository` or use the Prisma client directly when customized aggregations or multi-table joins are needed.

Examples of future feature repositories (placed inside their respective feature modules, e.g. `src/modules/users/user.repository.ts` or `src/modules/submissions/submission.repository.ts`):

- **`user.repository.ts`**:
  - `findByEmail(email: string)`
  - `listMentors(pagination: PaginationOptions)`
- **`course.repository.ts`**:
  - `findBySlugWithModules(slug: string)`
  - `listPublishedCourses(pagination: PaginationOptions)`
- **`submission.repository.ts`**:
  - `findStudentHistory(studentId: string, assignmentId: string)`
  - `listMentorReviewQueue(mentorId: string, status: SubmissionStatus, pagination: PaginationOptions)`
  - `getNextAttemptNumber(assignmentId: string, studentId: string): Promise<number>`
- **`feedback.repository.ts`**:
  - `findBySubmissionId(submissionId: string)`

### 3. Transactions
When multiple queries must run atomically, pass `Prisma.TransactionClient` into the repository method or coordinate using `prisma.$transaction`:

```typescript
await prisma.$transaction(async (tx) => {
  const submissionRepo = new SubmissionRepository(tx.submission);
  const feedbackRepo = new FeedbackRepository(tx.feedback);

  await submissionRepo.updateStatus(submissionId, 'APPROVED');
  await feedbackRepo.createFeedback({ submissionId, mentorId, comment });
});
```

### 4. What NOT to put in `BaseRepository`
- Specialized domain joins, include trees, and custom aggregations.
- Business rule validation (e.g. `submissionPolicy` checks belong in services).
- Express `req` / `res` objects (repositories must be purely database-focused).
