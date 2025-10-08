import { describe, expect, it } from 'vitest';
import { computeMultiplier } from '../data/WeaknessTable';

describe('computeMultiplier', () => {
  it('returns 1.5 when weapon is boss weakness', () => {
    expect(computeMultiplier('Water', 'Fire')).toBe(1.5);
  });

  it('returns 0.75 when weapon is resisted', () => {
    expect(computeMultiplier('Fire', 'Water')).toBe(0.75);
  });

  it('returns 1 when neutral', () => {
    expect(computeMultiplier('Metal', 'Fire')).toBe(1);
  });
});
