# Implementation Plan

- [x] 1. Create enhanced data types and interfaces





  - Define SwapWithBookingDetails interface extending the base Swap interface
  - Define BookingDetails interface with location, dateRange, and pricing fields
  - Add type definitions to shared types package for frontend/backend consistency
  - _Requirements: 1.1, 2.2, 2.3_

- [x] 2. Implement enhanced SwapRepository method





  - [x] 2.1 Create findByUserIdWithBookingDetails method in SwapRepository


    - Write SQL query with LEFT JOINs to combine swaps and bookings tables
    - Map database rows to SwapWithBookingDetails entities
    - Handle null booking cases gracefully
    - _Requirements: 1.1, 3.1, 3.3_
  
  - [x] 2.2 Add mapRowToSwapWithBookingDetails helper method

    - Transform joined database rows into structured booking details
    - Format location as "city, country" structure
    - Parse date ranges and monetary amounts correctly
    - _Requirements: 1.2, 2.1, 2.2, 2.3_
  
  - [ ]* 2.3 Write unit tests for new repository method
    - Test with various user scenarios (proposer vs owner)
    - Test with missing booking details
    - Test pagination and limits
    - _Requirements: 3.3_

- [x] 3. Update SwapProposalService layer





  - [x] 3.1 Add getUserSwapProposalsWithBookingDetails method


    - Call the new repository method
    - Apply business logic transformations
    - Handle errors gracefully with fallback data
    - _Requirements: 1.1, 3.3_
  

  - [x] 3.2 Maintain backward compatibility

    - Keep existing getUserSwapProposals method unchanged
    - Ensure existing functionality continues to work
    - _Requirements: 3.3_
  
  - [ ]* 3.3 Write unit tests for service enhancements
    - Test service method with mocked repository responses
    - Test error handling scenarios
    - _Requirements: 3.3_

- [x] 4. Update SwapController endpoint





  - [x] 4.1 Modify getUserSwaps method to use enhanced service


    - Replace call to getUserSwapProposals with getUserSwapProposalsWithBookingDetails
    - Update response formatting to include booking details
    - Add performance logging for monitoring
    - _Requirements: 1.1, 1.2, 3.4_
  
  - [x] 4.2 Enhance error handling in controller


    - Handle cases where booking details are partially available
    - Provide meaningful error messages for debugging
    - Maintain consistent API response format
    - _Requirements: 1.4, 3.3_
  
  - [ ]* 4.3 Write integration tests for controller changes
    - Test complete API endpoint with real database
    - Test various error scenarios
    - Verify response format matches expected structure
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 5. Update frontend SwapsPage component





  - [x] 5.1 Remove client-side booking enrichment logic


    - Delete enrichSwapsWithBookingDetails method
    - Remove redundant booking detail fetching code
    - Simplify loadSwaps method to use backend-provided data
    - _Requirements: 1.1, 2.1_
  
  - [x] 5.2 Update data transformation logic


    - Simplify swap data mapping since booking details come from backend
    - Ensure consistent formatting of location, dates, and amounts
    - Handle cases where booking details might be null
    - _Requirements: 1.2, 2.1, 2.2, 2.3_
  
  - [x] 5.3 Improve error handling and loading states


    - Display appropriate fallback text for missing booking details
    - Show loading indicators during data fetch
    - Handle partial data scenarios gracefully
    - _Requirements: 1.4, 3.3_

- [x] 6. Add comprehensive error handling





  - [x] 6.1 Implement database-level error handling


    - Handle missing or soft-deleted bookings
    - Ensure queries don't fail when booking data is incomplete
    - Log appropriate warnings for debugging
    - _Requirements: 1.4, 3.3_
  
  - [x] 6.2 Add service-level fallback mechanisms


    - Provide default values for missing booking information
    - Maintain partial functionality when some data is unavailable
    - Include metadata about data completeness in responses
    - _Requirements: 1.4, 3.3_

- [x] 7. Performance optimization and monitoring







  - [x] 7.1 Optimize database query performance


    - Add appropriate database indexes if needed
    - Analyze query execution plan for efficiency
    - Ensure response times meet 2-second requirement
    - _Requirements: 3.1, 3.4_
  
  - [x] 7.2 Add performance monitoring


    - Log query execution times
    - Monitor API response times
    - Add metrics for booking detail retrieval success rates
    - _Requirements: 3.4_

- [x] 8. Integration testing and validation





  - [x] 8.1 Test complete user flow


    - Verify booking details display correctly in frontend
    - Test various swap states and booking combinations
    - Ensure consistent formatting across different scenarios
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_
  
  - [x] 8.2 Validate data consistency

    - Compare displayed data with browse swaps page formatting
    - Verify location, date, and amount formatting consistency
    - Test edge cases like missing or incomplete booking data
    - _Requirements: 2.1, 2.2, 2.3, 1.4_