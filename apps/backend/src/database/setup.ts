import { Pool } from 'pg';
import { parse } from 'pg-connection-string';

interface DatabaseSetupConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class DatabaseSetup {
  private config: DatabaseSetupConfig;

  constructor() {
    this.config = this.parseConfig();
  }

  private parseConfig(): DatabaseSetupConfig {
    // Try to parse DATABASE_URL first
    if (process.env.DATABASE_URL) {
      const parsed = parse(process.env.DATABASE_URL);
      return {
        host: parsed.host || 'localhost',
        port: parseInt(parsed.port || '5432'),
        user: parsed.user || 'postgres',
        password: parsed.password || 'password',
        database: parsed.database || 'booking_swap_db',
      };
    }

    // Fallback to individual environment variables
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'booking_swap_db',
    };
  }

  async createDatabase(): Promise<void> {
    console.log('Setting up database...');
    
    // Connect to postgres database to create our target database
    const adminPool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: 'postgres', // Connect to default postgres database
    });

    try {
      // Check if database exists
      const checkResult = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.config.database]
      );

      if (checkResult.rows.length === 0) {
        console.log(`Creating database: ${this.config.database}`);
        
        // Create the database
        await adminPool.query(`CREATE DATABASE "${this.config.database}"`);
        console.log(`✓ Database "${this.config.database}" created successfully`);
      } else {
        console.log(`✓ Database "${this.config.database}" already exists`);
      }

      // Create user if it doesn't exist (for the specific user in DATABASE_URL)
      if (this.config.user !== 'postgres') {
        const userCheckResult = await adminPool.query(
          'SELECT 1 FROM pg_roles WHERE rolname = $1',
          [this.config.user]
        );

        if (userCheckResult.rows.length === 0) {
          console.log(`Creating user: ${this.config.user}`);
          await adminPool.query(
            `CREATE USER "${this.config.user}" WITH PASSWORD '${this.config.password}'`
          );
          console.log(`✓ User "${this.config.user}" created successfully`);
        } else {
          console.log(`✓ User "${this.config.user}" already exists`);
        }

        // Grant privileges
        await adminPool.query(
          `GRANT ALL PRIVILEGES ON DATABASE "${this.config.database}" TO "${this.config.user}"`
        );
        console.log(`✓ Granted privileges to user "${this.config.user}"`);
      }

    } catch (error) {
      console.error('Failed to create database:', error);
      throw error;
    } finally {
      await adminPool.end();
    }
  }

  async createTestDatabase(): Promise<void> {
    const testDbName = `${this.config.database}_test`;
    console.log(`Setting up test database: ${testDbName}`);
    
    const adminPool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: 'postgres',
    });

    try {
      // Check if test database exists
      const checkResult = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [testDbName]
      );

      if (checkResult.rows.length === 0) {
        console.log(`Creating test database: ${testDbName}`);
        await adminPool.query(`CREATE DATABASE "${testDbName}"`);
        console.log(`✓ Test database "${testDbName}" created successfully`);
      } else {
        console.log(`✓ Test database "${testDbName}" already exists`);
      }

      // Grant privileges for test database
      if (this.config.user !== 'postgres') {
        await adminPool.query(
          `GRANT ALL PRIVILEGES ON DATABASE "${testDbName}" TO "${this.config.user}"`
        );
        console.log(`✓ Granted privileges to user "${this.config.user}" for test database`);
      }

    } catch (error) {
      console.error('Failed to create test database:', error);
      throw error;
    } finally {
      await adminPool.end();
    }
  }

  async dropDatabase(): Promise<void> {
    console.log(`Dropping database: ${this.config.database}`);
    
    const adminPool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: 'postgres',
    });

    try {
      // Terminate existing connections
      await adminPool.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [this.config.database]);

      // Drop the database
      await adminPool.query(`DROP DATABASE IF EXISTS "${this.config.database}"`);
      console.log(`✓ Database "${this.config.database}" dropped successfully`);

    } catch (error) {
      console.error('Failed to drop database:', error);
      throw error;
    } finally {
      await adminPool.end();
    }
  }

  getConfig(): DatabaseSetupConfig {
    return { ...this.config };
  }
}

// CLI runner
if (require.main === module) {
  const setup = new DatabaseSetup();
  const command = process.argv[2];

  switch (command) {
    case 'create':
      setup.createDatabase()
        .then(() => {
          console.log('Database setup completed successfully!');
          process.exit(0);
        })
        .catch(error => {
          console.error('Database setup failed:', error);
          process.exit(1);
        });
      break;

    case 'create-test':
      setup.createTestDatabase()
        .then(() => {
          console.log('Test database setup completed successfully!');
          process.exit(0);
        })
        .catch(error => {
          console.error('Test database setup failed:', error);
          process.exit(1);
        });
      break;

    case 'drop':
      setup.dropDatabase()
        .then(() => {
          console.log('Database dropped successfully!');
          process.exit(0);
        })
        .catch(error => {
          console.error('Database drop failed:', error);
          process.exit(1);
        });
      break;

    case 'reset':
      setup.dropDatabase()
        .then(() => setup.createDatabase())
        .then(() => {
          console.log('Database reset completed successfully!');
          process.exit(0);
        })
        .catch(error => {
          console.error('Database reset failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log('Usage:');
      console.log('  npm run db:create       - Create the database');
      console.log('  npm run db:create-test  - Create the test database');
      console.log('  npm run db:drop         - Drop the database');
      console.log('  npm run db:reset        - Drop and recreate the database');
      process.exit(1);
  }
}