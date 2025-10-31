import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ProposalCreationForm } from '../ProposalCreationForm';
import { EligibleSwap, SwapWithProposalInfo, CompatibilityAnalysis } from '@booking-swap/shared';

// Mock hooks
vi.mock('../../../hooks/useFormValidation', () => ({
  useFormValidation: () => ({
    errors: {},
    validateField: vi.fn(),
    validateForm: vi.fn(),
    clearErrors: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useId: (prefix: string) => `${prefix}-test-id`,
  useAnnouncements: () => ({ announce: vi.fn() }),
}));

const mockTargetSwap: SwapWithProposalInfo = {
  id: 'target-swap-123',
  sourceBookingId: 'booking-target-1',
  targetBookingId: null,
  proposerId: null,
  ownerId: 'owner-456',
  status: 'active',
  terms: null,
  blockchain: { proposalTransactionId: null },
  timeline: { createdAt: new Date('2024-05-01') },
  createdAt: new Date('2024-05-01'),
  updatedAt: new Date('2024-05-01'),
  title: 'Luxury Villa in Tuscany',
  location: 'Florence, Italy',
  estimatedValue: 3500,
};

const mockSelectedSwap: EligibleSwap = {
  id: 'eligible-swap-1',
  sourceBookingId: 'booking-eligible-1',
  title: 'Beach House in Malibu',
  description: 'Oceanfront property with private beach access',
  bookingDetails: {
    location: 'Malibu, CA',
    dateRange: {
      checkIn: new Date('2024-08-05'),
      checkOut: new Date('2024-08-12'),
    },
    accommodationType: 'House',
    guests: 8,
    estimatedValue: 4000,
  },
  status: 'active',
  createdAt: new Date('2024-04-15'),
  isCompatible: true,
  compatibilityScore: 92,
};

const mockCompatibility: CompatibilityAnalysis = {
  overallScore: 92,
  factors: {
    locationCompatibility: { score: 85, weight: 0.25, details: 'Different continents', status: 'good' },
    dateCompatibility: { score: 95, weight: 0.20, details: 'Excellent overlap', status: 'excellent' },
    valueCompatibility: { score: 88, weight: 0.30, details: 'Well-matched values', status: 'excellent' },
    accommodationCompatibility: { score: 90, weight: 0.15, details: 'Both luxury properties', status: 'excellent' },
    guestCompatibility: { score: 80, weight: 0.10, details: 'Good capacity match', status: 'good' },
  },
  recommendations: ['Excellent match', 'Highlight unique features'],
  potentialIssues: []
};

describe('ProposalCreationForm - Validation and Error Handling', () => {
  const defaultProps = {
    targetSwap: mockTargetSwap,
    selectedSwap: mockSelectedSwap,
    compatibility: mockCompatibility,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Validation', () => {
    it('validates message length requirements', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      
      // Test minimum length
      await user.type(messageInput, 'Hi');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        expect(screen.getByText('Message must be at least 10 characters')).toBeInTheDocument();
      });

      // Test maximum length
      await user.clear(messageInput);
      await user.type(messageInput, 'A'.repeat(501));
      fireEvent.blur(messageInput);

      await waitFor(() => {
        expect(screen.getByText('Message must not exceed 500 characters')).toBeInTheDocument();
      });
    });

    it('shows character count in real-time', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Hello world');

      expect(screen.getByText('11/500 characters')).toBeInTheDocument();
    });

    it('validates message content for inappropriate text', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      
      // Test contact information detection
      await user.type(messageInput, 'Contact me at john@example.com or call 555-1234');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        expect(screen.getByText('Message cannot contain contact information')).toBeInTheDocument();
      });

      // Test spam patterns
      await user.clear(messageInput);
      await user.type(messageInput, 'URGENT!!! LIMITED TIME OFFER!!! GUARANTEED!!!');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        expect(screen.getByText('Message appears to be spam or promotional')).toBeInTheDocument();
      });
    });

    it('provides helpful suggestions for message improvement', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'I want to swap');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        expect(screen.getByText('Consider adding more details about why this swap would work well')).toBeInTheDocument();
      });
    });
  });

  describe('Conditions Validation', () => {
    it('validates individual condition length', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const addConditionButton = screen.getByText('Add Condition');
      await user.click(addConditionButton);

      const conditionInput = screen.getByPlaceholderText('Enter condition...');
      await user.type(conditionInput, 'A'.repeat(201)); // Exceeds 200 char limit
      fireEvent.blur(conditionInput);

      await waitFor(() => {
        expect(screen.getByText('Condition must not exceed 200 characters')).toBeInTheDocument();
      });
    });

    it('limits maximum number of conditions', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      // Add maximum number of conditions (10)
      for (let i = 0; i < 10; i++) {
        const addButton = screen.getByText('Add Condition');
        await user.click(addButton);
        
        const conditionInput = screen.getByDisplayValue('');
        await user.type(conditionInput, `Condition ${i + 1}`);
        fireEvent.blur(conditionInput);
      }

      // Try to add 11th condition
      const addButton = screen.queryByText('Add Condition');
      expect(addButton).toBeDisabled();
      expect(screen.getByText('Maximum 10 conditions allowed')).toBeInTheDocument();
    });

    it('validates condition content for appropriateness', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const addConditionButton = screen.getByText('Add Condition');
      await user.click(addConditionButton);

      const conditionInput = screen.getByPlaceholderText('Enter condition...');
      await user.type(conditionInput, 'Call me at 555-1234 to discuss');
      fireEvent.blur(conditionInput);

      await waitFor(() => {
        expect(screen.getByText('Condition cannot contain contact information')).toBeInTheDocument();
      });
    });

    it('allows removing conditions', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      // Add a condition
      const addConditionButton = screen.getByText('Add Condition');
      await user.click(addConditionButton);

      const conditionInput = screen.getByPlaceholderText('Enter condition...');
      await user.type(conditionInput, 'Flexible check-in time');

      // Remove the condition
      const removeButton = screen.getByLabelText('Remove condition');
      await user.click(removeButton);

      expect(screen.queryByDisplayValue('Flexible check-in time')).not.toBeInTheDocument();
    });
  });

  describe('Terms Agreement Validation', () => {
    it('requires terms agreement before submission', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      // Fill required fields but don't check terms
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'This is a valid message with enough characters');

      const submitButton = screen.getByText('Submit Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('You must agree to the terms and conditions')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('enables submission when terms are agreed', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      // Fill all required fields
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'This is a valid message with enough characters');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      const submitButton = screen.getByText('Submit Proposal');
      expect(submitButton).toBeEnabled();

      await user.click(submitButton);

      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        message: 'This is a valid message with enough characters',
        conditions: [],
        agreedToTerms: true,
      });
    });
  });

  describe('Real-time Validation Feedback', () => {
    it('shows validation status icons next to fields', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      
      // Initially no icon
      expect(screen.queryByTestId('validation-icon')).not.toBeInTheDocument();

      // Type invalid message
      await user.type(messageInput, 'Hi');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        const errorIcon = screen.getByTestId('validation-error-icon');
        expect(errorIcon).toBeInTheDocument();
        expect(errorIcon).toHaveAttribute('aria-label', 'Validation error');
      });

      // Fix the message
      await user.clear(messageInput);
      await user.type(messageInput, 'This is a valid message with enough characters');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        const successIcon = screen.getByTestId('validation-success-icon');
        expect(successIcon).toBeInTheDocument();
        expect(successIcon).toHaveAttribute('aria-label', 'Validation passed');
      });
    });

    it('updates submit button state based on form validity', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const submitButton = screen.getByText('Submit Proposal');
      expect(submitButton).toBeDisabled();

      // Fill message
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'This is a valid message with enough characters');

      // Still disabled without terms agreement
      expect(submitButton).toBeDisabled();

      // Agree to terms
      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      // Now should be enabled
      expect(submitButton).toBeEnabled();
    });

    it('shows progress indicator for form completion', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      // Initially 0% complete
      expect(screen.getByText('0% Complete')).toBeInTheDocument();

      // Fill message (50% complete)
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'This is a valid message with enough characters');

      await waitFor(() => {
        expect(screen.getByText('50% Complete')).toBeInTheDocument();
      });

      // Agree to terms (100% complete)
      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      await waitFor(() => {
        expect(screen.getByText('100% Complete')).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery and User Guidance', () => {
    it('provides contextual help for validation errors', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Hi');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        expect(screen.getByText('Message must be at least 10 characters')).toBeInTheDocument();
        
        // Should show help text
        const helpButton = screen.getByLabelText('Get help with message requirements');
        expect(helpButton).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Get help with message requirements'));

      expect(screen.getByText('Tips for writing a good proposal message:')).toBeInTheDocument();
      expect(screen.getByText('• Explain why this swap would work well for both parties')).toBeInTheDocument();
      expect(screen.getByText('• Mention specific features of your property')).toBeInTheDocument();
    });

    it('suggests improvements based on compatibility analysis', () => {
      const lowCompatibilityAnalysis = {
        ...mockCompatibility,
        overallScore: 45,
        factors: {
          ...mockCompatibility.factors,
          valueCompatibility: { score: 30, weight: 0.30, details: 'Large value difference', status: 'poor' as const },
        },
        recommendations: ['Consider addressing the value difference in your message'],
        potentialIssues: ['Large value gap may affect acceptance']
      };

      render(<ProposalCreationForm {...defaultProps} compatibility={lowCompatibilityAnalysis} />);

      expect(screen.getByText('Suggestions to improve your proposal:')).toBeInTheDocument();
      expect(screen.getByText('Consider addressing the value difference in your message')).toBeInTheDocument();
      expect(screen.getByText('Potential concerns:')).toBeInTheDocument();
      expect(screen.getByText('Large value gap may affect acceptance')).toBeInTheDocument();
    });

    it('allows saving draft and resuming later', async () => {
      const user = userEvent.setup();
      const mockSaveDraft = vi.fn();

      render(<ProposalCreationForm {...defaultProps} onSaveDraft={mockSaveDraft} />);

      // Fill partial form
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'This is a partial message');

      // Save draft
      const saveDraftButton = screen.getByText('Save Draft');
      await user.click(saveDraftButton);

      expect(mockSaveDraft).toHaveBeenCalledWith({
        targetSwapId: mockTargetSwap.id,
        sourceSwapId: mockSelectedSwap.id,
        message: 'This is a partial message',
        conditions: [],
        agreedToTerms: false,
      });

      expect(screen.getByText('Draft saved successfully')).toBeInTheDocument();
    });

    it('warns about potential issues before submission', async () => {
      const user = userEvent.setup();

      const problematicCompatibility = {
        ...mockCompatibility,
        overallScore: 35,
        potentialIssues: [
          'Date ranges do not overlap',
          'Significant value difference may require additional payment'
        ]
      };

      render(<ProposalCreationForm {...defaultProps} compatibility={problematicCompatibility} />);

      // Fill form
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'This is a valid message with enough characters');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      // Try to submit
      const submitButton = screen.getByText('Submit Proposal');
      await user.click(submitButton);

      // Should show warning dialog
      await waitFor(() => {
        expect(screen.getByText('Potential Issues Detected')).toBeInTheDocument();
        expect(screen.getByText('Date ranges do not overlap')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
      });

      // Can proceed anyway
      const proceedButton = screen.getByText('Submit Anyway');
      await user.click(proceedButton);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });
  });

  describe('Accessibility in Validation', () => {
    it('announces validation errors to screen readers', async () => {
      const user = userEvent.setup();
      const mockAnnounce = vi.fn();
      
      vi.mocked(require('../../../hooks/useAccessibility').useAnnouncements).mockReturnValue({
        announce: mockAnnounce
      });

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Hi');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        expect(mockAnnounce).toHaveBeenCalledWith('Message validation error: Message must be at least 10 characters');
      });
    });

    it('provides proper ARIA attributes for validation states', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      
      // Initially valid state
      expect(messageInput).toHaveAttribute('aria-invalid', 'false');
      expect(messageInput).not.toHaveAttribute('aria-describedby');

      // Type invalid message
      await user.type(messageInput, 'Hi');
      fireEvent.blur(messageInput);

      await waitFor(() => {
        expect(messageInput).toHaveAttribute('aria-invalid', 'true');
        expect(messageInput).toHaveAttribute('aria-describedby');
        
        const errorId = messageInput.getAttribute('aria-describedby');
        const errorElement = document.getElementById(errorId!);
        expect(errorElement).toHaveTextContent('Message must be at least 10 characters');
      });
    });

    it('maintains focus management during validation', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      const submitButton = screen.getByText('Submit Proposal');

      // Try to submit invalid form
      await user.click(submitButton);

      // Focus should move to first invalid field
      await waitFor(() => {
        expect(messageInput).toHaveFocus();
      });
    });
  });
});