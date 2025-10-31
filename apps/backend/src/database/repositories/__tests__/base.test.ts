import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { BaseRepository } from '../base';
import { BaseEntity } from '@booking-swap/shared';

// Mock entity for testing
interface TestEntity extends BaseEntity {
  name: string;
  value: number;
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor(pool: Pool) {
    super(pool, 'test_table');
  }

  mapRowToEntity(row: any): TestEntity {
    return {
      id: row.id,
      name: row.name,
      value: parseInt(row.value),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  mapEntityToRow(entity: Omit<TestEntity, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      name: entity.name,
      value: entity.value,
    };
  }
}

describe('BaseRepository', () => {
  let mockPool: Pool;
  let mockClient: any;
  let repository: TestRepository;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any;

    repository = new TestRepository(mockPool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('should return entity when found', async () => {
      const mockRow = {
        id: '123',
        name: 'Test Entity',
        value: '42',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockPool.query as any).mockResolvedValue({
        rows: [mockRow],
      });

      const result = await repository.findById('123');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE id = $1',
        ['123']
      );
      expect(result).toEqual({
        id: '123',
        name: 'Test Entity',
        value: 42,
        createdAt: mockRow.created_at,
        updatedAt: mockRow.updated_at,
      });
    });

    it('should return null when not found', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [],
      });

      const result = await repository.findById('123');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all entities with default pagination', async () => {
      const mockRows = [
        {
          id: '1',
          name: 'Entity 1',
          value: '10',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '2',
          name: 'Entity 2',
          value: '20',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      (mockPool.query as any).mockResolvedValue({
        rows: mockRows,
      });

      const result = await repository.findAll();

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [100, 0]
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Entity 1');
      expect(result[1].name).toBe('Entity 2');
    });

    it('should respect custom pagination parameters', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [],
      });

      await repository.findAll(50, 25);

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [50, 25]
      );
    });
  });

  describe('create', () => {
    it('should create new entity', async () => {
      const newEntity = {
        name: 'New Entity',
        value: 100,
      };

      const mockCreatedRow = {
        id: '456',
        name: 'New Entity',
        value: '100',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query.mockResolvedValue({
        rows: [mockCreatedRow],
      });

      const result = await repository.create(newEntity);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table (name, value)'),
        ['New Entity', 100]
      );
      expect(mockClient.release).toHaveBeenCalled();
      expect(result.id).toBe('456');
      expect(result.name).toBe('New Entity');
      expect(result.value).toBe(100);
    });
  });

  describe('update', () => {
    it('should update existing entity', async () => {
      const updates = {
        name: 'Updated Entity',
        value: 200,
      };

      const mockUpdatedRow = {
        id: '123',
        name: 'Updated Entity',
        value: '200',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query.mockResolvedValue({
        rows: [mockUpdatedRow],
      });

      const result = await repository.update('123', updates);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table'),
        ['123', 'Updated Entity', 200]
      );
      expect(mockClient.release).toHaveBeenCalled();
      expect(result?.name).toBe('Updated Entity');
      expect(result?.value).toBe(200);
    });

    it('should return null when entity not found', async () => {
      mockClient.query.mockResolvedValue({
        rows: [],
      });

      const result = await repository.update('123', { name: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete entity and return true', async () => {
      (mockPool.query as any).mockResolvedValue({
        rowCount: 1,
      });

      const result = await repository.delete('123');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM test_table WHERE id = $1',
        ['123']
      );
      expect(result).toBe(true);
    });

    it('should return false when entity not found', async () => {
      (mockPool.query as any).mockResolvedValue({
        rowCount: 0,
      });

      const result = await repository.delete('123');

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should return total count', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [{ count: '42' }],
      });

      const result = await repository.count();

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table'
      );
      expect(result).toBe(42);
    });
  });
});