import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { PasswordStrengthValidator } from '../PasswordStrengthValidator';

describe('PasswordStrengthValidator', () => {
  it('renders password requirements', () => {
    render(<PasswordStrengthValidator password="test" />);
    
    expect(screen.getByText('Password Requirements:')).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One lowercase letter (a-z)')).toBeInTheDocument();
    expect(screen.getByText('One uppercase letter (A-Z)')).toBeInTheDocument();
    expect(screen.getByText('One number (0-9)')).toBeInTheDocument();
    expect(screen.getByText('One special character (!@#$%^&*)')).toBeInTheDocument();
  });

  it('shows weak password strength for simple password', () => {
    render(<PasswordStrengthValidator password="test" showProgress={true} />);
    
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('shows strong password strength for complex password', () => {
    render(<PasswordStrengthValidator password="TestPassword123!" showProgress={true} />);
    
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Password meets all requirements!')).toBeInTheDocument();
  });

  it('calls onStrengthChange callback', () => {
    const mockCallback = vi.fn();
    render(
      <PasswordStrengthValidator 
        password="TestPassword123!" 
        onStrengthChange={mockCallback}
      />
    );
    
    expect(mockCallback).toHaveBeenCalledWith(100, true);
  });

  it('does not render when password is empty', () => {
    const { container } = render(<PasswordStrengthValidator password="" />);
    
    expect(container.firstChild).toBeNull();
  });

  it('has proper accessibility attributes', () => {
    render(<PasswordStrengthValidator password="test" />);
    
    expect(screen.getByRole('region', { name: 'Password strength requirements' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Password requirements checklist' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});