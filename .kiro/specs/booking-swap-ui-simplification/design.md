# Design Document

## Overview

The booking swap UI simplification redesigns the user experience by integrating swap functionality directly into booking creation and listing views. This eliminates the current multi-step workflow where users must separately create bookings and then create swap proposals. The new design provides a unified interface that reduces friction and makes swap opportunities more discoverable.

The solution builds upon the existing React/Redux architecture while introducing new integrated components and enhanced state management to support the streamlined workflow.

## Architecture

### Component Architecture Changes

The design introduces a unified component hierarchy that merges booking and swap functionality:

```
BookingManagement/
├── UnifiedBookingForm (new)
│   ├── BookingDetailsSection
│   ├── SwapPreferencesSection (new)
│   └── ValidationSummary
├── EnhancedBookingListings (enhanced)
│   ├── BookingCard (enhanced with swap actions)
│   ├── SwapActionPanel (new)
│   └── InlineProposalForm (new)
└── IntegratedFilterPanel (enhanced)
    ├── BookingFilters
    └── SwapFilters (integrated)
```

### State Management Enhancement

Enhanced Redux store structure to support integrated booking-swap operations:

```typescript
interface AppState {
  bookings: {
    items: Booking[];
    filters: EnhancedBookingFilters;
    loading: boolean;
    error: string | null;
  };
  swaps: {
    items: SwapWithBookings[];
    proposals: SwapProposal[];
    loading: boolean;
    error: string | null;
  };
  ui: {
    activeBookingForm: {
      isOpen: boolean;
      mode: 'create' | 'edit';
      bookingId?: string;
      swapEnabled: boolean; // New field
    };
    inlineProposals: {
      [bookingId: string]: {
        isOpen: boolean;
        proposalType: 'booking' | 'cash';
        loading: boolean;
      };
    };
    filters: {
      showSwappableOnly: boolean;
      showCashAccepting: boolean;
      showAuctions: boolean;
    };
  };
}
```

## Components and Interfaces

### Core New Components

#### 1. UnifiedBookingForm
Replaces the existing BookingForm with integrated swap preferences:

```typescript
interface UnifiedBookingFormProps {
  booking?: Booking;
  onSubmit: (data: UnifiedBookingData) => void;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

interface UnifiedBookingData {
  // Existing booking fields
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  providerDetails: BookingProviderDetails;
  
  // New integrated swap fields
  swapEnabled: boolean;
  swapPreferences?: {
    paymentTypes: ('booking' | 'cash')[];
    minCashAmount?: number;
    acceptanceStrategy: 'first-match' | 'auction';
    auctionEndDate?: Date;
    swapConditions: string[];
  };
}

// Component implementation
const UnifiedBookingForm: React.FC<UnifiedBookingFormProps> = ({
  booking,
  onSubmit,
  onCancel,
  mode
}) => {
  const [formData, setFormData] = useState<UnifiedBookingData>(
    booking ? mapBookingToFormData(booking) : getDefaultFormData()
  );
  const [swapEnabled, setSwapEnabled] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const handleSwapToggle = (enabled: boolean) => {
    setSwapEnabled(enabled);
    if (!enabled) {
      setFormData(prev => ({ ...prev, swapPreferences: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors = validateBookingData(formData);
    if (swapEnabled && formData.swapPreferences) {
      Object.assign(errors, validateSwapPreferences(formData.swapPreferences));
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  return (
    <Modal isOpen onClose={onCancel} size="large">
      <form onSubmit={handleSubmit}>
        <BookingDetailsSection
          data={formData}
          onChange={setFormData}
          errors={validationErrors}
        />
        
        <SwapPreferencesSection
          enabled={swapEnabled}
          onToggle={handleSwapToggle}
          preferences={formData.swapPreferences}
          onChange={(prefs) => setFormData(prev => ({ ...prev, swapPreferences: prefs }))}
          errors={validationErrors}
          eventDate={formData.dateRange.start}
        />
        
        <ValidationSummary errors={validationErrors} />
        
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {mode === 'create' ? 'Create Booking' : 'Update Booking'}
            {swapEnabled && ' & Enable Swapping'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
```

#### 2. SwapPreferencesSection
Collapsible section within the booking form for swap settings:

```typescript
interface SwapPreferencesSectionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  preferences?: SwapPreferences;
  onChange: (preferences: SwapPreferences) => void;
  errors: ValidationErrors;
  eventDate: Date;
}

const SwapPreferencesSection: React.FC<SwapPreferencesSectionProps> = ({
  enabled,
  onToggle,
  preferences,
  onChange,
  errors,
  eventDate
}) => {
  const isLastMinute = isWithinOneWeek(eventDate);
  
  return (
    <div className="swap-preferences-section">
      <div className="section-header">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Make available for swapping
        </label>
        <Tooltip content="Allow other users to propose swaps for this booking">
          <InfoIcon />
        </Tooltip>
      </div>
      
      {enabled && (
        <div className="preferences-content">
          <PaymentTypeSelector
            selected={preferences?.paymentTypes || ['booking']}
            onChange={(types) => onChange({ ...preferences, paymentTypes: types })}
            error={errors.paymentTypes}
          />
          
          {preferences?.paymentTypes.includes('cash') && (
            <CashAmountInput
              value={preferences.minCashAmount}
              onChange={(amount) => onChange({ ...preferences, minCashAmount: amount })}
              error={errors.minCashAmount}
            />
          )}
          
          <AcceptanceStrategySelector
            selected={preferences?.acceptanceStrategy || 'first-match'}
            onChange={(strategy) => onChange({ ...preferences, acceptanceStrategy: strategy })}
            disabled={isLastMinute}
            eventDate={eventDate}
            error={errors.acceptanceStrategy}
          />
          
          {preferences?.acceptanceStrategy === 'auction' && !isLastMinute && (
            <AuctionEndDatePicker
              value={preferences.auctionEndDate}
              onChange={(date) => onChange({ ...preferences, auctionEndDate: date })}
              minDate={new Date()}
              maxDate={subWeeks(eventDate, 1)}
              error={errors.auctionEndDate}
            />
          )}
          
          <SwapConditionsInput
            value={preferences?.swapConditions || []}
            onChange={(conditions) => onChange({ ...preferences, swapConditions: conditions })}
            error={errors.swapConditions}
          />
        </div>
      )}
    </div>
  );
};
```

#### 3. EnhancedBookingCard
Enhanced booking card with integrated swap actions:

```typescript
interface EnhancedBookingCardProps {
  booking: Booking;
  swapInfo?: SwapWithBookings;
  userRole: 'owner' | 'browser' | 'proposer';
  onViewDetails: (booking: Booking) => void;
  onMakeProposal?: (booking: Booking) => void;
  onManageSwap?: (swap: SwapWithBookings) => void;
  onEditBooking?: (booking: Booking) => void;
}

const EnhancedBookingCard: React.FC<EnhancedBookingCardProps> = ({
  booking,
  swapInfo,
  userRole,
  onViewDetails,
  onMakeProposal,
  onManageSwap,
  onEditBooking
}) => {
  const [showProposalForm, setShowProposalForm] = useState(false);
  
  return (
    <Card className={`booking-card ${userRole}`}>
      <div className="booking-header">
        <h3>{booking.title}</h3>
        <SwapStatusBadge swapInfo={swapInfo} />
      </div>
      
      <div className="booking-content">
        <BookingDetails booking={booking} compact />
        
        {swapInfo && (
          <SwapInfoPanel
            swapInfo={swapInfo}
            userRole={userRole}
            compact
          />
        )}
      </div>
      
      <div className="booking-actions">
        {userRole === 'owner' && (
          <OwnerActions
            booking={booking}
            swapInfo={swapInfo}
            onEdit={onEditBooking}
            onManageSwap={onManageSwap}
          />
        )}
        
        {userRole === 'browser' && swapInfo && (
          <BrowserActions
            booking={booking}
            swapInfo={swapInfo}
            onMakeProposal={() => setShowProposalForm(true)}
            onViewDetails={onViewDetails}
          />
        )}
        
        {userRole === 'proposer' && (
          <ProposerActions
            booking={booking}
            swapInfo={swapInfo}
            onViewProposal={() => onViewDetails(booking)}
          />
        )}
      </div>
      
      {showProposalForm && (
        <InlineProposalForm
          booking={booking}
          swapInfo={swapInfo!}
          onSubmit={handleProposalSubmit}
          onCancel={() => setShowProposalForm(false)}
        />
      )}
    </Card>
  );
};
```

#### 4. InlineProposalForm
Inline form for making swap proposals directly from listings:

```typescript
interface InlineProposalFormProps {
  booking: Booking;
  swapInfo: SwapWithBookings;
  onSubmit: (proposal: ProposalData) => void;
  onCancel: () => void;
}

const InlineProposalForm: React.FC<InlineProposalFormProps> = ({
  booking,
  swapInfo,
  onSubmit,
  onCancel
}) => {
  const [proposalType, setProposalType] = useState<'booking' | 'cash'>('booking');
  const [selectedBooking, setSelectedBooking] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<number>(swapInfo.cashDetails?.minAmount || 0);
  const [message, setMessage] = useState('');
  
  const { data: userBookings } = useGetUserBookingsQuery();
  const availableBookings = userBookings?.filter(b => 
    b.status === 'available' && b.id !== booking.id
  ) || [];

  const canMakeCashProposal = swapInfo.swapType === 'cash' || 
    (swapInfo.cashDetails && swapInfo.paymentTypes.includes('cash'));
  
  const canMakeBookingProposal = swapInfo.paymentTypes.includes('booking');

  return (
    <div className="inline-proposal-form">
      <div className="form-header">
        <h4>Make a Proposal</h4>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <CloseIcon />
        </Button>
      </div>
      
      {(canMakeBookingProposal && canMakeCashProposal) && (
        <ProposalTypeSelector
          selected={proposalType}
          onChange={setProposalType}
          options={[
            { value: 'booking', label: 'Swap with my booking', disabled: availableBookings.length === 0 },
            { value: 'cash', label: 'Make cash offer', disabled: false }
          ]}
        />
      )}
      
      {proposalType === 'booking' && (
        <BookingSelector
          bookings={availableBookings}
          selected={selectedBooking}
          onChange={setSelectedBooking}
          targetBooking={booking}
        />
      )}
      
      {proposalType === 'cash' && (
        <CashOfferInput
          amount={cashAmount}
          onChange={setCashAmount}
          minAmount={swapInfo.cashDetails?.minAmount || 0}
          maxAmount={swapInfo.cashDetails?.maxAmount}
          currency="USD"
        />
      )}
      
      <MessageInput
        value={message}
        onChange={setMessage}
        placeholder="Add a message to your proposal (optional)"
        maxLength={500}
      />
      
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit}
          disabled={!isValidProposal()}
        >
          Send Proposal
        </Button>
      </div>
    </div>
  );
};
```

#### 5. IntegratedFilterPanel
Enhanced filter panel combining booking and swap filters:

```typescript
interface IntegratedFilterPanelProps {
  filters: EnhancedBookingFilters;
  onChange: (filters: EnhancedBookingFilters) => void;
  onReset: () => void;
}

interface EnhancedBookingFilters extends BookingFilters {
  // Swap-specific filters
  swapAvailable?: boolean;
  acceptsCash?: boolean;
  auctionMode?: boolean;
  swapType?: 'booking' | 'cash' | 'both';
  
  // Enhanced location and date filters
  location?: LocationFilter;
  dateRange?: DateRangeFilter;
  priceRange?: PriceRangeFilter;
}

const IntegratedFilterPanel: React.FC<IntegratedFilterPanelProps> = ({
  filters,
  onChange,
  onReset
}) => {
  return (
    <div className="integrated-filter-panel">
      <div className="filter-section">
        <h4>Booking Filters</h4>
        <BookingTypeFilter
          selected={filters.type}
          onChange={(type) => onChange({ ...filters, type })}
        />
        <LocationFilter
          value={filters.location}
          onChange={(location) => onChange({ ...filters, location })}
        />
        <DateRangeFilter
          value={filters.dateRange}
          onChange={(dateRange) => onChange({ ...filters, dateRange })}
        />
        <PriceRangeFilter
          value={filters.priceRange}
          onChange={(priceRange) => onChange({ ...filters, priceRange })}
        />
      </div>
      
      <div className="filter-section">
        <h4>Swap Filters</h4>
        <SwapAvailabilityToggle
          checked={filters.swapAvailable}
          onChange={(swapAvailable) => onChange({ ...filters, swapAvailable })}
          label="Available for swapping"
        />
        <CashAcceptanceToggle
          checked={filters.acceptsCash}
          onChange={(acceptsCash) => onChange({ ...filters, acceptsCash })}
          label="Accepts cash offers"
        />
        <AuctionModeToggle
          checked={filters.auctionMode}
          onChange={(auctionMode) => onChange({ ...filters, auctionMode })}
          label="Auction mode active"
        />
      </div>
      
      <div className="filter-actions">
        <Button variant="secondary" onClick={onReset}>
          Reset Filters
        </Button>
        <FilterSummary filters={filters} />
      </div>
    </div>
  );
};
```

### Enhanced Service Layer

#### UnifiedBookingService
Extended service to handle integrated booking and swap operations:

```typescript
class UnifiedBookingService extends BookingService {
  /**
   * Creates a booking with optional swap preferences
   */
  async createBookingWithSwap(data: UnifiedBookingData): Promise<{
    booking: Booking;
    swap?: SwapWithBookings;
  }> {
    // Create booking first
    const booking = await this.createBooking(data);
    
    // Create swap if preferences are provided
    let swap: SwapWithBookings | undefined;
    if (data.swapEnabled && data.swapPreferences) {
      const swapData = this.mapSwapPreferencesToSwapData(data.swapPreferences, booking.id);
      swap = await this.swapService.createSwap(swapData);
    }
    
    return { booking, swap };
  }
  
  /**
   * Updates booking and associated swap preferences
   */
  async updateBookingWithSwap(
    bookingId: string, 
    data: UnifiedBookingData
  ): Promise<{
    booking: Booking;
    swap?: SwapWithBookings;
  }> {
    // Update booking
    const booking = await this.updateBooking(bookingId, data);
    
    // Handle swap preferences
    const existingSwap = await this.swapService.getSwapByBookingId(bookingId);
    
    if (data.swapEnabled && data.swapPreferences) {
      if (existingSwap) {
        // Update existing swap
        const swapData = this.mapSwapPreferencesToSwapData(data.swapPreferences, bookingId);
        const swap = await this.swapService.updateSwap(existingSwap.id, swapData);
        return { booking, swap };
      } else {
        // Create new swap
        const swapData = this.mapSwapPreferencesToSwapData(data.swapPreferences, bookingId);
        const swap = await this.swapService.createSwap(swapData);
        return { booking, swap };
      }
    } else if (existingSwap) {
      // Disable swap if it exists but preferences are disabled
      await this.swapService.cancelSwap(existingSwap.id);
    }
    
    return { booking };
  }
  
  /**
   * Gets bookings with integrated swap information
   */
  async getBookingsWithSwapInfo(
    filters: EnhancedBookingFilters,
    currentUserId: string
  ): Promise<BookingWithSwapInfo[]> {
    // Apply core filters first
    const coreFilters = this.extractCoreBookingFilters(filters);
    let bookings = await this.getBookings(coreFilters);
    
    // Apply swap-specific filters
    if (filters.swapAvailable) {
      bookings = bookings.filter(b => b.swapInfo?.hasActiveProposals);
    }
    
    if (filters.acceptsCash) {
      bookings = bookings.filter(b => 
        b.swapInfo?.paymentTypes.includes('cash')
      );
    }
    
    if (filters.auctionMode) {
      bookings = bookings.filter(b => 
        b.swapInfo?.acceptanceStrategy === 'auction' &&
        b.swapInfo?.auctionEndDate && 
        b.swapInfo.auctionEndDate > new Date()
      );
    }
    
    // Apply browsing restrictions (exclude own bookings when browsing)
    return this.applyBrowsingRestrictions(bookings, currentUserId);
  }
  
  /**
   * Makes a proposal directly from booking listing
   */
  async makeInlineProposal(
    bookingId: string,
    proposalData: InlineProposalData
  ): Promise<SwapProposal> {
    const swap = await this.swapService.getSwapByBookingId(bookingId);
    if (!swap) {
      throw new Error('No active swap found for this booking');
    }
    
    if (proposalData.type === 'booking') {
      return this.swapService.createBookingProposal(swap.id, {
        bookingId: proposalData.selectedBookingId!,
        message: proposalData.message,
        conditions: proposalData.conditions || []
      });
    } else {
      return this.swapService.createCashProposal(swap.id, {
        amount: proposalData.cashAmount!,
        currency: 'USD',
        paymentMethodId: proposalData.paymentMethodId!,
        message: proposalData.message
      });
    }
  }
  
  private applyBrowsingRestrictions(
    bookings: BookingWithSwapInfo[],
    currentUserId: string
  ): BookingWithSwapInfo[] {
    return bookings.filter(booking => {
      // Don't show user's own bookings when browsing
      if (booking.userId === currentUserId) {
        return false;
      }
      
      // Don't show cancelled bookings
      if (booking.status === 'cancelled') {
        return false;
      }
      
      // Only show bookings with active swap proposals when swap filters are applied
      if (booking.swapInfo && !booking.swapInfo.hasActiveProposals) {
        return false;
      }
      
      return true;
    });
  }
}
```

## Data Models

### Enhanced Data Structures

#### BookingWithSwapInfo
Extended booking model that includes swap information:

```typescript
interface BookingWithSwapInfo extends Booking {
  swapInfo?: {
    swapId: string;
    paymentTypes: ('booking' | 'cash')[];
    acceptanceStrategy: 'first-match' | 'auction';
    auctionEndDate?: Date;
    minCashAmount?: number;
    maxCashAmount?: number;
    hasActiveProposals: boolean;
    activeProposalCount: number;
    userProposalStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
    timeRemaining?: number; // milliseconds until auction end
  };
}
```

#### InlineProposalData
Data structure for inline proposals:

```typescript
interface InlineProposalData {
  type: 'booking' | 'cash';
  selectedBookingId?: string;
  cashAmount?: number;
  paymentMethodId?: string;
  message?: string;
  conditions?: string[];
}
```

#### UnifiedFormValidation
Validation schema for the unified form:

```typescript
interface ValidationErrors {
  // Booking validation errors
  title?: string;
  description?: string;
  location?: string;
  dateRange?: string;
  originalPrice?: string;
  
  // Swap validation errors
  paymentTypes?: string;
  minCashAmount?: string;
  acceptanceStrategy?: string;
  auctionEndDate?: string;
  swapConditions?: string;
}

const validateUnifiedBookingData = (data: UnifiedBookingData): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  // Validate booking fields
  if (!data.title?.trim()) {
    errors.title = 'Title is required';
  }
  
  if (!data.description?.trim()) {
    errors.description = 'Description is required';
  }
  
  if (!data.location?.city || !data.location?.country) {
    errors.location = 'Location is required';
  }
  
  if (!data.dateRange?.start || !data.dateRange?.end) {
    errors.dateRange = 'Date range is required';
  } else if (data.dateRange.start >= data.dateRange.end) {
    errors.dateRange = 'End date must be after start date';
  }
  
  if (!data.originalPrice || data.originalPrice <= 0) {
    errors.originalPrice = 'Original price must be greater than 0';
  }
  
  // Validate swap preferences if enabled
  if (data.swapEnabled && data.swapPreferences) {
    const prefs = data.swapPreferences;
    
    if (!prefs.paymentTypes || prefs.paymentTypes.length === 0) {
      errors.paymentTypes = 'At least one payment type must be selected';
    }
    
    if (prefs.paymentTypes.includes('cash') && (!prefs.minCashAmount || prefs.minCashAmount <= 0)) {
      errors.minCashAmount = 'Minimum cash amount is required for cash swaps';
    }
    
    if (prefs.acceptanceStrategy === 'auction') {
      if (!prefs.auctionEndDate) {
        errors.auctionEndDate = 'Auction end date is required';
      } else {
        const oneWeekBeforeEvent = subWeeks(data.dateRange.start, 1);
        if (prefs.auctionEndDate > oneWeekBeforeEvent) {
          errors.auctionEndDate = 'Auction must end at least one week before the event';
        }
      }
    }
  }
  
  return errors;
};
```

## Error Handling

### Enhanced Error Types
```typescript
interface UISimplificationError extends Error {
  code: 'FORM_VALIDATION_ERROR' | 'INLINE_PROPOSAL_ERROR' | 'FILTER_APPLICATION_ERROR' | 'SWAP_INTEGRATION_ERROR';
  field?: string;
  context?: {
    bookingId?: string;
    swapId?: string;
    proposalType?: 'booking' | 'cash';
  };
}

class FormValidationError extends UISimplificationError {
  constructor(field: string, message: string) {
    super(message);
    this.code = 'FORM_VALIDATION_ERROR';
    this.field = field;
  }
}

class InlineProposalError extends UISimplificationError {
  constructor(message: string, context: { bookingId: string; proposalType: 'booking' | 'cash' }) {
    super(message);
    this.code = 'INLINE_PROPOSAL_ERROR';
    this.context = context;
  }
}
```

### Error Recovery Strategies
- **Form Validation**: Real-time validation with field-level error display
- **Inline Proposal Failures**: Retry mechanism with error state preservation
- **Filter Application**: Graceful degradation with partial results
- **Network Errors**: Optimistic updates with rollback on failure

## Testing Strategy

### Component Testing
```typescript
// UnifiedBookingForm tests
describe('UnifiedBookingForm', () => {
  it('should toggle swap preferences section', () => {
    render(<UnifiedBookingForm mode="create" onSubmit={jest.fn()} onCancel={jest.fn()} />);
    
    const swapToggle = screen.getByLabelText('Make available for swapping');
    fireEvent.click(swapToggle);
    
    expect(screen.getByText('Payment Types')).toBeInTheDocument();
  });
  
  it('should validate swap preferences when enabled', async () => {
    const onSubmit = jest.fn();
    render(<UnifiedBookingForm mode="create" onSubmit={onSubmit} onCancel={jest.fn()} />);
    
    // Enable swap and submit without required fields
    fireEvent.click(screen.getByLabelText('Make available for swapping'));
    fireEvent.click(screen.getByText('Create Booking & Enable Swapping'));
    
    await waitFor(() => {
      expect(screen.getByText('At least one payment type must be selected')).toBeInTheDocument();
    });
    
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// InlineProposalForm tests
describe('InlineProposalForm', () => {
  it('should show booking selector for booking proposals', () => {
    const mockSwapInfo = createMockSwapInfo({ paymentTypes: ['booking', 'cash'] });
    
    render(
      <InlineProposalForm
        booking={mockBooking}
        swapInfo={mockSwapInfo}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    
    fireEvent.click(screen.getByLabelText('Swap with my booking'));
    expect(screen.getByText('Select a booking to swap')).toBeInTheDocument();
  });
  
  it('should validate cash amount against minimum', () => {
    const mockSwapInfo = createMockSwapInfo({ 
      paymentTypes: ['cash'],
      cashDetails: { minAmount: 100, maxAmount: 1000 }
    });
    
    render(
      <InlineProposalForm
        booking={mockBooking}
        swapInfo={mockSwapInfo}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    
    const cashInput = screen.getByLabelText('Cash offer amount');
    fireEvent.change(cashInput, { target: { value: '50' } });
    
    expect(screen.getByText('Amount must be at least $100')).toBeInTheDocument();
  });
});
```

### Integration Testing
```typescript
// End-to-end workflow tests
describe('Integrated Booking-Swap Workflow', () => {
  it('should create booking with swap preferences and allow proposals', async () => {
    // Mock API responses
    mockCreateBookingWithSwap.mockResolvedValue({
      booking: mockBooking,
      swap: mockSwap
    });
    
    // Create booking with swap enabled
    render(<BookingsPage />);
    fireEvent.click(screen.getByText('Create Booking'));
    
    // Fill booking details
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Test Booking' } });
    // ... fill other fields
    
    // Enable swap
    fireEvent.click(screen.getByLabelText('Make available for swapping'));
    fireEvent.click(screen.getByLabelText('Accept cash offers'));
    fireEvent.change(screen.getByLabelText('Minimum cash amount'), { target: { value: '200' } });
    
    // Submit form
    fireEvent.click(screen.getByText('Create Booking & Enable Swapping'));
    
    await waitFor(() => {
      expect(mockCreateBookingWithSwap).toHaveBeenCalledWith({
        // booking data
        swapEnabled: true,
        swapPreferences: {
          paymentTypes: ['booking', 'cash'],
          minCashAmount: 200,
          acceptanceStrategy: 'first-match'
        }
      });
    });
    
    // Verify booking appears in listings with swap indicator
    expect(screen.getByText('Available for Swap')).toBeInTheDocument();
  });
  
  it('should allow inline proposal from listing', async () => {
    // Mock booking with swap info
    const bookingWithSwap = {
      ...mockBooking,
      swapInfo: {
        swapId: 'swap-1',
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'first-match',
        minCashAmount: 100,
        hasActiveProposals: true,
        activeProposalCount: 2
      }
    };
    
    mockGetBookingsWithSwapInfo.mockResolvedValue([bookingWithSwap]);
    
    render(<BrowsePage />);
    
    await waitFor(() => {
      expect(screen.getByText(mockBooking.title)).toBeInTheDocument();
    });
    
    // Click make proposal
    fireEvent.click(screen.getByText('Make Proposal'));
    
    // Fill proposal form
    fireEvent.click(screen.getByLabelText('Make cash offer'));
    fireEvent.change(screen.getByLabelText('Cash offer amount'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Interested in this booking' } });
    
    // Submit proposal
    fireEvent.click(screen.getByText('Send Proposal'));
    
    await waitFor(() => {
      expect(mockMakeInlineProposal).toHaveBeenCalledWith(mockBooking.id, {
        type: 'cash',
        cashAmount: 150,
        message: 'Interested in this booking'
      });
    });
  });
});
```

### Performance Testing
- **Form Rendering**: Large forms with many fields and validation
- **List Rendering**: Hundreds of bookings with swap information
- **Filter Application**: Real-time filtering with complex criteria
- **Inline Interactions**: Multiple simultaneous proposal forms

## Accessibility

### Enhanced Accessibility Features
- **Form Navigation**: Logical tab order through booking and swap sections
- **Screen Reader Support**: Descriptive labels for swap-specific controls
- **Keyboard Shortcuts**: Quick access to common actions (Ctrl+N for new booking)
- **Focus Management**: Proper focus handling in inline forms and modals
- **Color Independence**: Swap status indicators work without color
- **Reduced Motion**: Respect animation preferences for form transitions

### ARIA Implementation
```typescript
// Enhanced booking card with proper ARIA labels
<Card 
  role="article" 
  aria-labelledby={`booking-title-${booking.id}`}
  aria-describedby={`booking-details-${booking.id}`}
>
  <h3 id={`booking-title-${booking.id}`}>{booking.title}</h3>
  <div id={`booking-details-${booking.id}`}>
    {/* booking details */}
  </div>
  
  {swapInfo && (
    <div 
      role="region" 
      aria-label="Swap information"
      aria-describedby={`swap-details-${booking.id}`}
    >
      <div id={`swap-details-${booking.id}`}>
        Available for {swapInfo.paymentTypes.join(' and ')} swaps
      </div>
    </div>
  )}
  
  <div role="group" aria-label="Booking actions">
    {/* action buttons */}
  </div>
</Card>
```

## Mobile Optimization

### Responsive Design Considerations
- **Progressive Disclosure**: Collapsible sections for swap preferences on small screens
- **Touch-Friendly**: Larger tap targets for proposal actions
- **Swipe Gestures**: Swipe to reveal actions on booking cards
- **Optimized Forms**: Single-column layout with smart field grouping
- **Contextual Actions**: Bottom sheet for proposal forms on mobile

### Mobile-Specific Components
```typescript
// Mobile-optimized proposal form
const MobileProposalForm: React.FC<InlineProposalFormProps> = (props) => {
  return (
    <BottomSheet isOpen onClose={props.onCancel}>
      <div className="mobile-proposal-form">
        <div className="form-header">
          <h3>Make Proposal</h3>
          <Button variant="ghost" onClick={props.onCancel}>
            <CloseIcon />
          </Button>
        </div>
        
        <div className="form-content">
          {/* Simplified form layout for mobile */}
        </div>
        
        <div className="form-actions">
          <Button variant="primary" fullWidth>
            Send Proposal
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};
```

This design provides a comprehensive solution for simplifying the booking and swap UI while maintaining all existing functionality and adding new integrated features that improve the user experience.