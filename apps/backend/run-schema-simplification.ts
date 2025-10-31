import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { parse } from 'pg-connection-string';

async function runSchemaSimplification() {
    // Parse database configuration
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

    try {
        console.log('Starting schema simplification migration...');

        // Ensure migrations table exists
        await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

        // Check if migration 027 has already been executed
        const result = await pool.query(
            'SELECT id FROM migrations WHERE id = $1',
            ['027_simplify_swap_schema']
        );

        if (result.rows.length > 0) {
            console.log('✓ Schema simplification migration already executed');
            return;
        }

        // Read the migration file
        const migrationPath = join(__dirname, 'src/database/migrations/027_simplify_swap_schema.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        console.log('Executing schema simplification migration...');

        // Execute the migration in a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Split the migration SQL into individual statements
            // Handle PL/pgSQL blocks properly
            const statements = [];
            let currentStatement = '';
            let inPlpgsqlBlock = false;
            let dollarQuoteTag = '';

            const lines = migrationSQL.split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();

                // Skip comments and empty lines
                if (trimmedLine.startsWith('--') || trimmedLine === '') {
                    continue;
                }

                // Check for start of PL/pgSQL block
                if (trimmedLine.includes('$') && !inPlpgsqlBlock) {
                    const dollarMatch = trimmedLine.match(/\$([^$]*)\$/);
                    if (dollarMatch) {
                        dollarQuoteTag = dollarMatch[0];
                        inPlpgsqlBlock = true;
                    }
                }

                currentStatement += line + '\n';

                // Check for end of PL/pgSQL block
                if (inPlpgsqlBlock && trimmedLine.includes(dollarQuoteTag) && trimmedLine !== dollarQuoteTag) {
                    inPlpgsqlBlock = false;
                    dollarQuoteTag = '';
                }

                // Check for statement end
                if (!inPlpgsqlBlock && trimmedLine.endsWith(';')) {
                    statements.push(currentStatement.trim());
                    currentStatement = '';
                }
            }

            // Add any remaining statement
            if (currentStatement.trim()) {
                statements.push(currentStatement.trim());
            }

            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (statement) {
                    console.log(`Executing statement ${i + 1}/${statements.length}...`);
                    try {
                        await client.query(statement);
                    } catch (error) {
                        console.error(`Failed to execute statement ${i + 1}:`, statement.substring(0, 100) + '...');
                        throw error;
                    }
                }
            }

            // Record the migration as executed
            await client.query(
                'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
                ['027_simplify_swap_schema', '027_simplify_swap_schema.sql']
            );

            await client.query('COMMIT');
            console.log('✓ Schema simplification migration completed successfully!');

            // Run post-migration validation
            console.log('\nRunning post-migration validation...');
            const validationResult = await client.query('SELECT * FROM validate_simplified_schema_integrity()');

            console.log('\nValidation Results:');
            for (const row of validationResult.rows) {
                const status = row.passed ? '✓' : '✗';
                console.log(`${status} ${row.test_name}: ${row.details}`);
            }

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('✗ Migration failed:', error);
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the migration
runSchemaSimplification()
    .then(() => {
        console.log('\n=== Schema Simplification Complete ===');
        process.exit(0);
    })
    .catch(error => {
        console.error('Schema simplification failed:', error);
        process.exit(1);
    });