import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { parse } from 'pg-connection-string';

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

export class DatabaseMigrator {
  private pool: Pool;
  private migrationsPath: string;

  constructor(pool: Pool, migrationsPath?: string) {
    this.pool = pool;
    this.migrationsPath = migrationsPath || join(__dirname, 'migrations');
  }

  async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `;
    
    await this.pool.query(sql);
  }

  async getExecutedMigrations(): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT id FROM migrations ORDER BY id'
    );
    return result.rows.map(row => row.id);
  }

  async loadMigrations(): Promise<Migration[]> {
    const files = readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(filename => {
      const id = filename.replace('.sql', '');
      const sql = readFileSync(join(this.migrationsPath, filename), 'utf-8');
      return { id, filename, sql };
    });
  }

  async executeMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute the migration SQL
      await client.query(migration.sql);
      
      // Record the migration as executed
      await client.query(
        'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
        [migration.id, migration.filename]
      );
      
      await client.query('COMMIT');
      console.log(`✓ Executed migration: ${migration.filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✗ Failed to execute migration: ${migration.filename}`);
      throw error;
    } finally {
      client.release();
    }
  }

  async migrate(): Promise<void> {
    console.log('Starting database migration...');
    
    // Ensure migrations table exists
    await this.createMigrationsTable();
    
    // Get executed migrations
    const executedMigrations = await this.getExecutedMigrations();
    
    // Load all migrations
    const allMigrations = await this.loadMigrations();
    
    // Filter pending migrations
    const pendingMigrations = allMigrations.filter(
      migration => !executedMigrations.includes(migration.id)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations found.');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(migration => {
      console.log(`  - ${migration.filename}`);
    });
    
    // Execute pending migrations
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }
    
    console.log('Migration completed successfully!');
  }

  async rollback(migrationId?: string): Promise<void> {
    // This is a simplified rollback - in production you'd want proper down migrations
    console.warn('Rollback functionality not implemented. Use manual SQL scripts for rollbacks.');
    
    if (migrationId) {
      await this.pool.query(
        'DELETE FROM migrations WHERE id = $1',
        [migrationId]
      );
      console.log(`Marked migration ${migrationId} as not executed.`);
    }
  }
}

// CLI runner
if (require.main === module) {
  // Parse database configuration from DATABASE_URL or individual env vars
  let poolConfig;
  
  if (process.env.DATABASE_URL) {
    const parsed = parse(process.env.DATABASE_URL);
    poolConfig = {
      host: parsed.host || 'localhost',
      port: parseInt(parsed.port || '5432'),
      database: parsed.database || 'booking_swap_db',
      user: parsed.user || 'postgres',
      password: parsed.password || 'password',
    };
  } else {
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'booking_swap_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    };
  }

  const pool = new Pool(poolConfig);

  const migrator = new DatabaseMigrator(pool);
  
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      migrator.migrate()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Migration failed:', error);
          process.exit(1);
        });
      break;
      
    case 'rollback':
      const migrationId = process.argv[3];
      migrator.rollback(migrationId)
        .then(() => process.exit(0))
        .catch(error => {
          console.error('Rollback failed:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage:');
      console.log('  npm run migrate        - Run pending migrations');
      console.log('  npm run migrate rollback [id] - Rollback migration');
      process.exit(1);
  }
}