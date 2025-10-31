# Requirements Document

## Introduction

The booking system currently has a mismatch between the booking types available in the frontend dropdown and what the backend API accepts. Users report that only "hotel" bookings are accepted by the API, despite the dropdown showing multiple accommodation types (hotel, vacation_rental, resort, hostel, bnb). This creates a poor user experience where users can select booking types that will be rejected during submission.

## Glossary

- **Booking System**: The application component responsible for creating and managing booking listings
- **Frontend Dropdown**: The user interface element that displays available booking type options
- **Backend API**: The server-side validation and processing system for booking requests
- **Booking Type**: The category of accommodation (hotel, vacation_rental, resort, hostel, bnb)
- **Validation Schema**: The backend rules that determine which booking types are acceptable

## Requirements

### Requirement 1

**User Story:** As a user creating a booking, I want all booking types shown in the dropdown to be accepted by the API, so that I don't encounter validation errors after filling out the form.

#### Acceptance Criteria

1. WHEN a user selects "hotel" from the booking type dropdown, THE Booking System SHALL accept and process the booking successfully
2. WHEN a user selects "vacation_rental" from the booking type dropdown, THE Booking System SHALL accept and process the booking successfully  
3. WHEN a user selects "resort" from the booking type dropdown, THE Booking System SHALL accept and process the booking successfully
4. WHEN a user selects "hostel" from the booking type dropdown, THE Booking System SHALL accept and process the booking successfully
5. WHEN a user selects "bnb" from the booking type dropdown, THE Booking System SHALL accept and process the booking successfully

### Requirement 2

**User Story:** As a developer, I want consistent validation between frontend and backend, so that the system maintains data integrity and provides clear error messages.

#### Acceptance Criteria

1. THE Frontend Dropdown SHALL display only booking types that are enabled in the backend validation schema
2. THE Backend API SHALL accept all booking types that are displayed in the frontend dropdown
3. IF a booking type is disabled, THEN THE Frontend Dropdown SHALL not display that booking type as an option
4. WHEN the backend receives an invalid booking type, THE Booking System SHALL return a clear error message indicating which types are supported

### Requirement 3

**User Story:** As a system administrator, I want to easily enable or disable booking types across the entire system, so that I can control which accommodation types are available.

#### Acceptance Criteria

1. WHEN booking types are updated in the validation schema, THE Frontend Dropdown SHALL automatically reflect the same available types
2. THE Booking System SHALL maintain a single source of truth for enabled booking types
3. WHEN a booking type is disabled, THE Booking System SHALL prevent new bookings of that type while preserving existing bookings
4. THE Booking System SHALL provide clear documentation on how to enable or disable booking types