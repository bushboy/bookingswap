import { Pool, PoolConfig } from 'pg';
import { parse } from 'pg-connection-string';

export interface DatabaseConfig extends PoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  // Parse DATABASE_URL first, then fallback to individual env vars
  if (process.env.DATABASE_URL) {
    const parsed = parse(process.env.DATABASE_URL);
    return {
      host: parsed.host || 'localhost',
      port: parseInt(parsed.port || '5432'),
      database: parsed.database || 'booking_swap_db',
      user: parsed.user || 'postgres',
      password: parsed.password || 'password',
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  };
};

export const createDatabasePool = (config?: DatabaseConfig): Pool => {
  const dbConfig = config || getDatabaseConfig();
  return new Pool(dbConfig);
};

// Singleton pool instance
let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = createDatabasePool();
  }
  return pool;
};

export const closeDatabasePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};