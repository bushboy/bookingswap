import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Modal } from '../Modal';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  children: <div>Modal content</div>,
};

describe('Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow style
    document.body.style.overflow = '';
  });

  it('renders modal when open', () => {
    render(<Modal {...defaultProps} />);

    expect(screen.getByText('Modal content')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<Modal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
  });

  it('closes on escape key when enabled', async () => {
    const user = userEvent.setup();
    render(<Modal {...defaultProps} closeOnEscape={true} />);

    await user.keyboard('{Escape}');

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not close on escape key when disabled', async () => {
    const user = userEvent.setup();
    render(<Modal {...defaultProps} closeOnEscape={false} />);

    await user.keyboard('{Escape}');

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('closes on overlay click when enabled', async () => {
    const user = userEvent.setup();
    render(<Modal {...defaultProps} closeOnOverlayClick={true} />);

    const overlay = screen.getByRole('dialog').parentElement;
    if (overlay) {
      await user.click(overlay);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it('does not close on overlay click when disabled', async () => {
    const user = userEvent.setup();
    render(<Modal {...defaultProps} closeOnOverlayClick={false} />);

    const overlay = screen.getByRole('dialog').parentElement;
    if (overlay) {
      await user.click(overlay);
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    }
  });

  it('closes when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Modal {...defaultProps} title="Test Modal" />);

    const closeButton = screen.getByLabelText('Close modal');
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('prevents body scroll when open', () => {
    render(<Modal {...defaultProps} />);

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when closed', () => {
    const { rerender } = render(<Modal {...defaultProps} />);

    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Modal {...defaultProps} isOpen={false} />);

    expect(document.body.style.overflow).toBe('');
  });

  it('applies correct size styles', () => {
    const { rerender } = render(<Modal {...defaultProps} size="sm" />);

    let modalContent = screen.getByRole('dialog');
    expect(modalContent).toHaveStyle({ maxWidth: '400px' });

    rerender(<Modal {...defaultProps} size="lg" />);
    modalContent = screen.getByRole('dialog');
    expect(modalContent).toHaveStyle({ maxWidth: '800px' });
  });

  it('traps focus within modal', async () => {
    const user = userEvent.setup();
    render(
      <Modal {...defaultProps} title="Test Modal">
        <button>First button</button>
        <button>Second button</button>
      </Modal>
    );

    const firstButton = screen.getByText('First button');
    const secondButton = screen.getByText('Second button');
    const closeButton = screen.getByLabelText('Close modal');

    // Focus should start on modal
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveFocus();

    // Tab should move to first focusable element
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab();
    expect(firstButton).toHaveFocus();

    await user.tab();
    expect(secondButton).toHaveFocus();

    // Tab from last element should wrap to first
    await user.tab();
    expect(closeButton).toHaveFocus();
  });

  it('handles content overflow correctly', () => {
    render(
      <Modal {...defaultProps} title="Test Modal">
        <div style={{ height: '2000px' }}>Very tall content</div>
      </Modal>
    );

    const modalContent = screen.getByRole('dialog');
    expect(modalContent).toHaveStyle({
      maxHeight: '90vh',
      overflow: 'hidden',
    });
  });
});
