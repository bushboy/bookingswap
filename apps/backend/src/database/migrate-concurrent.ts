import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { parse } from 'pg-connection-string';

interface Migration {
    id: string;
    filename: string;
    sql: string;
    hasConcurrentIndexes: boolean;
}

export class ConcurrentMigrator {
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
            const hasConcurrentIndexes = sql.includes('CREATE INDEX CONCURRENTLY');
            return { id, filename, sql, hasConcurrentIndexes };
        });
    }

    async executeMigration(migration: Migration): Promise<void> {
        if (migration.hasConcurrentIndexes) {
            await this.executeConcurrentMigration(migration);
        } else {
            await this.executeTransactionalMigration(migration);
        }
    }

    private async executeTransactionalMigration(migration: Migration): Promise<void> {
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

    private async executeConcurrentMigration(migration: Migration): Promise<void> {
        console.log(`⚠ Executing concurrent migration: ${migration.filename}`);

        // Split the SQL into individual statements
        const statements = migration.sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        // Execute each statement separately
        for (const statement of statements) {
            if (statement.includes('CREATE INDEX CONCURRENTLY')) {
                // Execute concurrent index creation without transaction
                const client = await this.pool.connect();
                try {
                    await client.query(statement);
                    console.log(`  ✓ Executed: ${statement.substring(0, 50)}...`);
                } catch (error) {
                    console.error(`  ✗ Failed: ${statement.substring(0, 50)}...`);
                    throw error;
                } finally {
                    client.release();
                }
            } else if (statement.includes('COMMENT ON INDEX')) {
                // Execute comment statements without transaction
                const client = await this.pool.connect();
                try {
                    await client.query(statement);
                    console.log(`  ✓ Added comment`);
                } catch (error) {
                    console.error(`  ✗ Failed to add comment: ${error.message}`);
                    // Don't fail the migration for comment errors
                } finally {
                    client.release();
                }
            }
        }

        // Record the migration as executed in a separate transaction
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
                [migration.id, migration.filename]
            );
            await client.query('COMMIT');
            console.log(`✓ Executed concurrent migration: ${migration.filename}`);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`✗ Failed to record migration: ${migration.filename}`);
            throw error;
        } finally {
            client.release();
        }
    }

    async migrate(): Promise<void> {
        console.log('Starting database migration with concurrent index support...');

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
            const type = migration.hasConcurrentIndexes ? '(concurrent)' : '(transactional)';
            console.log(`  - ${migration.filename} ${type}`);
        });

        // Execute pending migrations
        for (const migration of pendingMigrations) {
            await this.executeMigration(migration);
        }

        console.log('Migration completed successfully!');
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

    const migrator = new ConcurrentMigrator(pool);

    migrator.migrate()
        .then(() => {
            console.log('All migrations completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}