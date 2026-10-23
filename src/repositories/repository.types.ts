import { Prisma } from '../generated/prisma/client';

export type PrismaTransactionClient = Prisma.TransactionClient;

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface FindManyOptions<TWhere, TOrderBy> {
  where?: TWhere;
  orderBy?: TOrderBy;
  pagination?: PaginationOptions;
}

/**
 * Standard contract for Prisma delegates performing CRUD operations.
 */
export interface GenericPrismaDelegate<
  TModel,
  TWhereUniqueInput,
  TWhereInput,
  TOrderByInput,
  TCreateInput,
  TUpdateInput
> {
  findUnique(args: { where: TWhereUniqueInput }): Promise<TModel | null>;
  findMany(args?: {
    where?: TWhereInput;
    orderBy?: TOrderByInput;
    skip?: number;
    take?: number;
  }): Promise<TModel[]>;
  create(args: { data: TCreateInput }): Promise<TModel>;
  update(args: { where: TWhereUniqueInput; data: TUpdateInput }): Promise<TModel>;
  delete(args: { where: TWhereUniqueInput }): Promise<TModel>;
  count(args?: { where?: TWhereInput }): Promise<number>;
}
