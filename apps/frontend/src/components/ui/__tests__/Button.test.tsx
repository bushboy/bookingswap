import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);

    expect(
      screen.getByRole('button', { name: 'Click me' })
    ).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant styles correctly', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);

    let button = screen.getByRole('button');
    expect(button).toHaveClass('btn-primary');

    rerender(<Button variant="secondary">Secondary</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('btn-secondary');

    rerender(<Button variant="danger">Danger</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('btn-danger');
  });

  it('applies size styles correctly', () => {
    const { rerender } = render(<Button size="small">Small</Button>);

    let button = screen.getByRole('button');
    expect(button).toHaveClass('btn-small');

    rerender(<Button size="medium">Medium</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('btn-medium');

    rerender(<Button size="large">Large</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('btn-large');
  });

  it('shows loading state correctly', () => {
    render(<Button loading>Loading</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('prevents click when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    await user.click(screen.getByRole('button'));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('prevents click when loading', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button loading onClick={handleClick}>
        Loading
      </Button>
    );

    await user.click(screen.getByRole('button'));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with icon', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>;

    render(<Button icon={<TestIcon />}>With Icon</Button>);

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('With Icon')).toBeInTheDocument();
  });

  it('renders icon-only button', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>;

    render(<Button icon={<TestIcon />} iconOnly aria-label="Icon button" />);

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByLabelText('Icon button')).toBeInTheDocument();
  });

  it('applies full width style', () => {
    render(<Button fullWidth>Full Width</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-full-width');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>();

    render(<Button ref={ref}>Button</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('supports keyboard navigation', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Keyboard</Button>);

    const button = screen.getByRole('button');
    button.focus();

    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('passes through other props', () => {
    render(
      <Button data-testid="custom-button" title="Custom title">
        Custom
      </Button>
    );

    const button = screen.getByTestId('custom-button');
    expect(button).toHaveAttribute('title', 'Custom title');
  });

  it('handles form submission', () => {
    const handleSubmit = vi.fn(e => e.preventDefault());

    render(
      <form onSubmit={handleSubmit}>
        <Button type="submit">Submit</Button>
      </form>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(handleSubmit).toHaveBeenCalled();
  });

  it('renders as different element when as prop is provided', () => {
    render(
      <Button as="a" href="/test">
        Link Button
      </Button>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/test');
    expect(link).toHaveTextContent('Link Button');
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<Button aria-describedby="help-text">Accessible</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('announces loading state to screen readers', () => {
      render(<Button loading>Loading</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('has proper focus management', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Button>First</Button>
          <Button>Second</Button>
        </div>
      );

      await user.tab();
      expect(screen.getByText('First')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Second')).toHaveFocus();
    });
  });

  describe('edge cases', () => {
    it('handles undefined onClick gracefully', () => {
      render(<Button>No Click Handler</Button>);

      expect(() => {
        fireEvent.click(screen.getByRole('button'));
      }).not.toThrow();
    });

    it('handles empty children', () => {
      render(<Button></Button>);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('handles complex children', () => {
      render(
        <Button>
          <span>Complex</span>
          <strong>Children</strong>
        </Button>
      );

      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('Children')).toBeInTheDocument();
    });
  });
});
