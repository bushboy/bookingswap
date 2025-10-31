import { Pool, PoolClient, QueryResult } from 'pg';
import { BaseEntity } from '@booking-swap/shared';

export interface Repository<T extends BaseEntity> {
  findById(id: string): Promise<T | null>;
  findAll(limit?: number, offset?: number): Promise<T[]>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export abstract class BaseRepository<T extends BaseEntity> implements Repository<T> {
  protected pool: Pool;
  protected tableName: string;

  constructor(pool: Pool, tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
  }

  abstract mapRowToEntity(row: any): T;
  abstract mapEntityToRow(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): any;

  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAll(limit: number = 100, offset: number = 0): Promise<T[]> {
    const query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
    const result = await this.pool.query(query, [limit, offset]);
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      const row = this.mapEntityToRow(entity);
      const columns = Object.keys(row);
      const values = Object.values(row);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      
      const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      return this.mapRowToEntity(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T | null> {
    const client = await this.pool.connect();
    
    try {
      const row = this.mapEntityToRow(updates as any);
      const columns = Object.keys(row);
      const values = Object.values(row);
      
      if (columns.length === 0) {
        return this.findById(id);
      }
      
      const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');
      const query = `
        UPDATE ${this.tableName}
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await client.query(query, [id, ...values]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToEntity(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    
    return result.rowCount > 0;
  }

  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const result = await this.pool.query(query);
    
    return parseInt(result.rows[0].count);
  }

  protected async executeInTransaction<R>(
    callback: (client: PoolClient) => Promise<R>
  ): Promise<R> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}