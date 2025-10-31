import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '../Input';

describe('Input', () => {
  it('renders input with label', () => {
    render(<Input label="Test Label" />);

    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
  });

  it('handles value changes', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<Input label="Test Input" onChange={handleChange} />);

    const input = screen.getByLabelText('Test Input');
    await user.type(input, 'test value');

    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue('test value');
  });

  it('applies different input types correctly', () => {
    const { rerender } = render(<Input type="text" label="Text Input" />);

    let input = screen.getByLabelText('Text Input');
    expect(input).toHaveAttribute('type', 'text');

    rerender(<Input type="email" label="Email Input" />);
    input = screen.getByLabelText('Email Input');
    expect(input).toHaveAttribute('type', 'email');

    rerender(<Input type="password" label="Password Input" />);
    input = screen.getByLabelText('Password Input');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows error state correctly', () => {
    render(<Input label="Error Input" error="This field is required" />);

    const input = screen.getByLabelText('Error Input');
    expect(input).toHaveClass('input-error');
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('shows help text', () => {
    render(<Input label="Help Input" helpText="This is help text" />);

    expect(screen.getByText('This is help text')).toBeInTheDocument();
  });

  it('applies disabled state correctly', () => {
    render(<Input label="Disabled Input" disabled />);

    const input = screen.getByLabelText('Disabled Input');
    expect(input).toBeDisabled();
  });

  it('applies required state correctly', () => {
    render(<Input label="Required Input" required />);

    const input = screen.getByLabelText('Required Input');
    expect(input).toBeRequired();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('applies different sizes correctly', () => {
    const { rerender } = render(<Input label="Small Input" size="small" />);

    let input = screen.getByLabelText('Small Input');
    expect(input).toHaveClass('input-small');

    rerender(<Input label="Medium Input" size="medium" />);
    input = screen.getByLabelText('Medium Input');
    expect(input).toHaveClass('input-medium');

    rerender(<Input label="Large Input" size="large" />);
    input = screen.getByLabelText('Large Input');
    expect(input).toHaveClass('input-large');
  });

  it('renders with prefix icon', () => {
    const PrefixIcon = () => <span data-testid="prefix-icon">@</span>;

    render(<Input label="Icon Input" prefix={<PrefixIcon />} />);

    expect(screen.getByTestId('prefix-icon')).toBeInTheDocument();
  });

  it('renders with suffix icon', () => {
    const SuffixIcon = () => <span data-testid="suffix-icon">✓</span>;

    render(<Input label="Icon Input" suffix={<SuffixIcon />} />);

    expect(screen.getByTestId('suffix-icon')).toBeInTheDocument();
  });

  it('handles placeholder correctly', () => {
    render(<Input label="Placeholder Input" placeholder="Enter text here" />);

    const input = screen.getByLabelText('Placeholder Input');
    expect(input).toHaveAttribute('placeholder', 'Enter text here');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();

    render(<Input ref={ref} label="Ref Input" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className', () => {
    render(<Input label="Custom Input" className="custom-input" />);

    const input = screen.getByLabelText('Custom Input');
    expect(input).toHaveClass('custom-input');
  });

  it('handles focus and blur events', async () => {
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    const user = userEvent.setup();

    render(
      <Input label="Focus Input" onFocus={handleFocus} onBlur={handleBlur} />
    );

    const input = screen.getByLabelText('Focus Input');

    await user.click(input);
    expect(handleFocus).toHaveBeenCalled();

    await user.tab();
    expect(handleBlur).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<Input label="Loading Input" loading />);

    expect(screen.getByTestId('input-loading-spinner')).toBeInTheDocument();
  });

  it('handles controlled input correctly', async () => {
    const TestComponent = () => {
      const [value, setValue] = React.useState('');
      return (
        <Input
          label="Controlled Input"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
      );
    };

    const user = userEvent.setup();
    render(<TestComponent />);

    const input = screen.getByLabelText('Controlled Input');
    await user.type(input, 'controlled');

    expect(input).toHaveValue('controlled');
  });

  it('handles uncontrolled input correctly', async () => {
    const user = userEvent.setup();

    render(<Input label="Uncontrolled Input" defaultValue="default" />);

    const input = screen.getByLabelText('Uncontrolled Input');
    expect(input).toHaveValue('default');

    await user.clear(input);
    await user.type(input, 'new value');

    expect(input).toHaveValue('new value');
  });

  describe('validation', () => {
    it('shows validation error on invalid input', async () => {
      const user = userEvent.setup();

      render(<Input label="Email Input" type="email" required />);

      const input = screen.getByLabelText('Email Input');
      await user.type(input, 'invalid-email');
      await user.tab();

      expect(input).toBeInvalid();
    });

    it('clears validation error on valid input', async () => {
      const user = userEvent.setup();

      render(<Input label="Email Input" type="email" required />);

      const input = screen.getByLabelText('Email Input');
      await user.type(input, 'invalid-email');
      await user.tab();

      expect(input).toBeInvalid();

      await user.clear(input);
      await user.type(input, 'valid@email.com');

      expect(input).toBeValid();
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <Input
          label="Accessible Input"
          error="Error message"
          helpText="Help text"
          aria-describedby="custom-description"
        />
      );

      const input = screen.getByLabelText('Accessible Input');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('associates label correctly', () => {
      render(<Input label="Associated Label" id="test-input" />);

      const label = screen.getByText('Associated Label');
      const input = screen.getByLabelText('Associated Label');

      expect(label).toHaveAttribute('for', 'test-input');
      expect(input).toHaveAttribute('id', 'test-input');
    });

    it('supports screen reader announcements', () => {
      render(
        <Input
          label="Screen Reader Input"
          error="This field has an error"
          aria-live="polite"
        />
      );

      const errorMessage = screen.getByText('This field has an error');
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });

  describe('edge cases', () => {
    it('handles undefined onChange gracefully', () => {
      render(<Input label="No Handler Input" />);

      expect(() => {
        const input = screen.getByLabelText('No Handler Input');
        fireEvent.change(input, { target: { value: 'test' } });
      }).not.toThrow();
    });

    it('handles special characters in input', async () => {
      const user = userEvent.setup();

      render(<Input label="Special Chars Input" />);

      const input = screen.getByLabelText('Special Chars Input');
      await user.type(input, '!@#$%^&*()');

      expect(input).toHaveValue('!@#$%^&*()');
    });

    it('handles very long input values', async () => {
      const user = userEvent.setup();
      const longValue = 'a'.repeat(1000);

      render(<Input label="Long Input" />);

      const input = screen.getByLabelText('Long Input');
      await user.type(input, longValue);

      expect(input).toHaveValue(longValue);
    });

    it('handles rapid input changes', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Input label="Rapid Input" onChange={handleChange} />);

      const input = screen.getByLabelText('Rapid Input');

      // Simulate rapid typing
      await user.type(input, 'rapid', { delay: 1 });

      expect(handleChange).toHaveBeenCalledTimes(5); // One for each character
    });
  });

  describe('password input specific', () => {
    it('toggles password visibility', async () => {
      const user = userEvent.setup();

      render(<Input label="Password" type="password" showPasswordToggle />);

      const input = screen.getByLabelText('Password');
      const toggleButton = screen.getByRole('button', {
        name: /show password/i,
      });

      expect(input).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
    });
  });
});
