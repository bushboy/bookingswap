# Design Document

## Overview

The booking swap management system enables users to create, manage, and exchange bookings through a comprehensive web interface. The system builds upon the existing React/Redux architecture and integrates with the Hedera blockchain for secure transaction processing. The design focuses on user experience, data integrity, and real-time updates through WebSocket connections.

## Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit with RTK Query for API calls
- **Routing**: React Router v6 with future flags enabled
- **Styling**: Design system tokens with CSS-in-JS approach
- **Real-time Updates**: WebSocket integration for live notifications

### Backend Integration
- **API Communication**: Axios-based services with centralized error handling
- **Authentication**: JWT token-based authentication with wallet integration
- **Data Validation**: Joi schemas from shared package
- **Blockchain Integration**: Hedera Wallet Connect for transaction signing

### State Management Structure
```
store/
├── slices/
│   ├── bookingsSlice.ts (enhanced)
│   ├── swapsSlice.ts (enhanced)
│   └── uiSlice.ts (modal/loading states)
├── thunks/
│   ├── bookingThunks.ts (new)
│   └── swapThunks.ts (new)
└── services/
    ├── bookingService.ts (new)
    └── swapService.ts (new)
```

## Components and Interfaces

### Core Components

#### 1. Booking Management Components
```typescript
// BookingList - Display user's bookings with filtering
interface BookingListProps {
  bookings: Booking[];
  onEdit: (booking: Booking) => void;
  onDelete: (bookingId: string) => void;
  onCreateSwap: (booking: Booking) => void;
}

// BookingForm - Create/edit booking modal
interface BookingFormProps {
  booking?: Booking;
  onSubmit: (bookingData: CreateBookingRequest) => void;
  onCancel: () => void;
}

// BookingCard - Individual booking display
interface BookingCardProps {
  booking: Booking;
  variant: 'own' | 'browse' | 'swap';
  onAction: (action: string, booking: Booking) => void;
}
```

#### 2. Swap Management Components
```typescript
// SwapCreationForm - Create booking or cash swap
interface SwapCreationFormProps {
  booking: Booking;
  onSubmit: (swapData: CreateSwapRequest | CreateCashSwapRequest) => void;
  onCancel: () => void;
}

// SwapProposalForm - Create swap proposal (booking or cash)
interface SwapProposalFormProps {
  swap: SwapWithBookings;
  userBookings: Booking[];
  paymentMethods: PaymentMethod[];
  onSubmit: (proposalData: BookingProposalData | CashProposalData) => void;
  onCancel: () => void;
}

// SwapCard - Display swap with booking(s) and cash details
interface SwapCardProps {
  swap: SwapWithBookings;
  userRole: 'proposer' | 'owner';
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onPayment?: (proposalId: string) => void;
}

// CashSwapCard - Specialized card for cash swaps
interface CashSwapCardProps {
  swap: SwapWithBookings;
  cashDetails: CashSwapDetails;
  onMakeOffer: () => void;
  onViewOffers: () => void;
}

// PaymentForm - Handle payment processing
interface PaymentFormProps {
  proposal: SwapProposal;
  paymentMethods: PaymentMethod[];
  onSubmit: (paymentData: PaymentRequest) => void;
  onCancel: () => void;
}

// SwapTimeline - Show swap progress including payments
interface SwapTimelineProps {
  swap: SwapWithBookings;
  events: SwapEvent[];
  showPaymentDetails?: boolean;
}
```

#### 3. Discovery Components
```typescript
// BookingBrowser - Browse available bookings with enhanced filtering
interface BookingBrowserProps {
  filters: BookingFilters;
  onFilterChange: (filters: BookingFilters) => void;
  onBookingSelect: (booking: Booking) => void;
  currentUserId: string; // For filtering out user's own bookings
}

// FilterPanel - Advanced filtering options
interface FilterPanelProps {
  filters: BookingFilters;
  onChange: (filters: BookingFilters) => void;
  onReset: () => void;
}

// SwapBrowser - Browse available swaps with strict filtering
interface SwapBrowserProps {
  filters: SwapFilters;
  onFilterChange: (filters: SwapFilters) => void;
  onSwapSelect: (swap: SwapWithBookings) => void;
  currentUserId: string; // For filtering out user's own swaps
}
```

### Service Layer

#### BookingService
```typescript
class BookingService {
  // CRUD operations
  async getBookings(filters?: BookingFilters): Promise<Booking[]>
  async getBooking(id: string): Promise<Booking>
  async createBooking(data: CreateBookingRequest): Promise<Booking>
  async updateBooking(id: string, data: UpdateBookingRequest): Promise<Booking>
  async deleteBooking(id: string): Promise<void>
  
  // Search and discovery with enhanced filtering
  async searchBookings(query: SearchQuery): Promise<BookingSearchResult>
  async getAvailableBookings(filters: BookingFilters): Promise<Booking[]>
  async getBrowsableSwaps(filters: SwapFilters, currentUserId: string): Promise<SwapWithBookings[]>
  
  // Validation
  async validateBooking(data: CreateBookingRequest): Promise<ValidationResult>
  
  // Filtering logic
  private filterBrowsableSwaps(swaps: SwapWithBookings[], currentUserId: string): SwapWithBookings[]
}
```

#### SwapService
```typescript
class SwapService {
  // Swap lifecycle
  async createSwap(data: CreateSwapRequest): Promise<Swap>
  async createCashSwap(data: CreateCashSwapRequest): Promise<Swap>
  async getSwaps(userId: string): Promise<SwapWithBookings[]>
  async getSwap(id: string): Promise<SwapWithBookings>
  async acceptSwap(id: string): Promise<Swap>
  async rejectSwap(id: string, reason?: string): Promise<Swap>
  async cancelSwap(id: string): Promise<Swap>
  
  // Proposals
  async createBookingProposal(swapId: string, data: BookingProposalData): Promise<SwapProposal>
  async createCashProposal(swapId: string, data: CashProposalData): Promise<SwapProposal>
  async getProposals(swapId: string): Promise<SwapProposal[]>
  
  // Payment processing
  async initiatePayment(proposalId: string): Promise<PaymentTransaction>
  async confirmPayment(transactionId: string): Promise<PaymentTransaction>
  async refundPayment(transactionId: string, reason: string): Promise<PaymentTransaction>
  
  // Status tracking
  async getSwapHistory(swapId: string): Promise<SwapEvent[]>
}

#### PaymentService
```typescript
class PaymentService {
  // Payment methods
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]>
  async addPaymentMethod(data: AddPaymentMethodRequest): Promise<PaymentMethod>
  async verifyPaymentMethod(methodId: string): Promise<PaymentMethod>
  async removePaymentMethod(methodId: string): Promise<void>
  
  // Escrow management
  async createEscrow(amount: number, currency: string): Promise<EscrowAccount>
  async releaseEscrow(escrowId: string, recipientId: string): Promise<void>
  async refundEscrow(escrowId: string): Promise<void>
  
  // Transaction processing
  async processPayment(data: PaymentRequest): Promise<PaymentTransaction>
  async getTransactionStatus(transactionId: string): Promise<PaymentTransaction>
  async generateReceipt(transactionId: string): Promise<Receipt>
}
```

## Browsing Filter Logic

### Swap Browsing Restrictions

The system implements strict filtering rules when users browse available swaps to ensure a clean and relevant browsing experience:

#### Filter Implementation
```typescript
interface SwapBrowsingFilters {
  // Core filtering rules
  excludeOwnSwaps: boolean; // Always true - users cannot see their own swaps
  excludeCancelledBookings: boolean; // Always true - cancelled bookings are hidden
  requireActiveProposals: boolean; // Always true - only show swaps with proposals
  
  // Additional filters
  location?: LocationFilter;
  dateRange?: DateRangeFilter;
  priceRange?: PriceRangeFilter;
  swapType?: 'booking' | 'cash' | 'both';
}

class SwapFilterService {
  /**
   * Applies core browsing restrictions that cannot be disabled
   */
  applyCoreBrowsingFilters(swaps: SwapWithBookings[], currentUserId: string): SwapWithBookings[] {
    return swaps.filter(swap => {
      // Rule 1: Exclude user's own swaps
      if (swap.owner.id === currentUserId) {
        return false;
      }
      
      // Rule 2: Exclude cancelled bookings
      if (swap.sourceBooking.status === 'cancelled') {
        return false;
      }
      
      // Rule 3: Only show swaps that have active proposals
      if (!swap.hasActiveProposals) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Applies user-configurable filters on top of core restrictions
   */
  applyUserFilters(swaps: SwapWithBookings[], filters: SwapFilters): SwapWithBookings[] {
    return swaps.filter(swap => {
      // Apply location filters
      if (filters.location && !this.matchesLocationFilter(swap.sourceBooking, filters.location)) {
        return false;
      }
      
      // Apply date range filters
      if (filters.dateRange && !this.matchesDateFilter(swap.sourceBooking, filters.dateRange)) {
        return false;
      }
      
      // Apply price range filters
      if (filters.priceRange && !this.matchesPriceFilter(swap, filters.priceRange)) {
        return false;
      }
      
      // Apply swap type filters
      if (filters.swapType && filters.swapType !== 'both' && swap.swapType !== filters.swapType) {
        return false;
      }
      
      return true;
    });
  }
}
```

#### Database Query Optimization
```sql
-- Optimized query for browsing swaps with core filters applied at database level
SELECT s.*, b.*, u.* 
FROM swaps s
JOIN bookings b ON s.source_booking_id = b.id
JOIN users u ON s.owner_id = u.id
WHERE s.owner_id != ? -- Exclude user's own swaps
  AND b.status != 'cancelled' -- Exclude cancelled bookings
  AND EXISTS (
    SELECT 1 FROM swap_proposals sp 
    WHERE sp.swap_id = s.id 
    AND sp.status = 'active'
  ) -- Only swaps with active proposals
  AND s.status = 'active'
  AND s.expires_at > NOW()
ORDER BY s.created_at DESC;
```

## Data Models

### Enhanced Booking Model
```typescript
interface BookingFilters {
  type?: BookingType[];
  location?: {
    city?: string;
    country?: string;
    radius?: number; // km from coordinates
  };
  dateRange?: {
    start: Date;
    end: Date;
    flexible?: boolean;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  status?: BookingStatus[];
  verificationStatus?: VerificationStatus[];
}

interface SwapFilters {
  // User-configurable filters
  location?: LocationFilter;
  dateRange?: DateRangeFilter;
  priceRange?: PriceRangeFilter;
  swapType?: 'booking' | 'cash' | 'both';
  
  // Core filters (always applied, not user-configurable)
  readonly excludeOwnSwaps: true;
  readonly excludeCancelledBookings: true;
  readonly requireActiveProposals: true;
}

interface LocationFilter {
  city?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
    radius: number; // km
  };
}

interface DateRangeFilter {
  start: Date;
  end: Date;
  flexible?: boolean;
}

interface PriceRangeFilter {
  min: number;
  max: number;
  currency?: string;
}

interface CreateBookingRequest {
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;
  documents?: File[]; // For verification
}
```

### Enhanced Swap Model
```typescript
interface SwapWithBookings extends Swap {
  sourceBooking: Booking;
  targetBooking?: Booking; // Optional for cash swaps
  proposer: UserProfile;
  owner: UserProfile;
  swapType: 'booking' | 'cash';
  cashDetails?: CashSwapDetails;
  hasActiveProposals: boolean; // Required for browsing filter logic
  activeProposalCount: number; // For display purposes
}

interface CashSwapDetails {
  minAmount: number;
  maxAmount: number;
  preferredAmount?: number;
  currency: string;
  paymentMethods: PaymentMethod[];
  escrowRequired: boolean;
  platformFeePercentage: number;
}

interface SwapProposal {
  id: string;
  swapId: string;
  proposerId: string;
  proposalType: 'booking' | 'cash';
  bookingId?: string; // For booking proposals
  cashOffer?: CashOffer; // For cash proposals
  message?: string;
  conditions: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'payment_processing' | 'completed';
  createdAt: Date;
  respondedAt?: Date;
  paymentDetails?: PaymentTransaction;
}

interface CashOffer {
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentAccountId: string;
  escrowId?: string;
}

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'bank_transfer' | 'digital_wallet' | 'cryptocurrency';
  displayName: string;
  isVerified: boolean;
}

interface PaymentTransaction {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  escrowId?: string;
  gatewayTransactionId: string;
  createdAt: Date;
  completedAt?: Date;
}

interface SwapEvent {
  id: string;
  swapId: string;
  type: 'created' | 'proposed' | 'accepted' | 'rejected' | 'payment_initiated' | 'payment_completed' | 'completed' | 'cancelled' | 'refunded';
  userId: string;
  data: Record<string, any>;
  timestamp: Date;
}
```

## Error Handling

### Error Types
```typescript
interface BookingError {
  code: 'BOOKING_NOT_FOUND' | 'BOOKING_UNAVAILABLE' | 'INVALID_DATES' | 'VERIFICATION_FAILED';
  message: string;
  field?: string;
}

interface SwapError {
  code: 'SWAP_EXPIRED' | 'BOOKING_LOCKED' | 'INSUFFICIENT_PERMISSIONS' | 'INVALID_PROPOSAL';
  message: string;
  swapId?: string;
}

interface PaymentError {
  code: 'PAYMENT_FAILED' | 'INSUFFICIENT_FUNDS' | 'INVALID_PAYMENT_METHOD' | 'ESCROW_ERROR' | 'REFUND_FAILED';
  message: string;
  transactionId?: string;
  gatewayError?: string;
}
```

### Error Handling Strategy
- **Form Validation**: Real-time validation with clear error messages
- **API Errors**: Centralized error handling with user-friendly messages
- **Network Errors**: Retry mechanisms with exponential backoff
- **Payment Errors**: Specific handling for payment gateway failures and refunds
- **Blockchain Errors**: Specific handling for wallet and transaction errors

## Testing Strategy

### Unit Testing
- **Components**: React Testing Library for component behavior
- **Services**: Mock API responses and error scenarios
- **State Management**: Redux slice testing with mock data
- **Utilities**: Pure function testing for validation and formatting

### Integration Testing
- **User Flows**: Complete booking creation and swap workflows
- **API Integration**: Service layer integration with mock backend
- **State Synchronization**: Redux state updates with API calls
- **WebSocket Integration**: Real-time update handling

### E2E Testing
- **Critical Paths**: Booking creation → Swap proposal → Acceptance → Completion
- **Error Scenarios**: Network failures, validation errors, expired swaps
- **Cross-browser**: Chrome, Firefox, Safari compatibility
- **Mobile Responsive**: Touch interactions and responsive layouts

### Performance Testing
- **Component Rendering**: Large booking lists and complex swap displays
- **State Updates**: Frequent WebSocket updates and state changes
- **Memory Usage**: Long-running sessions with many bookings/swaps
- **Bundle Size**: Code splitting and lazy loading optimization

## Security Considerations

### Data Protection
- **Input Sanitization**: All user inputs sanitized before processing
- **XSS Prevention**: Content Security Policy and input validation
- **CSRF Protection**: Token-based request validation
- **Data Encryption**: Sensitive data encrypted in transit and at rest

### Authentication & Authorization
- **Wallet Integration**: Secure wallet connection and signature verification
- **Session Management**: JWT token refresh and expiration handling
- **Permission Checks**: User ownership validation for all operations
- **Rate Limiting**: API call throttling to prevent abuse
- **Payment Authorization**: Multi-factor authentication for high-value transactions

### Financial Security
- **PCI Compliance**: Payment data handled according to PCI DSS standards
- **Escrow Protection**: Funds held securely until transaction completion
- **Payment Gateway Integration**: Use of certified payment processors (Stripe, PayPal)
- **Fraud Detection**: Real-time monitoring for suspicious transactions
- **Refund Protection**: Automated refund mechanisms for failed transactions
- **KYC/AML Compliance**: Know Your Customer and Anti-Money Laundering checks
- **Transaction Limits**: Daily and per-transaction limits for risk management

### Blockchain Security
- **Transaction Validation**: Multi-step verification before blockchain commits
- **Private Key Protection**: Never store or transmit private keys
- **Smart Contract Interaction**: Validated contract calls with proper error handling
- **Immutable Records**: Blockchain-based audit trail for completed swaps

## Performance Optimization

### Frontend Optimization
- **Code Splitting**: Route-based and component-based lazy loading
- **Memoization**: React.memo and useMemo for expensive computations
- **Virtual Scrolling**: Large booking lists with react-window
- **Image Optimization**: Lazy loading and responsive images

### State Management Optimization
- **Normalized State**: Flat state structure for efficient updates
- **Selective Subscriptions**: Component-level state subscriptions
- **Caching Strategy**: RTK Query caching with appropriate TTL
- **Background Sync**: Optimistic updates with background synchronization

### API Optimization
- **Request Batching**: Multiple operations in single API calls
- **Pagination**: Efficient data loading for large datasets
- **Caching Headers**: Proper HTTP caching for static data
- **Compression**: Gzip compression for API responses

## Accessibility

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard accessibility for all interactions
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: Minimum 4.5:1 contrast ratio for all text
- **Focus Management**: Clear focus indicators and logical tab order

### Inclusive Design
- **Responsive Design**: Mobile-first approach with touch-friendly interfaces
- **Internationalization**: Support for multiple languages and locales
- **Reduced Motion**: Respect for prefers-reduced-motion settings
- **High Contrast Mode**: Support for high contrast display preferences