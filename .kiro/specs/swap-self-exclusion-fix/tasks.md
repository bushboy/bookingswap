# Implementation Plan

- [x] 1. Analyze current data structure and identify self-proposal locations





  - Examine the current database schema for swaps and proposals tables
  - Identify the specific queries and endpoints that return swap card data
  - Document the current data flow from database to frontend components
  - _Requirements: 3.1, 3.2_
-

- [x] 2. Implement database-level filtering for self-proposals




  - [x] 2.1 Update proposal repository query methods


    - Modify existing queries to exclude proposals where proposer_id equals swap owner_id
    - Add proper WHERE clauses to filter out self-proposals at the database level
    - Ensure all proposal retrieval methods include the self-exclusion filter
    - _Requirements: 3.1, 3.4_
  
  - [x] 2.2 Create optimized query for swap cards with proposals




    - Write a single optimized query that joins swaps, proposals, bookings, and users
    - Include the critical filter to exclude self-proposals in the JOIN condition
    - Ensure the query returns properly structured data for frontend consumption
    - _Requirements: 3.1, 3.3, 3.5_
  
  - [ ] 2.3 Add database indexes for query optimization






    - Create composite indexes on swap_proposals table for efficient filtering
    - Add indexes on swaps table for owner_id lookups
    - Analyze query performance and optimize as needed
    - _Requirements: 3.5_

- [x] 3. Update service layer to handle filtered proposal data





  - [x] 3.1 Modify swap service methods


    - Update getUserSwapsWithProposals method to use the new filtered queries
    - Implement proper data grouping to organize proposals by swap ID
    - Add validation layer to catch any remaining self-proposals
    - _Requirements: 3.2, 3.4_
  
  - [x] 3.2 Implement data structure transformation


    - Create methods to transform database results into SwapCardData structure
    - Ensure proper separation between user's swap data and proposals from others
    - Handle cases where swaps have zero proposals from other users
    - _Requirements: 1.1, 2.2, 3.2_
  
  - [ ]* 3.3 Add service-level validation and logging
    - Implement validation to detect and log any self-proposals that slip through
    - Add monitoring for data inconsistencies
    - Create warning logs for debugging purposes
    - _Requirements: 3.4_

- [x] 4. Update API controller endpoints





  - [x] 4.1 Modify swap controller methods


    - Update the endpoint that serves swap card data to use the enhanced service methods
    - Ensure proper error handling for edge cases
    - Add response metadata including proposal counts
    - _Requirements: 1.1, 2.1, 3.2_
  
  - [x] 4.2 Enhance API response structure


    - Structure the API response to clearly separate user swaps from proposals
    - Include proposal count information for each swap
    - Ensure consistent data format for frontend consumption
    - _Requirements: 1.1, 2.4_
  
  - [ ]* 4.3 Add API-level validation and error handling
    - Implement additional validation layer in the controller
    - Add proper error responses for data inconsistency scenarios
    - Include debugging information in development mode
    - _Requirements: 3.4_

- [x] 5. Update frontend components to handle clean data structure





  - [x] 5.1 Modify SwapCard component










    - Update the component to expect the new SwapCardData structure
    - Ensure proper display of user's swap on the left side
    - Handle display of multiple proposals from others on the right side
    - _Requirements: 1.1, 1.2, 2.3_
  
  - [x] 5.2 Update swap data fetching logic


    - Modify the API calls to use the updated endpoint structure
    - Remove any client-side filtering that's now handled by the backend
    - Simplify data transformation since filtering is done server-side
    - _Requirements: 1.1, 2.1_
  
  - [x] 5.3 Enhance empty state handling


    - Implement proper display for swaps with no proposals from others
    - Show appropriate messaging when no valid proposals exist
    - Ensure clear visual distinction between user's swap and proposals section
    - _Requirements: 2.2, 2.4_

- [x] 6. Add data validation and cleanup mechanisms





  - [x] 6.1 Create data validation utilities


    - Implement functions to detect existing self-proposals in the database
    - Create validation methods to ensure data integrity
    - Add utilities to identify and report data inconsistencies
    - _Requirements: 3.4, 3.5_
  
  - [x] 6.2 Implement data cleanup procedures


    - Create scripts to identify any existing self-proposals in the database
    - Implement safe cleanup procedures for invalid data
    - Add logging and reporting for cleanup operations
    - _Requirements: 3.4_
  
  - [ ]* 6.3 Add database constraints to prevent future self-proposals
    - Implement database-level constraints to prevent self-proposal creation
    - Add validation at the proposal creation endpoint
    - Ensure data integrity at multiple levels
    - _Requirements: 3.4, 3.5_

- [x] 7. Testing and validation





  - [x] 7.1 Test the complete data flow


    - Verify that self-proposals are filtered out at the database level
    - Test with multiple proposals per swap scenario
    - Ensure proper display of user swaps and proposals from others
    - _Requirements: 1.1, 1.2, 2.3, 2.5_
  
  - [x] 7.2 Validate edge cases and error scenarios

    - Test with swaps that have no proposals from others
    - Test with users who have multiple swaps with various proposal states
    - Verify proper handling of data inconsistencies
    - _Requirements: 2.2, 3.4_
  
  - [ ]* 7.3 Performance testing and optimization
    - Test query performance with large datasets
    - Verify that database indexes are being used effectively
    - Measure API response times and optimize if needed
    - _Requirements: 3.5_

- [x] 8. Integration testing and deployment validation






  - [x] 8.1 End-to-end testing

    - Test the complete user flow from frontend to database
    - Verify that swap cards display correctly with the fixed data
    - Ensure no self-proposals appear in any scenario
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3_
  
  - [x] 8.2 Cross-browser and device testing


    - Test the updated swap card display across different browsers
    - Verify proper responsive behavior with multiple proposals
    - Ensure consistent user experience across platforms
    - _Requirements: 1.1, 2.3_