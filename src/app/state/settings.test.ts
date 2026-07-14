import { afterEach, describe, expect, it, vi } from 'vitest';

const setStorage = (value: string | null) => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => value),
    setItem: vi.fn(),
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('camera setting', () => {
  it('is disabled on first run', async () => {
    setStorage(null);
    const { getSettings } = await import('./settings');

    expect(getSettings().cameraEnabled).toBe(false);
  });

  it('is disabled for existing settings that predate the option', async () => {
    setStorage(JSON.stringify({ useSystemTheme: false }));
    const { getSettings } = await import('./settings');

    expect(getSettings().cameraEnabled).toBe(false);
  });
});
