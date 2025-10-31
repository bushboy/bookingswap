# Swap Data Validation and Cleanup Utilities

This document describes the data validation and cleanup utilities implemented for the swap self-exclusion fix.

## Overview

The swap data validation and cleanup utilities address the critical logical bug where users see their own swaps incorrectly displayed as proposals from themselves. These utilities help identify, validate, and clean up invalid self-proposal data in the database.

## Components

### 1. SwapDataValidationService (`swapDataValidation.ts`)

Provides comprehensive data validation capabilities:

- **detectSelfProposals()**: Identifies existing self-proposals in the database
- **validateDataIntegrity()**: Performs comprehensive data integrity checks
- **getValidationSummary()**: Uses database functions for validation summary
- **identifyAffectedSwaps()**: Finds swaps affected by self-exclusion filtering
- **validateFilteringLogic()**: Ensures filtering logic works correctly
- **generateValidationReport()**: Creates comprehensive validation reports

### 2. SwapDataCleanupService (`swapDataCleanup.ts`)

Provides safe data cleanup procedures:

- **removeSelfProposals()**: Safely removes self-proposals with backup options
- **fixNullUserIds()**: Fixes swaps with null proposer_id or owner_id
- **performComprehensiveCleanup()**: Runs all cleanup operations
- **verifyCleanupResults()**: Validates cleanup was successful

### 3. SwapCleanupReportingService (`swapCleanupReporting.ts`)

Provides logging and reporting capabilities:

- **logCleanupOperation()**: Logs cleanup operations to database
- **createAuditLog()**: Creates audit trail entries
- **generateCleanupReport()**: Generates comprehensive reports
- **exportCleanupLogs()**: Exports logs in JSON or CSV format

### 4. CLI Tool (`cli/swapDataCleanup.ts`)

Command-line interface for running validation and cleanup operations.

## Usage

### CLI Commands

```bash
# Quick validation check
npm run cleanup:swaps:quick

# Full validation report
npm run cleanup:swaps:validate

# Dry run cleanup (see what would be changed)
npm run cleanup:swaps:dry-run

# Execute cleanup with backup
npm run cleanup:swaps:execute

# Analyze specific user
npm run cleanup:swaps -- analyze-user <user-id>

# Custom cleanup options
npm run cleanup:swaps -- cleanup --dry-run --batch-size 100 --max-records 500
```

### Programmatic Usage

```typescript
import { Pool } from 'pg';
import { SwapDataValidationService } from '../utils/swapDataValidation';
import { SwapDataCleanupService } from '../utils/swapDataCleanup';

const pool = new Pool(/* database config */);
const validationService = new SwapDataValidationService(pool);
const cleanupService = new SwapDataCleanupService(pool);

// Validate data integrity
const report = await validationService.generateValidationReport();
console.log(`Found ${report.summary.selfProposalsFound} self-proposals`);

// Perform cleanup with backup
const result = await cleanupService.removeSelfProposals({
  dryRun: false,
  createBackup: true,
  batchSize: 50,
  skipConfirmation: true
});

console.log(`Cleaned up ${result.summary.selfProposalsRemoved} self-proposals`);
```

## Safety Features

### Backup Creation
- Automatic backup creation before cleanup operations
- Backup tables include timestamp and reason
- Backup data preserved for recovery if needed

### Dry Run Mode
- Test cleanup operations without making changes
- See exactly what would be modified
- Validate logic before actual execution

### Batch Processing
- Process records in configurable batches
- Prevent memory issues with large datasets
- Allow for interruption and resumption

### Comprehensive Logging
- All operations logged to database tables
- Audit trail for compliance and debugging
- Performance metrics and error tracking

## Database Functions

The utilities leverage database functions created in migration `020_add_self_exclusion_query_indexes.sql`:

- `validate_self_exclusion_data()`: Validates data integrity
- `analyze_self_exclusion_query_performance()`: Analyzes query performance
- `test_self_exclusion_query_performance()`: Tests query performance

## Error Handling

### Validation Errors
- Non-blocking validation continues on individual record errors
- Comprehensive error reporting with context
- Severity levels (HIGH, MEDIUM, LOW) for prioritization

### Cleanup Errors
- Transactional cleanup operations where possible
- Rollback on critical failures
- Detailed error logging with recovery suggestions

### Recovery Procedures
- Backup restoration procedures documented
- Manual verification steps provided
- Data consistency checks after operations

## Performance Considerations

### Indexing
- Specialized indexes for self-exclusion queries
- Composite indexes for common query patterns
- Performance monitoring functions included

### Batch Processing
- Configurable batch sizes (default: 50 records)
- Memory-efficient processing for large datasets
- Progress tracking and resumption capabilities

### Query Optimization
- Single-query approaches where possible
- Efficient JOIN patterns with proper filtering
- Database statistics updates after operations

## Monitoring and Reporting

### Operation Logs
- All operations logged with timestamps
- Performance metrics captured
- Success/failure status tracking

### Audit Trail
- Complete audit trail for compliance
- User attribution for operations
- Detailed operation parameters logged

### Reports
- Summary reports with trends analysis
- Export capabilities (JSON, CSV)
- Historical operation tracking

## Requirements Compliance

This implementation addresses the following requirements:

- **3.4**: Data integrity validation and inconsistency detection
- **3.5**: Query performance optimization and data integrity assurance

### Validation Requirements (3.4)
✅ Functions to detect existing self-proposals  
✅ Validation methods to ensure data integrity  
✅ Utilities to identify and report data inconsistencies  

### Cleanup Requirements (3.4)
✅ Scripts to identify existing self-proposals  
✅ Safe cleanup procedures for invalid data  
✅ Logging and reporting for cleanup operations  

### Performance Requirements (3.5)
✅ Database indexes for query optimization  
✅ Performance monitoring and analysis  
✅ Efficient batch processing capabilities  

## Best Practices

1. **Always run validation first** to understand the scope of issues
2. **Use dry-run mode** before executing actual cleanup operations
3. **Create backups** for any non-trivial cleanup operations
4. **Monitor performance** during large cleanup operations
5. **Verify results** after cleanup to ensure data integrity
6. **Review logs** for any errors or warnings that need attention

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure database user has necessary permissions
2. **Memory Issues**: Reduce batch size for large datasets
3. **Timeout Issues**: Increase query timeout for large operations
4. **Lock Conflicts**: Run cleanup during low-traffic periods

### Recovery Procedures

1. **Restore from Backup**: Use backup tables created during cleanup
2. **Manual Verification**: Run validation queries to check data consistency
3. **Incremental Cleanup**: Process smaller batches if full cleanup fails
4. **Database Maintenance**: Run ANALYZE after large cleanup operations

## Support

For issues or questions about these utilities:

1. Check the logs in `swap_cleanup_logs` table
2. Run validation reports to identify specific issues
3. Use dry-run mode to test operations safely
4. Review the audit trail in `swap_cleanup_audit_logs` table