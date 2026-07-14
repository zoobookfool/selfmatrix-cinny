import { describe, expect, it } from 'vitest';
import { normalizeStartupCallPreferences } from './callPreferences';

describe('normalizeStartupCallPreferences', () => {
  it('always resets a stored camera-on preference', () => {
    expect(
      normalizeStartupCallPreferences({ microphone: false, video: true, sound: true })
    ).toEqual({ microphone: false, video: false, sound: true });
  });
});
