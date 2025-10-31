import { describe, it, expect } from 'vitest';
import { formatDate } from './index';

describe('formatDate', () => {
  it('should format date to ISO string', () => {
    const date = new Date('2023-01-01T00:00:00.000Z');
    const result = formatDate(date);
    expect(result).toBe('2023-01-01T00:00:00.000Z');
  });
});