# Implementation Plan

- [x] 1. Create comprehensive data validation and sanitization utilities





  - Implement FinancialDataHandler class with currency formatting and amount validation
  - Create SwapDataValidator class to sanitize and validate complete swap data
  - Add DataConsistencyValidator to check for data integrity issues
  - Implement FallbackDataProvider for graceful error handling
  - _Requirements: 4.1, 4.2, 4.3, 6.4_

- [x] 2. Enhance backend swap data retrieval with unified query





  - Modify SwapProposalService to use comprehensive single-query approach
  - Update getUserSwapsWithTargeting method to fetch complete targeting and proposal data
  - Add proper JOIN queries to get all user names, swap details, and financial information
  - Implement data validation in the service layer before returning to frontend
  - _Requirements: 2.1, 2.2, 5.1, 5.2, 6.1_

- [x] 3. Fix financial data handling to eliminate $NaN displays





  - Update all pricing calculations to handle null/undefined values gracefully
  - Implement proper currency formatting throughout the application
  - Add validation for numeric amounts before performing calculations
  - Create consistent pricing display format across all components
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Remove offline label and clean up swap card UI elements




  - Remove "Offline" label from swap card components
  - Clean up unnecessary status indicators and hover tooltips
  - Simplify swap card layout to focus on essential information
  - Update CSS and component structure to remove obsolete elements
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Replace non-functional proposals section with accurate targeting display





  - Remove or replace the "proposals from others" section that shows "No Proposals"
  - Implement accurate targeting count display using database data
  - Create clear visual indicators for incoming proposals
  - Ensure targeting information is consistent with the top-level count display
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Implement complete proposal details for accept/reject decisions








  - Create comprehensive proposal detail components showing all pertinent information
  - Add proposer name, swap details, and proposed terms to proposal displays
  - Implement clear accept/reject action buttons with proper context
  - Ensure all proposal information is fetched and displayed accurately
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Fix swap details popup to show accurate information





  - Update swap details popup to use validated financial data
  - Implement proper error handling for missing or invalid data
  - Add complete proposal information display in popup
  - Ensure consistent data display between card and popup views
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_

- [x] 8. Ensure data consistency across all display elements





  - Implement unified data source for all swap card elements
  - Add data synchronization to ensure all UI elements update together
  - Create consistency validation to detect and log data discrepancies
  - Test and verify that all display elements show the same underlying data
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Add comprehensive testing for data accuracy












  - Write unit tests for financial data validation and sanitization
  - Create integration tests for complete data flow from database to UI
  - Add edge case testing for null/undefined values and corrupted data
  - Implement UI component tests for all display scenarios
  - _Requirements: All requirements validation_