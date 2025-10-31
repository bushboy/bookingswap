/**
 * Tests for unified validation display components
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ValidationErrorDisplay,
  FieldValidationDisplay,
  ValidationSummary,
  ValidationTooltip,
  ValidationProgress,
  ValidationAlert,
} from '../UnifiedValidationDisplay';
import { UnifiedFormValidationErrors } from '@booking-swap/shared';

describe('ValidationErrorDisplay', () => {
  it('should render single error message', () => {
    render(<ValidationErrorDisplay error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should render multiple error messages as list', () => {
    const errors = ['Error 1', 'Error 2', 'Error 3'];
    render(<ValidationErrorDisplay errors={errors} />);
    
    errors.forEach(error => {
      expect(screen.getByText(error)).toBeInTheDocument();
    });
  });

  it('should not render when no errors provided', () => {
    const { container } = render(<ValidationErrorDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it('should hide icon when showIcon is false', () => {
    render(<ValidationErrorDisplay error="Test error" showIcon={false} />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ValidationErrorDisplay error="Test error" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render different variants', () => {
    const { container: errorContainer } = render(
      <ValidationErrorDisplay error="Error" variant="error" />
    );
    expect(errorContainer.firstChild).toHaveClass('validation-display--error');

    const { container: warningContainer } = render(
      <ValidationErrorDisplay error="Warning" variant="warning" />
    );
    expect(warningContainer.firstChild).toHaveClass('validation-display--warning');

    const { container: infoContainer } = render(
      <ValidationErrorDisplay error="Info" variant="info" />
    );
    expect(infoContainer.firstChild).toHaveClass('validation-display--info');
  });

  it('should render different sizes', () => {
    const { container: smContainer } = render(
      <ValidationErrorDisplay error="Small" size="sm" />
    );
    expect(smContainer.firstChild).toHaveClass('validation-display--sm');

    const { container: lgContainer } = render(
      <ValidationErrorDisplay error="Large" size="lg" />
    );
    expect(lgContainer.firstChild).toHaveClass('validation-display--lg');
  });
});

describe('FieldValidationDisplay', () => {
  it('should render error message', () => {
    render(
      <FieldValidationDisplay
        fieldName="title"
        error="Title is required"
      />
    );
    expect(screen.getByText('Title is required')).toBeInTheDocument();
  });

  it('should render warning message', () => {
    render(
      <FieldValidationDisplay
        fieldName="title"
        warning="Title could be longer"
      />
    );
    expect(screen.getByText('Title could be longer')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <FieldValidationDisplay
        fieldName="title"
        isValidating={true}
      />
    );
    expect(screen.getByText('Validating...')).toBeInTheDocument();
  });

  it('should show valid icon when requested', () => {
    render(
      <FieldValidationDisplay
        fieldName="title"
        showValidIcon={true}
      />
    );
    expect(screen.getByLabelText('title is valid')).toBeInTheDocument();
  });

  it('should prioritize error over warning', () => {
    render(
      <FieldValidationDisplay
        fieldName="title"
        error="Title is required"
        warning="Title could be longer"
      />
    );
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.queryByText('Title could be longer')).not.toBeInTheDocument();
  });

  it('should not render when no validation state', () => {
    const { container } = render(
      <FieldValidationDisplay fieldName="title" />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ValidationSummary', () => {
  const errors: UnifiedFormValidationErrors = {
    title: 'Title is required',
    description: 'Description is too short',
    originalPrice: 'Price must be positive',
  };

  const warnings = {
    swapValue: 'Swap value seems low',
  };

  it('should render error summary', () => {
    render(<ValidationSummary errors={errors} />);
    
    expect(screen.getByText('Please fix these errors:')).toBeInTheDocument();
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description is too short')).toBeInTheDocument();
    expect(screen.getByText('Price must be positive')).toBeInTheDocument();
  });

  it('should render warnings', () => {
    render(<ValidationSummary errors={{}} warnings={warnings} />);
    
    expect(screen.getByText('Warnings:')).toBeInTheDocument();
    expect(screen.getByText('Swap value seems low')).toBeInTheDocument();
  });

  it('should format field names when enabled', () => {
    render(<ValidationSummary errors={errors} showFieldNames={true} />);
    
    expect(screen.getByText('Title:')).toBeInTheDocument();
    expect(screen.getByText('Description:')).toBeInTheDocument();
    expect(screen.getByText('Original Price:')).toBeInTheDocument();
  });

  it('should limit displayed errors', () => {
    render(<ValidationSummary errors={errors} maxErrors={2} />);
    
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description is too short')).toBeInTheDocument();
    expect(screen.getByText('And 1 more error...')).toBeInTheDocument();
  });

  it('should not render when no errors or warnings', () => {
    const { container } = render(<ValidationSummary errors={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('should use singular form for single error', () => {
    render(<ValidationSummary errors={{ title: 'Title is required' }} />);
    expect(screen.getByText('Please fix this error:')).toBeInTheDocument();
  });
});

describe('ValidationTooltip', () => {
  it('should render children without tooltip when no message', () => {
    render(
      <ValidationTooltip>
        <button>Test Button</button>
      </ValidationTooltip>
    );
    
    expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('should show tooltip on hover when error exists', () => {
    render(
      <ValidationTooltip error="Field is required">
        <button>Test Button</button>
      </ValidationTooltip>
    );
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Field is required')).toBeInTheDocument();
  });

  it('should hide tooltip on mouse leave', () => {
    render(
      <ValidationTooltip error="Field is required">
        <button>Test Button</button>
      </ValidationTooltip>
    );
    
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    
    fireEvent.mouseLeave(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('should show tooltip on focus', () => {
    render(
      <ValidationTooltip warning="Consider improving this field">
        <input type="text" />
      </ValidationTooltip>
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Consider improving this field')).toBeInTheDocument();
  });
});

describe('ValidationProgress', () => {
  it('should render progress information', () => {
    render(
      <ValidationProgress
        totalFields={10}
        validFields={7}
        errorFields={2}
      />
    );
    
    expect(screen.getByText('Form Completion')).toBeInTheDocument();
    expect(screen.getByText('7/10 fields valid')).toBeInTheDocument();
    expect(screen.getByText('2 fields need attention')).toBeInTheDocument();
  });

  it('should handle zero fields', () => {
    render(
      <ValidationProgress
        totalFields={0}
        validFields={0}
        errorFields={0}
      />
    );
    
    expect(screen.getByText('0/0 fields valid')).toBeInTheDocument();
  });

  it('should use singular form for single error field', () => {
    render(
      <ValidationProgress
        totalFields={5}
        validFields={4}
        errorFields={1}
      />
    );
    
    expect(screen.getByText('1 field needs attention')).toBeInTheDocument();
  });

  it('should not show error message when no errors', () => {
    render(
      <ValidationProgress
        totalFields={5}
        validFields={5}
        errorFields={0}
      />
    );
    
    expect(screen.queryByText(/need attention/)).not.toBeInTheDocument();
  });
});

describe('ValidationAlert', () => {
  it('should render alert with message', () => {
    render(
      <ValidationAlert
        type="error"
        message="Something went wrong"
      />
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('validation-alert--error');
  });

  it('should render alert with title and message', () => {
    render(
      <ValidationAlert
        type="warning"
        title="Warning"
        message="Please check your input"
      />
    );
    
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Please check your input')).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    const onAction = vi.fn();
    
    render(
      <ValidationAlert
        type="info"
        message="Information message"
        actions={[
          { label: 'Primary Action', onClick: onAction, variant: 'primary' },
          { label: 'Secondary Action', onClick: onAction, variant: 'secondary' },
        ]}
      />
    );
    
    expect(screen.getByRole('button', { name: 'Primary Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Secondary Action' })).toBeInTheDocument();
  });

  it('should call action handlers', () => {
    const onAction = vi.fn();
    
    render(
      <ValidationAlert
        type="info"
        message="Test message"
        actions={[{ label: 'Test Action', onClick: onAction }]}
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: 'Test Action' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('should render dismiss button', () => {
    const onDismiss = vi.fn();
    
    render(
      <ValidationAlert
        type="success"
        message="Success message"
        onDismiss={onDismiss}
      />
    );
    
    const dismissButton = screen.getByRole('button', { name: 'Dismiss alert' });
    expect(dismissButton).toBeInTheDocument();
    
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should render different alert types', () => {
    const { container: errorContainer } = render(
      <ValidationAlert type="error" message="Error" />
    );
    expect(errorContainer.firstChild).toHaveClass('validation-alert--error');

    const { container: warningContainer } = render(
      <ValidationAlert type="warning" message="Warning" />
    );
    expect(warningContainer.firstChild).toHaveClass('validation-alert--warning');

    const { container: infoContainer } = render(
      <ValidationAlert type="info" message="Info" />
    );
    expect(infoContainer.firstChild).toHaveClass('validation-alert--info');

    const { container: successContainer } = render(
      <ValidationAlert type="success" message="Success" />
    );
    expect(successContainer.firstChild).toHaveClass('validation-alert--success');
  });
});