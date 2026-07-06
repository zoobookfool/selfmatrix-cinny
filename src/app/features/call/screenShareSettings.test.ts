import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SCREEN_SHARE_FPS,
  DEFAULT_SCREEN_SHARE_QUALITY,
  SCREEN_SHARE_FPS_KEY,
  SCREEN_SHARE_QUALITY_KEY,
  getScreenShareFps,
  getScreenShareQuality,
  setScreenShareFps,
  setScreenShareQuality,
} from './screenShareSettings';

// SelfMatrix: vitest.config.ts runs with environment: 'node', so `localStorage`
// is not a global. This is a minimal in-memory stand-in, good enough to
// exercise the read/write round-trip and invalid-value fallback behaviour.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

beforeEach(() => {
  (globalThis as { localStorage: Storage }).localStorage = new MemoryStorage();
});

describe('screenShareSettings', () => {
  it('uses the contracted localStorage key names shared with element-call', () => {
    expect(SCREEN_SHARE_QUALITY_KEY).toBe('matrix-setting-screen-share-quality');
    expect(SCREEN_SHARE_FPS_KEY).toBe('matrix-setting-screen-share-fps');
  });

  it('round-trips a written quality value', () => {
    setScreenShareQuality('720');
    expect(localStorage.getItem(SCREEN_SHARE_QUALITY_KEY)).toBe('"720"');
    expect(getScreenShareQuality()).toBe('720');
  });

  it('round-trips a written fps value', () => {
    setScreenShareFps(30);
    expect(localStorage.getItem(SCREEN_SHARE_FPS_KEY)).toBe('30');
    expect(getScreenShareFps()).toBe(30);
  });

  it('falls back to the default quality when unset', () => {
    expect(getScreenShareQuality()).toBe(DEFAULT_SCREEN_SHARE_QUALITY);
  });

  it('falls back to the default fps when unset', () => {
    expect(getScreenShareFps()).toBe(DEFAULT_SCREEN_SHARE_FPS);
  });

  it('falls back to the default quality for an out-of-range value', () => {
    localStorage.setItem(SCREEN_SHARE_QUALITY_KEY, JSON.stringify('9999'));
    expect(getScreenShareQuality()).toBe(DEFAULT_SCREEN_SHARE_QUALITY);
  });

  it('falls back to the default fps for an out-of-range value', () => {
    localStorage.setItem(SCREEN_SHARE_FPS_KEY, JSON.stringify(9999));
    expect(getScreenShareFps()).toBe(DEFAULT_SCREEN_SHARE_FPS);
  });

  it('falls back to the default quality for unparsable JSON', () => {
    localStorage.setItem(SCREEN_SHARE_QUALITY_KEY, 'garbage');
    expect(getScreenShareQuality()).toBe(DEFAULT_SCREEN_SHARE_QUALITY);
  });

  it('falls back to the default fps for unparsable JSON', () => {
    localStorage.setItem(SCREEN_SHARE_FPS_KEY, 'garbage');
    expect(getScreenShareFps()).toBe(DEFAULT_SCREEN_SHARE_FPS);
  });

  it('falls back to the default quality for a wrong-type value (number instead of string)', () => {
    localStorage.setItem(SCREEN_SHARE_QUALITY_KEY, JSON.stringify(1080));
    expect(getScreenShareQuality()).toBe(DEFAULT_SCREEN_SHARE_QUALITY);
  });

  it('falls back to the default fps for a wrong-type value (string instead of number)', () => {
    localStorage.setItem(SCREEN_SHARE_FPS_KEY, JSON.stringify('30'));
    expect(getScreenShareFps()).toBe(DEFAULT_SCREEN_SHARE_FPS);
  });
});
