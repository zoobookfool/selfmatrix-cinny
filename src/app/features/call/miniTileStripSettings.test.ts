import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MINI_TILE_STRIP_POSITION,
  MINI_TILE_STRIP_POSITION_KEY,
  getMiniTileStripPosition,
  setMiniTileStripPosition,
} from './miniTileStripSettings';

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

describe('miniTileStripSettings', () => {
  it('uses the contracted localStorage key name shared with element-call', () => {
    expect(MINI_TILE_STRIP_POSITION_KEY).toBe('matrix-setting-mini-tile-strip-position');
  });

  it('round-trips a written position value', () => {
    setMiniTileStripPosition('left');
    expect(localStorage.getItem(MINI_TILE_STRIP_POSITION_KEY)).toBe('"left"');
    expect(getMiniTileStripPosition()).toBe('left');
  });

  it('falls back to the default position when unset', () => {
    expect(getMiniTileStripPosition()).toBe(DEFAULT_MINI_TILE_STRIP_POSITION);
  });

  it('falls back to the default position for an out-of-range value', () => {
    localStorage.setItem(MINI_TILE_STRIP_POSITION_KEY, JSON.stringify('diagonal'));
    expect(getMiniTileStripPosition()).toBe(DEFAULT_MINI_TILE_STRIP_POSITION);
  });

  it('falls back to the default position for unparsable JSON', () => {
    localStorage.setItem(MINI_TILE_STRIP_POSITION_KEY, 'garbage');
    expect(getMiniTileStripPosition()).toBe(DEFAULT_MINI_TILE_STRIP_POSITION);
  });

  it('falls back to the default position for a wrong-type value (number instead of string)', () => {
    localStorage.setItem(MINI_TILE_STRIP_POSITION_KEY, JSON.stringify(1));
    expect(getMiniTileStripPosition()).toBe(DEFAULT_MINI_TILE_STRIP_POSITION);
  });
});
