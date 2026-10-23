export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationCalculation {
  page: number;
  limit: number;
  skip: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function calculatePagination(
  params: PaginationParams,
  totalItems: number,
  defaultLimit = 20,
  maxLimit = 100
): PaginationCalculation {
  const page = Math.max(1, Number(params.page) || 1);
  const rawLimit = Number(params.limit) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);

  const skip = (page - 1) * limit;
  const totalPages = Math.ceil(Math.max(0, totalItems) / limit);

  return {
    page,
    limit,
    skip,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
