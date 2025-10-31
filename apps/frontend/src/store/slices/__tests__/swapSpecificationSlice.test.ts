import { configureStore } from '@reduxjs/toolkit';
import { swapSpecificationSlice,
  setLoading,
  setError,
  setContextBooking,
  initializeSwapSpecification,
  updateSwapSpecificationData,
  updateSwapPreferences,
  setExistingSwap,
  setWalletConnected,
  setWalletDisconnected,
  markFormSaved,
  preserveSpecificationData,
  restoreSpecificationData,
  selectContextBooking,
  selectSwapSpecificationData,
  selectHasUnsavedChanges,
  selectCanNavigateAway,
  selectRequiresWalletConnection,
  selectIsEditingExistingSwap,
} from '../swapSpecificationSlice';
import { Booking, SwapPreferencesData } from '@booking-swap/shared';

// Mock booking data
const mockBooking: Booking = {
  id: 'booking-1',
  userId: 'user-1',
  type: 'hotel',
  title: 'Test Hotel Booking',
  description: 'A test hotel booking',
  location: {
    address: '123 Test St',
    city: 'Test City',
    country: 'Test Country',
    coordinates: { lat: 0, lng: 0 },
  },
  dateRange: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-03'),
  },
  originalPrice: 200,
  swapValue: 180,
  providerDetails: {
    name: 'Test Provider',
    contact: 'test@provider.com',
  },
  status: 'confirmed',
  verification: {
    status: 'verified',
    verifiedAt: new Date(),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSwapPreferences: SwapPreferencesData = {
  paymentTypes: ['booking', 'cash'],
  acceptanceStrategy: 'auction',
  auctionEndDate: new Date('2024-01-10'),
  minCashAmount: 150,
  maxCashAmount: 200,
  swapConditions: ['No pets', 'Non-smoking'],
};

describe('swapSpecificationSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        swapSpecification: swapSpecificationSlice.reducer,
      },
    });
  });

  describe('basic state management', () => {
    it('should handle initial state', () => {
      const state = store.getState().swapSpecification;
      expect(state.contextBooking).toBe(null);
      expect(state.swapSpecificationData).toBe(null);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.existingSwap).toBe(null);
      expect(state.walletConnection.isConnected).toBe(false);
    });

    it('should handle setLoading', () => {
      store.dispatch(setLoading(true));
      expect(store.getState().swapSpecification.loading).toBe(true);
      expect(store.getState().swapSpecification.error).toBe(null);
    });

    it('should handle setError', () => {
      store.dispatch(setError('Test error'));
      expect(store.getState().swapSpecification.error).toBe('Test error');
      expect(store.getState().swapSpecification.loading).toBe(false);
    });
  });

  describe('context booking management', () => {
    it('should handle setContextBooking', () => {
      store.dispatch(setContextBooking(mockBooking));
      const state = store.getState().swapSpecification;
      
      expect(state.contextBooking).toEqual(mockBooking);
      expect(state.swapSpecificationData).toBeTruthy();
      expect(state.swapSpecificationData?.bookingId).toBe(mockBooking.id);
      expect(state.swapSpecificationData?.swapEnabled).toBe(true);
      expect(state.swapSpecificationData?.swapPreferences.paymentTypes).toEqual(['booking']);
    });

    it('should not initialize swap data if it already exists', () => {
      // First set the existing swap data
      store.dispatch(initializeSwapSpecification({ 
        bookingId: mockBooking.id,
        existingPreferences: mockSwapPreferences,
      }));
      
      const existingState = store.getState().swapSpecification.swapSpecificationData;
      
      // Then set context booking - it should not override existing data
      store.dispatch(setContextBooking(mockBooking));
      const state = store.getState().swapSpecification;
      
      expect(state.swapSpecificationData).toEqual(existingState);
      expect(state.contextBooking).toEqual(mockBooking);
    });
  });

  describe('swap specification management', () => {
    it('should handle initializeSwapSpecification', () => {
      store.dispatch(initializeSwapSpecification({ 
        bookingId: mockBooking.id,
        existingPreferences: mockSwapPreferences,
      }));
      
      const state = store.getState().swapSpecification;
      expect(state.swapSpecificationData?.bookingId).toBe(mockBooking.id);
      expect(state.swapSpecificationData?.swapPreferences).toEqual(mockSwapPreferences);
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.validationErrors).toEqual({});
    });

    it('should handle updateSwapPreferences', () => {
      store.dispatch(initializeSwapSpecification({ bookingId: mockBooking.id }));
      store.dispatch(updateSwapPreferences({ 
        paymentTypes: ['cash'],
        minCashAmount: 100,
      }));
      
      const state = store.getState().swapSpecification;
      expect(state.swapSpecificationData?.swapPreferences.paymentTypes).toEqual(['cash']);
      expect(state.swapSpecificationData?.swapPreferences.minCashAmount).toBe(100);
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('should handle markFormSaved', () => {
      store.dispatch(initializeSwapSpecification({ bookingId: mockBooking.id }));
      store.dispatch(updateSwapPreferences({ paymentTypes: ['cash'] }));
      store.dispatch(markFormSaved());
      
      const state = store.getState().swapSpecification;
      expect(state.hasUnsavedChanges).toBe(false);
    });
  });

  describe('existing swap management', () => {
    it('should handle setExistingSwap', () => {
      const existingSwap = {
        id: 'swap-1',
        paymentTypes: ['booking', 'cash'] as ('booking' | 'cash')[],
        acceptanceStrategy: 'auction' as const,
        auctionEndDate: new Date('2024-01-10'),
        minCashAmount: 150,
        maxCashAmount: 200,
        swapConditions: ['No pets'],
        hasActiveProposals: true,
        activeProposalCount: 3,
      };
      
      store.dispatch(initializeSwapSpecification({ bookingId: mockBooking.id }));
      store.dispatch(setExistingSwap(existingSwap));
      
      const state = store.getState().swapSpecification;
      expect(state.existingSwap).toEqual(existingSwap);
      expect(state.swapSpecificationData?.swapPreferences.paymentTypes).toEqual(['booking', 'cash']);
      expect(state.swapSpecificationData?.swapPreferences.acceptanceStrategy).toBe('auction');
      expect(state.hasUnsavedChanges).toBe(false);
    });
  });

  describe('wallet connection management', () => {
    it('should handle setWalletConnected', () => {
      store.dispatch(setWalletConnected({ 
        address: '0x123...abc',
        balance: 1000,
      }));
      
      const state = store.getState().swapSpecification;
      expect(state.walletConnection.isConnected).toBe(true);
      expect(state.walletConnection.address).toBe('0x123...abc');
      expect(state.walletConnection.balance).toBe(1000);
      expect(state.walletConnection.isConnecting).toBe(false);
      expect(state.walletConnection.connectionError).toBeUndefined();
    });

    it('should handle setWalletDisconnected', () => {
      store.dispatch(setWalletConnected({ address: '0x123...abc' }));
      store.dispatch(setWalletDisconnected());
      
      const state = store.getState().swapSpecification;
      expect(state.walletConnection.isConnected).toBe(false);
      expect(state.walletConnection.address).toBeUndefined();
      expect(state.walletConnection.balance).toBeUndefined();
      expect(state.walletConnection.isConnecting).toBe(false);
      expect(state.walletConnection.connectionError).toBeUndefined();
    });
  });

  describe('navigation state preservation', () => {
    it('should handle preserveSpecificationData', () => {
      store.dispatch(setContextBooking(mockBooking));
      store.dispatch(updateSwapPreferences({ paymentTypes: ['cash'] }));
      store.dispatch(preserveSpecificationData());
      
      const state = store.getState().swapSpecification;
      expect(state.navigationContext.preservedSpecificationData).toBeTruthy();
      expect(state.navigationContext.preservedSpecificationData?.swapPreferences.paymentTypes).toEqual(['cash']);
      expect(state.navigationContext.sourceBookingId).toBe(mockBooking.id);
    });

    it('should handle restoreSpecificationData', () => {
      const preservedData = {
        bookingId: mockBooking.id,
        swapPreferences: mockSwapPreferences,
        swapEnabled: true,
      };
      
      store.dispatch({
        type: 'swapSpecification/setNavigationContext',
        payload: { preservedSpecificationData: preservedData },
      });
      
      store.dispatch(restoreSpecificationData());
      
      const state = store.getState().swapSpecification;
      expect(state.swapSpecificationData).toEqual(preservedData);
      expect(state.hasUnsavedChanges).toBe(true);
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      store.dispatch(setContextBooking(mockBooking));
    });

    it('should select context booking', () => {
      const contextBooking = selectContextBooking(store.getState());
      expect(contextBooking).toEqual(mockBooking);
    });

    it('should select swap specification data', () => {
      const swapData = selectSwapSpecificationData(store.getState());
      expect(swapData?.bookingId).toBe(mockBooking.id);
    });

    it('should select hasUnsavedChanges', () => {
      expect(selectHasUnsavedChanges(store.getState())).toBe(false);
      
      store.dispatch(updateSwapPreferences({ paymentTypes: ['cash'] }));
      expect(selectHasUnsavedChanges(store.getState())).toBe(true);
    });

    it('should select canNavigateAway', () => {
      expect(selectCanNavigateAway(store.getState())).toBe(true);
      
      store.dispatch(updateSwapPreferences({ paymentTypes: ['cash'] }));
      expect(selectCanNavigateAway(store.getState())).toBe(false);
    });

    it('should select requiresWalletConnection', () => {
      expect(selectRequiresWalletConnection(store.getState())).toBe(false);
      
      store.dispatch(updateSwapPreferences({ paymentTypes: ['cash'] }));
      expect(selectRequiresWalletConnection(store.getState())).toBe(true);
      
      store.dispatch(setWalletConnected({ address: '0x123...abc' }));
      expect(selectRequiresWalletConnection(store.getState())).toBe(false);
    });

    it('should select isEditingExistingSwap', () => {
      expect(selectIsEditingExistingSwap(store.getState())).toBe(false);
      
      store.dispatch(setExistingSwap({
        id: 'swap-1',
        paymentTypes: ['booking'],
        acceptanceStrategy: 'first_match',
        hasActiveProposals: false,
        activeProposalCount: 0,
      }));
      
      expect(selectIsEditingExistingSwap(store.getState())).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle updateSwapPreferences when no swap data exists', () => {
      store.dispatch(updateSwapPreferences({ paymentTypes: ['cash'] }));
      const state = store.getState().swapSpecification;
      expect(state.swapSpecificationData).toBe(null);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle restoreSpecificationData when no preserved data exists', () => {
      store.dispatch(restoreSpecificationData());
      const state = store.getState().swapSpecification;
      expect(state.swapSpecificationData).toBe(null);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle setExistingSwap when no swap specification data exists', () => {
      const existingSwap = {
        id: 'swap-1',
        paymentTypes: ['booking'] as ('booking' | 'cash')[],
        acceptanceStrategy: 'first_match' as const,
        hasActiveProposals: false,
        activeProposalCount: 0,
      };
      
      store.dispatch(setExistingSwap(existingSwap));
      const state = store.getState().swapSpecification;
      expect(state.existingSwap).toEqual(existingSwap);
      expect(state.swapSpecificationData).toBe(null);
    });
  });
});