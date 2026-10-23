import {
  GenericPrismaDelegate,
  FindManyOptions,
  PaginatedResult,
} from './repository.types';
import { calculatePagination } from '../utils/pagination';

/**
 * Generic Base Repository providing safe, reusable CRUD and pagination.
 *
 * NOTE: Domain-specific queries (e.g. mentor dashboards, complex joins, composite status filters)
 * belong in feature repositories rather than this base abstraction.
 */
export abstract class BaseRepository<
  TModel,
  TDelegate extends GenericPrismaDelegate<
    TModel,
    TWhereUniqueInput,
    TWhereInput,
    TOrderByInput,
    TCreateInput,
    TUpdateInput
  >,
  TWhereUniqueInput,
  TWhereInput = unknown,
  TOrderByInput = unknown,
  TCreateInput = unknown,
  TUpdateInput = unknown
> {
  protected readonly delegate: TDelegate;

  constructor(delegate: TDelegate) {
    this.delegate = delegate;
  }

  async findById(id: string): Promise<TModel | null> {
    return this.delegate.findUnique({
      where: { id } as unknown as TWhereUniqueInput,
    });
  }

  async findUnique(where: TWhereUniqueInput): Promise<TModel | null> {
    return this.delegate.findUnique({ where });
  }

  async findMany(
    options: FindManyOptions<TWhereInput, TOrderByInput> = {}
  ): Promise<PaginatedResult<TModel>> {
    const { where, orderBy, pagination } = options;

    const total = await this.delegate.count({ where });
    const paginationCalc = calculatePagination(pagination ?? {}, total);

    const items = await this.delegate.findMany({
      where,
      orderBy,
      skip: paginationCalc.skip,
      take: paginationCalc.limit,
    });

    return {
      items,
      total,
      page: paginationCalc.page,
      limit: paginationCalc.limit,
      totalPages: paginationCalc.totalPages,
      hasNextPage: paginationCalc.hasNextPage,
      hasPrevPage: paginationCalc.hasPrevPage,
    };
  }

  async create(data: TCreateInput): Promise<TModel> {
    return this.delegate.create({ data });
  }

  async update(where: TWhereUniqueInput, data: TUpdateInput): Promise<TModel> {
    return this.delegate.update({ where, data });
  }

  async delete(where: TWhereUniqueInput): Promise<TModel> {
    return this.delegate.delete({ where });
  }

  async count(where?: TWhereInput): Promise<number> {
    return this.delegate.count({ where });
  }

  async exists(where: TWhereUniqueInput): Promise<boolean> {
    const item = await this.delegate.findUnique({ where });
    return item !== null;
  }
}
