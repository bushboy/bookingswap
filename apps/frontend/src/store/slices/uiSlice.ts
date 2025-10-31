import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  loading: boolean;
  modal: {
    isOpen: boolean;
    type: string | null;
    data?: any;
  };
  
  // Enhanced booking form state
  activeBookingForm: {
    isOpen: boolean;
    mode: 'create' | 'edit';
    bookingId?: string;
    swapEnabled: boolean;
  };
  
  // Inline proposal states
  inlineProposals: {
    [bookingId: string]: {
      isOpen: boolean;
      proposalType: 'booking' | 'cash';
      loading: boolean;
      error?: string;
    };
  };
  
  // Enhanced filters state
  filters: {
    showSwappableOnly: boolean;
    showCashAccepting: boolean;
    showAuctions: boolean;
    activeFiltersCount: number;
  };
  
  // UI interaction states
  expandedBookingCards: string[];
  selectedBookingsForComparison: string[];
}

const initialState: UiState = {
  sidebarOpen: false,
  theme: 'light',
  loading: false,
  modal: {
    isOpen: false,
    type: null,
    data: undefined,
  },
  
  // Enhanced booking form state
  activeBookingForm: {
    isOpen: false,
    mode: 'create',
    swapEnabled: false,
  },
  
  // Inline proposal states
  inlineProposals: {},
  
  // Enhanced filters state
  filters: {
    showSwappableOnly: false,
    showCashAccepting: false,
    showAuctions: false,
    activeFiltersCount: 0,
  },
  
  // UI interaction states
  expandedBookingCards: [],
  selectedBookingsForComparison: [],
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: state => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setModal: (
      state,
      action: PayloadAction<{
        isOpen: boolean;
        type?: string | null;
        data?: any;
      }>
    ) => {
      state.modal = {
        isOpen: action.payload.isOpen,
        type: action.payload.type || null,
        data: action.payload.data,
      };
    },
    openModal: (state, action: PayloadAction<{ type: string; data?: any }>) => {
      state.modal = {
        isOpen: true,
        type: action.payload.type,
        data: action.payload.data,
      };
    },
    closeModal: state => {
      state.modal = {
        isOpen: false,
        type: null,
        data: undefined,
      };
    },
    
    // Enhanced booking form management
    setActiveBookingForm: (
      state,
      action: PayloadAction<{
        isOpen: boolean;
        mode?: 'create' | 'edit';
        bookingId?: string;
        swapEnabled?: boolean;
      }>
    ) => {
      state.activeBookingForm = {
        ...state.activeBookingForm,
        ...action.payload,
      };
    },
    
    openBookingForm: (
      state,
      action: PayloadAction<{
        mode: 'create' | 'edit';
        bookingId?: string;
        swapEnabled?: boolean;
      }>
    ) => {
      state.activeBookingForm = {
        isOpen: true,
        mode: action.payload.mode,
        bookingId: action.payload.bookingId,
        swapEnabled: action.payload.swapEnabled || false,
      };
    },
    
    closeBookingForm: state => {
      state.activeBookingForm = {
        isOpen: false,
        mode: 'create',
        swapEnabled: false,
      };
    },
    
    toggleSwapEnabled: state => {
      state.activeBookingForm.swapEnabled = !state.activeBookingForm.swapEnabled;
    },
    
    // Inline proposal management
    setInlineProposal: (
      state,
      action: PayloadAction<{
        bookingId: string;
        isOpen: boolean;
        proposalType?: 'booking' | 'cash';
        loading?: boolean;
        error?: string;
      }>
    ) => {
      const { bookingId, ...proposalState } = action.payload;
      state.inlineProposals[bookingId] = {
        ...state.inlineProposals[bookingId],
        ...proposalState,
      };
    },
    
    openInlineProposal: (
      state,
      action: PayloadAction<{
        bookingId: string;
        proposalType: 'booking' | 'cash';
      }>
    ) => {
      const { bookingId, proposalType } = action.payload;
      state.inlineProposals[bookingId] = {
        isOpen: true,
        proposalType,
        loading: false,
      };
    },
    
    closeInlineProposal: (state, action: PayloadAction<string>) => {
      const bookingId = action.payload;
      if (state.inlineProposals[bookingId]) {
        state.inlineProposals[bookingId].isOpen = false;
        delete state.inlineProposals[bookingId].error;
      }
    },
    
    setInlineProposalLoading: (
      state,
      action: PayloadAction<{ bookingId: string; loading: boolean }>
    ) => {
      const { bookingId, loading } = action.payload;
      if (state.inlineProposals[bookingId]) {
        state.inlineProposals[bookingId].loading = loading;
      }
    },
    
    setInlineProposalError: (
      state,
      action: PayloadAction<{ bookingId: string; error: string }>
    ) => {
      const { bookingId, error } = action.payload;
      if (state.inlineProposals[bookingId]) {
        state.inlineProposals[bookingId].error = error;
        state.inlineProposals[bookingId].loading = false;
      }
    },
    
    // Enhanced filters management
    setSwapFilters: (
      state,
      action: PayloadAction<{
        showSwappableOnly?: boolean;
        showCashAccepting?: boolean;
        showAuctions?: boolean;
      }>
    ) => {
      state.filters = { ...state.filters, ...action.payload };
      
      // Update active filters count
      const { showSwappableOnly, showCashAccepting, showAuctions } = state.filters;
      state.filters.activeFiltersCount = [
        showSwappableOnly,
        showCashAccepting,
        showAuctions,
      ].filter(Boolean).length;
    },
    
    resetSwapFilters: state => {
      state.filters = {
        showSwappableOnly: false,
        showCashAccepting: false,
        showAuctions: false,
        activeFiltersCount: 0,
      };
    },
    
    // UI interaction states
    toggleBookingCardExpanded: (state, action: PayloadAction<string>) => {
      const bookingId = action.payload;
      const index = state.expandedBookingCards.indexOf(bookingId);
      if (index > -1) {
        state.expandedBookingCards.splice(index, 1);
      } else {
        state.expandedBookingCards.push(bookingId);
      }
    },
    
    setBookingCardExpanded: (
      state,
      action: PayloadAction<{ bookingId: string; expanded: boolean }>
    ) => {
      const { bookingId, expanded } = action.payload;
      const index = state.expandedBookingCards.indexOf(bookingId);
      
      if (expanded && index === -1) {
        state.expandedBookingCards.push(bookingId);
      } else if (!expanded && index > -1) {
        state.expandedBookingCards.splice(index, 1);
      }
    },
    
    toggleBookingForComparison: (state, action: PayloadAction<string>) => {
      const bookingId = action.payload;
      const index = state.selectedBookingsForComparison.indexOf(bookingId);
      
      if (index > -1) {
        state.selectedBookingsForComparison.splice(index, 1);
      } else if (state.selectedBookingsForComparison.length < 3) {
        // Limit to 3 bookings for comparison
        state.selectedBookingsForComparison.push(bookingId);
      }
    },
    
    clearBookingComparison: state => {
      state.selectedBookingsForComparison = [];
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  setLoading,
  setModal,
  openModal,
  closeModal,
  
  // Enhanced booking form management
  setActiveBookingForm,
  openBookingForm,
  closeBookingForm,
  toggleSwapEnabled,
  
  // Inline proposal management
  setInlineProposal,
  openInlineProposal,
  closeInlineProposal,
  setInlineProposalLoading,
  setInlineProposalError,
  
  // Enhanced filters management
  setSwapFilters,
  resetSwapFilters,
  
  // UI interaction states
  toggleBookingCardExpanded,
  setBookingCardExpanded,
  toggleBookingForComparison,
  clearBookingComparison,
} = uiSlice.actions;

// Selectors
export const selectSidebarOpen = (state: { ui: UiState }) => state.ui.sidebarOpen;
export const selectTheme = (state: { ui: UiState }) => state.ui.theme;
export const selectUiLoading = (state: { ui: UiState }) => state.ui.loading;
export const selectModal = (state: { ui: UiState }) => state.ui.modal;

// Enhanced selectors
export const selectActiveBookingForm = (state: { ui: UiState }) => state.ui.activeBookingForm;
export const selectInlineProposals = (state: { ui: UiState }) => state.ui.inlineProposals;
export const selectSwapFilters = (state: { ui: UiState }) => state.ui.filters;
export const selectExpandedBookingCards = (state: { ui: UiState }) => state.ui.expandedBookingCards;
export const selectSelectedBookingsForComparison = (state: { ui: UiState }) => 
  state.ui.selectedBookingsForComparison;

// Computed selectors
export const selectInlineProposalForBooking = (
  state: { ui: UiState },
  bookingId: string
) => state.ui.inlineProposals[bookingId];

export const selectIsBookingCardExpanded = (
  state: { ui: UiState },
  bookingId: string
) => state.ui.expandedBookingCards.includes(bookingId);

export const selectIsBookingSelectedForComparison = (
  state: { ui: UiState },
  bookingId: string
) => state.ui.selectedBookingsForComparison.includes(bookingId);

export const selectActiveFiltersCount = (state: { ui: UiState }) => 
  state.ui.filters.activeFiltersCount;

export const selectHasActiveSwapFilters = (state: { ui: UiState }) => 
  state.ui.filters.activeFiltersCount > 0;

export default uiSlice.reducer;
