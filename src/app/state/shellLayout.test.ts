import { describe, expect, it } from 'vitest';
import { makeShellLayoutContent } from './shellLayout';

describe('makeShellLayoutContent', () => {
  it('merges a patch onto an empty base', () => {
    const content = makeShellLayoutContent({}, { sidebarPosition: 'right' });
    expect(content).toEqual({ sidebarPosition: 'right' });
  });

  it('keeps unrelated fields when patching a single field', () => {
    const base = { sidebarPosition: 'right' as const, navPosition: 'left' as const };
    const content = makeShellLayoutContent(base, { navPosition: 'bottom' });
    expect(content).toEqual({ sidebarPosition: 'right', navPosition: 'bottom' });
  });

  // SelfMatrix B3 regression: two quick successive patches (e.g. sidebar
  // position changed, then nav position changed) must both survive when
  // each call's base is the previous call's result — i.e. the in-memory
  // shellLayoutAtom value — rather than a stale mx.getAccountData() read.
  it('retains both changes when two patches are applied in sequence against the running result', () => {
    const initial = {};
    const afterSidebarChange = makeShellLayoutContent(initial, { sidebarPosition: 'right' });
    const afterNavChange = makeShellLayoutContent(afterSidebarChange, { navPosition: 'bottom' });

    expect(afterNavChange).toEqual({
      sidebarPosition: 'right',
      navPosition: 'bottom',
    });
  });

  it('would lose the first change if merged against a stale base (documents the bug being fixed)', () => {
    const initial = {};
    // Simulates the old bug: both patches merge against the same stale base
    // (e.g. mx.getAccountData(), which hadn't caught up yet) instead of each
    // other's result.
    const staleBase = initial;
    const firstPatchResult = makeShellLayoutContent(staleBase, { sidebarPosition: 'right' });
    const secondPatchResult = makeShellLayoutContent(staleBase, { navPosition: 'bottom' });

    expect(firstPatchResult).toEqual({ sidebarPosition: 'right' });
    expect(secondPatchResult).toEqual({ navPosition: 'bottom' });
    // secondPatchResult does NOT contain sidebarPosition — this is the data
    // loss the fix avoids by chaining the base instead of reusing it.
    expect(secondPatchResult).not.toHaveProperty('sidebarPosition');
  });
});
