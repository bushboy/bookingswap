import { describe, it, expect } from 'vitest';

describe('SwapCard Import Test', () => {
  it('can import SwapCard', async () => {
    const module = await import('../SwapCard');
    console.log('Imported module:', module);
    console.log('SwapCard:', module.SwapCard);
    expect(module.SwapCard).toBeDefined();
    expect(typeof module.SwapCard).toBe('function');
  });
});
