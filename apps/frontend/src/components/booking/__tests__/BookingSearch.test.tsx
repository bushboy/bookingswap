import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BookingSearch } from '../BookingSearch';

describe('BookingSearch', () => {
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
  });

  it('renders search form with basic fields', () => {
    render(<BookingSearch onSearch={mockOnSearch} />);

    expect(screen.getByLabelText(/search bookings/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('shows advanced filters when toggle is clicked', () => {
    render(<BookingSearch onSearch={mockOnSearch} />);

    const advancedToggle = screen.getByRole('button', {
      name: /advanced filters/i,
    });
    fireEvent.click(advancedToggle);

    expect(screen.getByLabelText(/min price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/available from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/available to/i)).toBeInTheDocument();
  });

  it('calls onSearch with correct filters when form is submitted', () => {
    render(<BookingSearch onSearch={mockOnSearch} />);

    const searchInput = screen.getByLabelText(/search bookings/i);
    const locationInput = screen.getByLabelText(/location/i);
    const typeSelect = screen.getByLabelText(/type/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    fireEvent.change(searchInput, { target: { value: 'luxury hotel' } });
    fireEvent.change(locationInput, { target: { value: 'Paris' } });
    fireEvent.change(typeSelect, { target: { value: 'hotel' } });
    fireEvent.click(searchButton);

    expect(mockOnSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'luxury hotel',
        location: 'Paris',
        type: 'hotel',
      })
    );
  });

  it('includes advanced filters in search when they are set', () => {
    render(<BookingSearch onSearch={mockOnSearch} />);

    // Open advanced filters
    const advancedToggle = screen.getByRole('button', {
      name: /advanced filters/i,
    });
    fireEvent.click(advancedToggle);

    // Set advanced filter values
    const minPriceInput = screen.getByLabelText(/min price/i);
    const maxPriceInput = screen.getByLabelText(/max price/i);
    const dateFromInput = screen.getByLabelText(/available from/i);

    fireEvent.change(minPriceInput, { target: { value: '100' } });
    fireEvent.change(maxPriceInput, { target: { value: '500' } });
    fireEvent.change(dateFromInput, { target: { value: '2024-06-01' } });

    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    expect(mockOnSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        minPrice: 100,
        maxPrice: 500,
        dateFrom: '2024-06-01',
      })
    );
  });

  it('resets filters when reset button is clicked', () => {
    render(<BookingSearch onSearch={mockOnSearch} />);

    // Set some filter values
    const searchInput = screen.getByLabelText(/search bookings/i);
    const locationInput = screen.getByLabelText(/location/i);

    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.change(locationInput, { target: { value: 'test location' } });

    // Click reset
    const resetButton = screen.getByRole('button', { name: /reset filters/i });
    fireEvent.click(resetButton);

    expect(mockOnSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '',
        location: '',
        type: 'all',
        minPrice: 0,
        maxPrice: 10000,
        dateFrom: '',
        dateTo: '',
      })
    );

    // Check that inputs are cleared
    expect(searchInput).toHaveValue('');
    expect(locationInput).toHaveValue('');
  });

  it('shows loading state on search button', () => {
    render(<BookingSearch onSearch={mockOnSearch} loading={true} />);

    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeDisabled();
  });

  it('includes all booking types in dropdown', () => {
    render(<BookingSearch onSearch={mockOnSearch} />);

    const typeSelect = screen.getByLabelText(/type/i);

    expect(
      screen.getByRole('option', { name: /all types/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /hotel/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /event/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /flight/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /rental/i })).toBeInTheDocument();
  });

  it('updates filter state when inputs change', () => {
    render(<BookingSearch onSearch={mockOnSearch} />);

    const searchInput = screen.getByLabelText(/search bookings/i);
    fireEvent.change(searchInput, { target: { value: 'new search term' } });

    expect(searchInput).toHaveValue('new search term');
  });
});
