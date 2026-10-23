import { describe, it, expect, vi } from 'vitest';
import { BaseRepository } from '../src/repositories/base.repository';
import { GenericPrismaDelegate } from '../src/repositories/repository.types';

interface TestEntity {
  id: string;
  name: string;
}

type WhereUnique = { id: string };
type WhereInput = { name?: string };
type OrderByInput = { name?: 'asc' | 'desc' };
type CreateInput = { name: string };
type UpdateInput = { name?: string };

class TestRepository extends BaseRepository<
  TestEntity,
  GenericPrismaDelegate<TestEntity, WhereUnique, WhereInput, OrderByInput, CreateInput, UpdateInput>,
  WhereUnique,
  WhereInput,
  OrderByInput,
  CreateInput,
  UpdateInput
> {}

describe('BaseRepository Generic Operations', () => {
  const mockDelegate: GenericPrismaDelegate<
    TestEntity,
    WhereUnique,
    WhereInput,
    OrderByInput,
    CreateInput,
    UpdateInput
  > = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };

  const repository = new TestRepository(mockDelegate);

  it('findById should query delegate with id', async () => {
    const mockItem: TestEntity = { id: 'uuid-1', name: 'Item 1' };
    vi.mocked(mockDelegate.findUnique).mockResolvedValueOnce(mockItem);

    const result = await repository.findById('uuid-1');

    expect(mockDelegate.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
    expect(result).toEqual(mockItem);
  });

  it('findUnique should query delegate with unique criteria', async () => {
    const mockItem: TestEntity = { id: 'uuid-2', name: 'Item 2' };
    vi.mocked(mockDelegate.findUnique).mockResolvedValueOnce(mockItem);

    const result = await repository.findUnique({ id: 'uuid-2' });

    expect(mockDelegate.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-2' } });
    expect(result).toEqual(mockItem);
  });

  it('findMany should calculate pagination and return paginated result envelope', async () => {
    const mockItems: TestEntity[] = [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ];
    vi.mocked(mockDelegate.count).mockResolvedValueOnce(25);
    vi.mocked(mockDelegate.findMany).mockResolvedValueOnce(mockItems);

    const result = await repository.findMany({
      where: { name: 'test' },
      pagination: { page: 2, limit: 10 },
    });

    expect(mockDelegate.count).toHaveBeenCalledWith({ where: { name: 'test' } });
    expect(mockDelegate.findMany).toHaveBeenCalledWith({
      where: { name: 'test' },
      orderBy: undefined,
      skip: 10,
      take: 10,
    });

    expect(result).toEqual({
      items: mockItems,
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    });
  });

  it('create should call delegate create', async () => {
    const newItem: TestEntity = { id: 'new-id', name: 'Created' };
    vi.mocked(mockDelegate.create).mockResolvedValueOnce(newItem);

    const result = await repository.create({ name: 'Created' });

    expect(mockDelegate.create).toHaveBeenCalledWith({ data: { name: 'Created' } });
    expect(result).toEqual(newItem);
  });

  it('update should call delegate update', async () => {
    const updated: TestEntity = { id: 'id-1', name: 'Updated' };
    vi.mocked(mockDelegate.update).mockResolvedValueOnce(updated);

    const result = await repository.update({ id: 'id-1' }, { name: 'Updated' });

    expect(mockDelegate.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { name: 'Updated' },
    });
    expect(result).toEqual(updated);
  });

  it('delete should call delegate delete', async () => {
    const deleted: TestEntity = { id: 'id-1', name: 'Deleted' };
    vi.mocked(mockDelegate.delete).mockResolvedValueOnce(deleted);

    const result = await repository.delete({ id: 'id-1' });

    expect(mockDelegate.delete).toHaveBeenCalledWith({ where: { id: 'id-1' } });
    expect(result).toEqual(deleted);
  });

  it('count should call delegate count', async () => {
    vi.mocked(mockDelegate.count).mockResolvedValueOnce(7);

    const result = await repository.count({ name: 'filter' });

    expect(mockDelegate.count).toHaveBeenCalledWith({ where: { name: 'filter' } });
    expect(result).toBe(7);
  });

  it('exists should return true when record is found and false otherwise', async () => {
    vi.mocked(mockDelegate.findUnique).mockResolvedValueOnce({ id: 'found', name: 'Item' });
    expect(await repository.exists({ id: 'found' })).toBe(true);

    vi.mocked(mockDelegate.findUnique).mockResolvedValueOnce(null);
    expect(await repository.exists({ id: 'missing' })).toBe(false);
  });
});
