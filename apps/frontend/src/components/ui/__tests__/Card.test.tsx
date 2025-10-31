import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Card } from '../Card';

describe('Card', () => {
  it('renders card with content', () => {
    render(
      <Card>
        <h2>Card Title</h2>
        <p>Card content</p>
      </Card>
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies variant styles correctly', () => {
    const { rerender } = render(<Card variant="default">Default</Card>);

    let card = screen.getByText('Default').closest('.card');
    expect(card).toHaveClass('card-default');

    rerender(<Card variant="elevated">Elevated</Card>);
    card = screen.getByText('Elevated').closest('.card');
    expect(card).toHaveClass('card-elevated');

    rerender(<Card variant="outlined">Outlined</Card>);
    card = screen.getByText('Outlined').closest('.card');
    expect(card).toHaveClass('card-outlined');
  });

  it('applies size styles correctly', () => {
    const { rerender } = render(<Card size="small">Small</Card>);

    let card = screen.getByText('Small').closest('.card');
    expect(card).toHaveClass('card-small');

    rerender(<Card size="medium">Medium</Card>);
    card = screen.getByText('Medium').closest('.card');
    expect(card).toHaveClass('card-medium');

    rerender(<Card size="large">Large</Card>);
    card = screen.getByText('Large').closest('.card');
    expect(card).toHaveClass('card-large');
  });

  it('handles click events when clickable', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Card clickable onClick={handleClick}>
        Clickable Card
      </Card>
    );

    const card = screen.getByText('Clickable Card').closest('.card');
    await user.click(card!);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows hover effects when hoverable', () => {
    render(<Card hoverable>Hoverable Card</Card>);

    const card = screen.getByText('Hoverable Card').closest('.card');
    expect(card).toHaveClass('card-hoverable');
  });

  it('renders with header', () => {
    const header = <div>Card Header</div>;

    render(<Card header={header}>Card Body</Card>);

    expect(screen.getByText('Card Header')).toBeInTheDocument();
    expect(screen.getByText('Card Body')).toBeInTheDocument();
  });

  it('renders with footer', () => {
    const footer = <div>Card Footer</div>;

    render(<Card footer={footer}>Card Body</Card>);

    expect(screen.getByText('Card Footer')).toBeInTheDocument();
    expect(screen.getByText('Card Body')).toBeInTheDocument();
  });

  it('renders with both header and footer', () => {
    const header = <div>Card Header</div>;
    const footer = <div>Card Footer</div>;

    render(
      <Card header={header} footer={footer}>
        Card Body
      </Card>
    );

    expect(screen.getByText('Card Header')).toBeInTheDocument();
    expect(screen.getByText('Card Body')).toBeInTheDocument();
    expect(screen.getByText('Card Footer')).toBeInTheDocument();
  });

  it('applies loading state correctly', () => {
    render(<Card loading>Loading Card</Card>);

    const card = screen.getByText('Loading Card').closest('.card');
    expect(card).toHaveClass('card-loading');
    expect(screen.getByTestId('card-loading-overlay')).toBeInTheDocument();
  });

  it('applies disabled state correctly', () => {
    render(<Card disabled>Disabled Card</Card>);

    const card = screen.getByText('Disabled Card').closest('.card');
    expect(card).toHaveClass('card-disabled');
  });

  it('prevents click when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Card disabled clickable onClick={handleClick}>
        Disabled Clickable Card
      </Card>
    );

    const card = screen.getByText('Disabled Clickable Card').closest('.card');
    await user.click(card!);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('prevents click when loading', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Card loading clickable onClick={handleClick}>
        Loading Clickable Card
      </Card>
    );

    const card = screen.getByText('Loading Clickable Card').closest('.card');
    await user.click(card!);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<Card className="custom-card">Custom Card</Card>);

    const card = screen.getByText('Custom Card').closest('.card');
    expect(card).toHaveClass('custom-card');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>();

    render(<Card ref={ref}>Ref Card</Card>);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('supports keyboard navigation when clickable', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Card clickable onClick={handleClick} tabIndex={0}>
        Keyboard Card
      </Card>
    );

    const card = screen.getByText('Keyboard Card').closest('.card');
    card!.focus();

    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('renders with image', () => {
    const image = <img src="/test.jpg" alt="Test" />;

    render(<Card image={image}>Card with Image</Card>);

    expect(screen.getByAltText('Test')).toBeInTheDocument();
    expect(screen.getByText('Card with Image')).toBeInTheDocument();
  });

  it('applies padding styles correctly', () => {
    const { rerender } = render(<Card padding="none">No Padding</Card>);

    let card = screen.getByText('No Padding').closest('.card');
    expect(card).toHaveClass('card-padding-none');

    rerender(<Card padding="small">Small Padding</Card>);
    card = screen.getByText('Small Padding').closest('.card');
    expect(card).toHaveClass('card-padding-small');

    rerender(<Card padding="large">Large Padding</Card>);
    card = screen.getByText('Large Padding').closest('.card');
    expect(card).toHaveClass('card-padding-large');
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes when clickable', () => {
      render(
        <Card clickable role="button" aria-label="Clickable card">
          Accessible Card
        </Card>
      );

      const card = screen.getByLabelText('Clickable card');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('has proper focus management', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Card clickable tabIndex={0}>
            First Card
          </Card>
          <Card clickable tabIndex={0}>
            Second Card
          </Card>
        </div>
      );

      await user.tab();
      expect(screen.getByText('First Card').closest('.card')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Second Card').closest('.card')).toHaveFocus();
    });

    it('announces loading state to screen readers', () => {
      render(
        <Card loading aria-busy="true">
          Loading Card
        </Card>
      );

      const card = screen.getByText('Loading Card').closest('.card');
      expect(card).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('edge cases', () => {
    it('handles undefined onClick gracefully', () => {
      render(<Card clickable>No Click Handler</Card>);

      expect(() => {
        const card = screen.getByText('No Click Handler').closest('.card');
        fireEvent.click(card!);
      }).not.toThrow();
    });

    it('handles empty children', () => {
      render(<Card></Card>);

      expect(document.querySelector('.card')).toBeInTheDocument();
    });

    it('handles complex nested content', () => {
      render(
        <Card>
          <div>
            <h3>Nested Title</h3>
            <div>
              <p>Nested paragraph</p>
              <button>Nested button</button>
            </div>
          </div>
        </Card>
      );

      expect(screen.getByText('Nested Title')).toBeInTheDocument();
      expect(screen.getByText('Nested paragraph')).toBeInTheDocument();
      expect(screen.getByText('Nested button')).toBeInTheDocument();
    });

    it('handles multiple event handlers', async () => {
      const handleClick = vi.fn();
      const handleMouseEnter = vi.fn();
      const handleMouseLeave = vi.fn();
      const user = userEvent.setup();

      render(
        <Card
          clickable
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Multi Event Card
        </Card>
      );

      const card = screen.getByText('Multi Event Card').closest('.card');

      await user.hover(card!);
      expect(handleMouseEnter).toHaveBeenCalled();

      await user.click(card!);
      expect(handleClick).toHaveBeenCalled();

      await user.unhover(card!);
      expect(handleMouseLeave).toHaveBeenCalled();
    });
  });
});
