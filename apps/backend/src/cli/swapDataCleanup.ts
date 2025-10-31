#!/usr/bin/env node

/**
 * CLI script for swap data cleanup operations
 * Requirements: 3.4 - Scripts to identify and cleanup invalid data
 * 
 * Usage:
 *   npm run cleanup:swaps -- --help
 *   npm run cleanup:swaps -- --dry-run
 *   npm run cleanup:swaps -- --cleanup --backup
 *   npm run cleanup:swaps -- --validate-only
 */

import { Pool } from 'pg';
import { Command } from 'commander';
import { SwapDataValidationService } from '../utils/swapDataValidation';
import { SwapDataCleanupService, CleanupOptions } from '../utils/swapDataCleanup';
import { logger } from '../utils/logger';

const program = new Command();

// Database connection
let pool: Pool;

async function initializeDatabase(): Promise<Pool> {
    if (!pool) {
        pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'booking_swap',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
        });

        // Test connection
        try {
            await pool.query('SELECT 1');
            logger.info('Database connection established');
        } catch (error) {
            logger.error('Failed to connect to database', { error });
            process.exit(1);
        }
    }
    return pool;
}

async function validateData(): Promise<void> {
    const pool = await initializeDatabase();
    const validationService = new SwapDataValidationService(pool);

    try {
        console.log('🔍 Running data validation...\n');

        const report = await validationService.generateValidationReport();

        console.log('📊 VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total Swaps: ${report.summary.totalSwaps}`);
        console.log(`Self-Proposals Found: ${report.summary.selfProposalsFound}`);
        console.log(`Null Proposer IDs: ${report.summary.nullProposerIds}`);
        console.log(`Null Owner IDs: ${report.summary.nullOwnerIds}`);
        console.log(`Inconsistent Booking Relations: ${report.summary.inconsistentBookingRelations}`);
        console.log(`Validation Timestamp: ${report.summary.timestamp.toISOString()}\n`);

        if (report.summary.selfProposalsFound > 0) {
            console.log('🚨 SELF-PROPOSALS DETECTED');
            console.log('='.repeat(50));
            report.summary.validationResults.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. Swap ID: ${result.swapId}`);
                console.log(`   User: ${result.proposerId} (${result.severity} severity)`);
                console.log(`   Status: ${result.status}`);
                console.log(`   Created: ${result.createdAt.toISOString()}`);
                console.log(`   Description: ${result.description}\n`);
            });

            if (report.summary.validationResults.length > 5) {
                console.log(`... and ${report.summary.validationResults.length - 5} more\n`);
            }
        }

        console.log('📋 DETAILED VALIDATION CHECKS');
        console.log('='.repeat(50));
        report.validationSummary.forEach(check => {
            const icon = check.severity === 'NONE' ? '✅' :
                check.severity === 'LOW' ? '⚠️' :
                    check.severity === 'MEDIUM' ? '🔶' : '🚨';
            console.log(`${icon} ${check.validationCheck}: ${check.issueCount} issues (${check.severity})`);
            console.log(`   Recommendation: ${check.recommendation}\n`);
        });

        console.log('💡 RECOMMENDATIONS');
        console.log('='.repeat(50));
        report.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
        });

        if (report.summary.selfProposalsFound > 0 || report.summary.nullProposerIds > 0 || report.summary.nullOwnerIds > 0) {
            console.log('\n🔧 To fix these issues, run:');
            console.log('   npm run cleanup:swaps -- --cleanup --backup');
            console.log('   (or --dry-run first to see what would be changed)');
        } else {
            console.log('\n✅ No data integrity issues found!');
        }

    } catch (error) {
        logger.error('Validation failed', { error });
        console.error('❌ Validation failed:', error);
        process.exit(1);
    }
}

async function performCleanup(options: CleanupOptions): Promise<void> {
    const pool = await initializeDatabase();
    const cleanupService = new SwapDataCleanupService(pool);

    try {
        const modeText = options.dryRun ? '🧪 DRY RUN MODE' : '🔧 CLEANUP MODE';
        console.log(`${modeText} - ${options.createBackup ? 'WITH BACKUP' : 'NO BACKUP'}\n`);

        if (!options.dryRun && !options.skipConfirmation) {
            console.log('⚠️  WARNING: This will permanently modify your database!');
            console.log('   Make sure you have a backup if needed.');
            console.log('   Use --dry-run first to see what would be changed.\n');

            // In a real CLI, you'd use readline for confirmation
            // For now, we'll require explicit --skip-confirmation flag
            if (!options.skipConfirmation) {
                console.log('❌ Use --skip-confirmation flag to proceed with actual cleanup');
                return;
            }
        }

        const result = await cleanupService.performComprehensiveCleanup(options);

        console.log('📊 CLEANUP RESULTS');
        console.log('='.repeat(50));
        console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'ACTUAL CLEANUP'}`);
        console.log(`Total Records Processed: ${result.overallSummary.totalRecordsProcessed}`);
        console.log(`Total Records Fixed: ${result.overallSummary.totalRecordsFixed}`);
        console.log(`Total Operations: ${result.overallSummary.totalOperations}`);
        console.log(`Errors: ${result.overallSummary.totalErrors}`);
        console.log(`Warnings: ${result.overallSummary.totalWarnings}\n`);

        if (result.selfProposalCleanup.recordsAffected > 0) {
            console.log('🔄 SELF-PROPOSAL CLEANUP');
            console.log('='.repeat(30));
            console.log(`Records Affected: ${result.selfProposalCleanup.recordsAffected}`);
            console.log(`Self-Proposals Removed: ${result.selfProposalCleanup.summary.selfProposalsRemoved}`);
            console.log(`Backup Created: ${result.selfProposalCleanup.backupCreated ? '✅' : '❌'}`);
            if (result.selfProposalCleanup.backupLocation) {
                console.log(`Backup Location: ${result.selfProposalCleanup.backupLocation}`);
            }
            console.log();
        }

        if (result.nullUserIdCleanup.recordsAffected > 0) {
            console.log('🔄 NULL USER ID CLEANUP');
            console.log('='.repeat(30));
            console.log(`Records Affected: ${result.nullUserIdCleanup.recordsAffected}`);
            console.log(`Invalid Records Fixed: ${result.nullUserIdCleanup.summary.invalidDataFixed}\n`);
        }

        // Show errors and warnings
        const allErrors = [...result.selfProposalCleanup.errors, ...result.nullUserIdCleanup.errors];
        const allWarnings = [...result.selfProposalCleanup.warnings, ...result.nullUserIdCleanup.warnings];

        if (allErrors.length > 0) {
            console.log('❌ ERRORS');
            console.log('='.repeat(20));
            allErrors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
            console.log();
        }

        if (allWarnings.length > 0) {
            console.log('⚠️  WARNINGS');
            console.log('='.repeat(20));
            allWarnings.forEach((warning, index) => {
                console.log(`${index + 1}. ${warning}`);
            });
            console.log();
        }

        // Verify results if actual cleanup was performed
        if (!options.dryRun) {
            console.log('🔍 VERIFYING CLEANUP RESULTS...\n');
            const verification = await cleanupService.verifyCleanupResults();

            console.log('✅ VERIFICATION RESULTS');
            console.log('='.repeat(30));
            console.log(`Remaining Self-Proposals: ${verification.remainingSelfProposals}`);
            console.log(`Remaining Null User IDs: ${verification.remainingNullUserIds}`);
            console.log(`Data Integrity Status: ${verification.dataIntegrityStatus}`);

            if (verification.issues.length > 0) {
                console.log('\n🚨 REMAINING ISSUES:');
                verification.issues.forEach((issue, index) => {
                    console.log(`${index + 1}. ${issue}`);
                });
            } else {
                console.log('\n🎉 All issues have been resolved!');
            }
        }

    } catch (error) {
        logger.error('Cleanup failed', { error });
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

async function analyzeUser(userId: string): Promise<void> {
    const pool = await initializeDatabase();
    const validationService = new SwapDataValidationService(pool);

    try {
        console.log(`🔍 Analyzing user: ${userId}\n`);

        const report = await validationService.generateValidationReport(userId);
        const affected = report.affectedSwaps;

        console.log('👤 USER ANALYSIS');
        console.log('='.repeat(50));
        console.log(`Total User Swaps: ${affected.summary.totalUserSwaps}`);
        console.log(`Swaps with Self-Proposals: ${affected.summary.swapsWithSelfProposals}`);
        console.log(`Self-Proposals Made: ${affected.summary.selfProposalsMade}\n`);

        if (affected.userSwapsWithSelfProposals.length > 0) {
            console.log('🔄 USER SWAPS WITH SELF-PROPOSALS');
            console.log('='.repeat(40));
            affected.userSwapsWithSelfProposals.forEach((swap: any, index: number) => {
                console.log(`${index + 1}. Swap ID: ${swap.swap_id}`);
                console.log(`   Self-Proposal Count: ${swap.self_proposal_count}`);
                console.log(`   Created: ${swap.swap_created_at}`);
                console.log();
            });
        }

        if (affected.proposalsFromSelfToOthers.length > 0) {
            console.log('📤 SELF-PROPOSALS MADE BY USER');
            console.log('='.repeat(40));
            affected.proposalsFromSelfToOthers.forEach((proposal: any, index: number) => {
                console.log(`${index + 1}. Proposal ID: ${proposal.proposal_id}`);
                console.log(`   Target Swap: ${proposal.target_swap_id}`);
                console.log(`   Status: ${proposal.proposal_status}`);
                console.log(`   Created: ${proposal.proposal_created_at}`);
                console.log();
            });
        }

        if (report.filteringValidation) {
            console.log('🧪 FILTERING VALIDATION');
            console.log('='.repeat(30));
            console.log(`Before Filtering - All Proposals: ${report.filteringValidation.beforeFiltering.allProposals}`);
            console.log(`Before Filtering - Self-Proposals: ${report.filteringValidation.beforeFiltering.selfProposals}`);
            console.log(`After Filtering - Valid Proposals: ${report.filteringValidation.afterFiltering.validProposals}`);
            console.log(`Excluded Self-Proposals: ${report.filteringValidation.afterFiltering.excludedSelfProposals}`);
            console.log(`Filtering Working Correctly: ${report.filteringValidation.isFilteringWorking ? '✅' : '❌'}\n`);

            if (report.filteringValidation.issues.length > 0) {
                console.log('🚨 FILTERING ISSUES:');
                report.filteringValidation.issues.forEach((issue: string, index: number) => {
                    console.log(`${index + 1}. ${issue}`);
                });
            }
        }

    } catch (error) {
        logger.error('User analysis failed', { error, userId });
        console.error('❌ User analysis failed:', error);
        process.exit(1);
    }
}

// CLI Command Setup
program
    .name('swap-data-cleanup')
    .description('CLI tool for validating and cleaning up swap data inconsistencies')
    .version('1.0.0');

program
    .command('validate')
    .description('Validate swap data integrity and identify issues')
    .action(validateData);

program
    .command('cleanup')
    .description('Clean up invalid swap data')
    .option('--dry-run', 'Show what would be cleaned up without making changes', false)
    .option('--backup', 'Create backup before cleanup', true)
    .option('--no-backup', 'Skip backup creation')
    .option('--batch-size <size>', 'Number of records to process in each batch', '50')
    .option('--max-records <count>', 'Maximum number of records to process')
    .option('--skip-confirmation', 'Skip confirmation prompts', false)
    .action(async (options) => {
        const cleanupOptions: CleanupOptions = {
            dryRun: options.dryRun,
            createBackup: options.backup,
            batchSize: parseInt(options.batchSize),
            maxRecordsToProcess: options.maxRecords ? parseInt(options.maxRecords) : undefined,
            skipConfirmation: options.skipConfirmation
        };
        await performCleanup(cleanupOptions);
    });

program
    .command('analyze-user <userId>')
    .description('Analyze a specific user for self-proposal issues')
    .action(analyzeUser);

program
    .command('quick-check')
    .description('Quick validation check with summary only')
    .action(async () => {
        const pool = await initializeDatabase();
        const validationService = new SwapDataValidationService(pool);

        try {
            const summary = await validationService.getValidationSummary();

            console.log('⚡ QUICK VALIDATION CHECK');
            console.log('='.repeat(30));

            let hasIssues = false;
            summary.forEach(check => {
                const icon = check.severity === 'NONE' ? '✅' : '🚨';
                console.log(`${icon} ${check.validationCheck}: ${check.issueCount} issues`);
                if (check.severity !== 'NONE') hasIssues = true;
            });

            console.log(`\n${hasIssues ? '🚨 Issues found! Run "validate" for details.' : '✅ No issues detected!'}`);
        } catch (error) {
            console.error('❌ Quick check failed:', error);
            process.exit(1);
        }
    });

// Handle cleanup on exit
process.on('SIGINT', async () => {
    console.log('\n🛑 Received interrupt signal. Cleaning up...');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal. Cleaning up...');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}