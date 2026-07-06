import { describe, expect, it } from 'vitest';
import { isFirstRunSetupComplete, makeFirstRunSetupContent } from './firstRunSetup';

describe('makeFirstRunSetupContent', () => {
  it('builds content with the given timestamp', () => {
    expect(makeFirstRunSetupContent(12345)).toEqual({ completedAt: 12345 });
  });

  it('defaults to the current time when no timestamp is given', () => {
    const before = Date.now();
    const content = makeFirstRunSetupContent();
    const after = Date.now();
    expect(content.completedAt).toBeGreaterThanOrEqual(before);
    expect(content.completedAt).toBeLessThanOrEqual(after);
  });
});

describe('isFirstRunSetupComplete', () => {
  it('is false when content is undefined', () => {
    expect(isFirstRunSetupComplete(undefined)).toBe(false);
  });

  it('is false when completedAt is missing', () => {
    expect(isFirstRunSetupComplete({} as never)).toBe(false);
  });

  it('is true when completedAt is a number', () => {
    expect(isFirstRunSetupComplete({ completedAt: 1 })).toBe(true);
  });
});
