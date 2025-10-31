import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  ValidationWarning,
  ValidationSummary,
} from '../ValidationError';

describe('ValidationError', () => {
  it('should render single error message', () => {
    render(<ValidationError error="This field is required" />);

    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('should render multiple error messages as list', () => {
    const errors = ['Error 1', 'Error 2', 'Error 3'];
    render(<ValidationError errors={errors} />);

    errors.forEach(error => {
      expect(screen.getByText(error)).toBeInTheDocument();
    });

    // Should render as list
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
  });

  it('should not render when no errors provided', () => {
    const { container } = render(<ValidationError />);
    expect(container.firstChild).toBeNull();
  });

  it('should hide icon when showIcon is false', () => {
    render(<ValidationError error="Test error" showIcon={false} />);

    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ValidationError error="Test error" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('ValidationWarning', () => {
  it('should render single warning message', () => {
    render(<ValidationWarning warning="This is a warning" />);

    expect(screen.getByText('This is a warning')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('should render multiple warning messages as list', () => {
    const warnings = ['Warning 1', 'Warning 2'];
    render(<ValidationWarning warnings={warnings} />);

    warnings.forEach(warning => {
      expect(screen.getByText(warning)).toBeInTheDocument();
    });

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
  });

  it('should not render when no warnings provided', () => {
    const { container } = render(<ValidationWarning />);
    expect(container.firstChild).toBeNull();
  });

  it('should hide icon when showIcon is false', () => {
    render(<ValidationWarning warning="Test warning" showIcon={false} />);

    expect(screen.getByText('Test warning')).toBeInTheDocument();
    expect(screen.queryByText('⚡')).not.toBeInTheDocument();
  });
});

describe('ValidationSummary', () => {
  it('should render errors and warnings', () => {
    const errors = ['Error 1', 'Error 2'];
    const warnings = ['Warning 1'];

    render(
      <ValidationSummary
        errors={errors}
        warnings={warnings}
        title="Fix these issues:"
      />
    );

    expect(screen.getByText('Fix these issues:')).toBeInTheDocument();

    errors.forEach(error => {
      expect(screen.getByText(error)).toBeInTheDocument();
    });

    warnings.forEach(warning => {
      expect(screen.getByText(warning)).toBeInTheDocument();
    });
  });

  it('should not render when no errors or warnings', () => {
    const { container } = render(
      <ValidationSummary errors={[]} warnings={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render only errors when no warnings provided', () => {
    const errors = ['Error 1'];

    render(<ValidationSummary errors={errors} />);

    expect(screen.getByText('Error 1')).toBeInTheDocument();
    expect(
      screen.getByText('Please fix the following issues:')
    ).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button clicked', () => {
    const mockDismiss = vi.fn();
    const errors = ['Error 1'];

    render(<ValidationSummary errors={errors} onDismiss={mockDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss');
    dismissButton.click();

    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not render dismiss button when onDismiss not provided', () => {
    const errors = ['Error 1'];

    render(<ValidationSummary errors={errors} />);

    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('should use custom title', () => {
    const errors = ['Error 1'];
    const customTitle = 'Custom error title';

    render(<ValidationSummary errors={errors} title={customTitle} />);

    expect(screen.getByText(customTitle)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const errors = ['Error 1'];

    const { container } = render(
      <ValidationSummary errors={errors} className="custom-summary" />
    );

    expect(container.firstChild).toHaveClass('custom-summary');
  });
});
