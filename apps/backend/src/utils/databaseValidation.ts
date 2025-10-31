import { Pool } from 'pg';
import { logger } from './logger';

/**
 * Database column validation utilities for proposal repository
 * Requirements: 4.3, 5.5
 */

export interface ColumnInfo {
    columnName: string;
    dataType: string;
    isNullable: boolean;
    defaultValue?: string;
}

export interface TableInfo {
    tableName: string;
    columns: ColumnInfo[];
    primaryKey?: string;
    foreignKeys: Array<{
        columnName: string;
        referencedTable: string;
        referencedColumn: string;
    }>;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

/**
 * Database column validation class for proposal repository queries
 */
export class DatabaseColumnValidator {
    private pool: Pool;
    private tableCache: Map<string, TableInfo> = new Map();
    private cacheExpiry: Map<string, number> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * Validate that a column exists in a table
     */
    async validateColumnExists(tableName: string, columnName: string): Promise<boolean> {
        try {
            const tableInfo = await this.getTableInfo(tableName);
            return tableInfo.columns.some(col => col.columnName === columnName);
        } catch (error) {
            logger.error('Failed to validate column existence', {
                error: error.message,
                tableName,
                columnName,
                requirement: '4.3'
            });
            return false;
        }
    }

    /**
     * Validate multiple columns exist in a table
     */
    async validateColumnsExist(tableName: string, columnNames: string[]): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };

        try {
            const tableInfo = await this.getTableInfo(tableName);
            const existingColumns = tableInfo.columns.map(col => col.columnName);

            for (const columnName of columnNames) {
                if (!existingColumns.includes(columnName)) {
                    result.isValid = false;
                    result.errors.push(`Column "${columnName}" does not exist in table "${tableName}"`);

                    // Suggest similar column names
                    const suggestions = this.findSimilarColumns(columnName, existingColumns);
                    if (suggestions.length > 0) {
                        result.suggestions.push(`Did you mean: ${suggestions.join(', ')}?`);
                    }
                }
            }

            // Check for deprecated columns that were removed in schema simplification
            const deprecatedColumns = ['owner_id', 'proposer_id', 'target_booking_id'];
            const usedDeprecatedColumns = columnNames.filter(col => deprecatedColumns.includes(col));

            if (usedDeprecatedColumns.length > 0) {
                result.warnings.push(`Deprecated columns detected: ${usedDeprecatedColumns.join(', ')}. These were removed in schema simplification.`);
                result.suggestions.push('Use JOIN operations to derive user information from booking relationships');
            }

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Failed to validate columns: ${error.message}`);
            logger.error('Failed to validate multiple columns', {
                error: error.message,
                tableName,
                columnNames,
                requirement: '4.3'
            });
        }

        return result;
    }

    /**
     * Validate a SQL query for column references
     */
    async validateQueryColumns(query: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };

        try {
            // Extract table and column references from the query
            const tableColumnRefs = this.extractTableColumnReferences(query);

            for (const { tableName, columnName } of tableColumnRefs) {
                const exists = await this.validateColumnExists(tableName, columnName);
                if (!exists) {
                    result.isValid = false;
                    result.errors.push(`Column "${columnName}" does not exist in table "${tableName}"`);

                    // Get table info for suggestions
                    const tableInfo = await this.getTableInfo(tableName);
                    const suggestions = this.findSimilarColumns(columnName, tableInfo.columns.map(c => c.columnName));
                    if (suggestions.length > 0) {
                        result.suggestions.push(`For table "${tableName}", did you mean: ${suggestions.join(', ')}?`);
                    }
                }
            }

        } catch (error) {
            result.isValid = false;
            result.errors.push(`Failed to validate query: ${error.message}`);
            logger.error('Failed to validate query columns', {
                error: error.message,
                query: query.substring(0, 200) + '...',
                requirement: '4.3'
            });
        }

        return result;
    }

    /**
     * Get comprehensive table information
     */
    async getTableInfo(tableName: string): Promise<TableInfo> {
        // Check cache first
        const cacheKey = tableName;
        const cachedInfo = this.tableCache.get(cacheKey);
        const cacheTime = this.cacheExpiry.get(cacheKey);

        if (cachedInfo && cacheTime && Date.now() - cacheTime < this.CACHE_TTL) {
            return cachedInfo;
        }

        try {
            // Get column information
            const columnQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

            const columnResult = await this.pool.query(columnQuery, [tableName]);

            if (columnResult.rows.length === 0) {
                throw new Error(`Table "${tableName}" does not exist`);
            }

            const columns: ColumnInfo[] = columnResult.rows.map(row => ({
                columnName: row.column_name,
                dataType: row.data_type,
                isNullable: row.is_nullable === 'YES',
                defaultValue: row.column_default
            }));

            // Get primary key information
            const pkQuery = `
        SELECT column_name
        FROM information_schema.key_column_usage
        WHERE table_name = $1 AND table_schema = 'public'
        AND constraint_name IN (
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = $1 AND table_schema = 'public'
          AND constraint_type = 'PRIMARY KEY'
        )
      `;

            const pkResult = await this.pool.query(pkQuery, [tableName]);
            const primaryKey = pkResult.rows[0]?.column_name;

            // Get foreign key information
            const fkQuery = `
        SELECT 
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.constraint_column_usage ccu
          ON kcu.constraint_name = ccu.constraint_name
        WHERE kcu.table_name = $1 AND kcu.table_schema = 'public'
        AND kcu.constraint_name IN (
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = $1 AND table_schema = 'public'
          AND constraint_type = 'FOREIGN KEY'
        )
      `;

            const fkResult = await this.pool.query(fkQuery, [tableName]);
            const foreignKeys = fkResult.rows.map(row => ({
                columnName: row.column_name,
                referencedTable: row.referenced_table,
                referencedColumn: row.referenced_column
            }));

            const tableInfo: TableInfo = {
                tableName,
                columns,
                primaryKey,
                foreignKeys
            };

            // Cache the result
            this.tableCache.set(cacheKey, tableInfo);
            this.cacheExpiry.set(cacheKey, Date.now());

            return tableInfo;

        } catch (error) {
            logger.error('Failed to get table info', {
                error: error.message,
                tableName,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Extract table and column references from SQL query
     */
    private extractTableColumnReferences(query: string): Array<{ tableName: string; columnName: string }> {
        const references: Array<{ tableName: string; columnName: string }> = [];

        // Simple regex patterns to extract table.column references
        // This is a basic implementation - could be enhanced with a proper SQL parser
        const patterns = [
            // Pattern: table.column
            /(\w+)\.(\w+)/g,
            // Pattern: table alias references (more complex, simplified here)
            /(?:FROM|JOIN)\s+(\w+)\s+(?:AS\s+)?(\w+)/gi
        ];

        // Extract direct table.column references
        const directRefs = query.matchAll(/(\w+)\.(\w+)/g);
        for (const match of directRefs) {
            const [, tableName, columnName] = match;
            // Skip common SQL keywords and functions
            if (!this.isSqlKeyword(tableName) && !this.isSqlKeyword(columnName)) {
                references.push({ tableName, columnName });
            }
        }

        return references;
    }

    /**
     * Find similar column names using Levenshtein distance
     */
    private findSimilarColumns(targetColumn: string, availableColumns: string[]): string[] {
        const similarities = availableColumns.map(col => ({
            column: col,
            distance: this.levenshteinDistance(targetColumn.toLowerCase(), col.toLowerCase())
        }));

        // Return columns with distance <= 2 and sort by similarity
        return similarities
            .filter(s => s.distance <= 2)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3)
            .map(s => s.column);
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // deletion
                    matrix[j - 1][i] + 1,     // insertion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Check if a word is a SQL keyword
     */
    private isSqlKeyword(word: string): boolean {
        const keywords = [
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
            'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'LIKE', 'BETWEEN',
            'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
            'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
            'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'AS'
        ];
        return keywords.includes(word.toUpperCase());
    }

    /**
     * Clear the table info cache
     */
    clearCache(): void {
        this.tableCache.clear();
        this.cacheExpiry.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; tables: string[] } {
        return {
            size: this.tableCache.size,
            tables: Array.from(this.tableCache.keys())
        };
    }
}