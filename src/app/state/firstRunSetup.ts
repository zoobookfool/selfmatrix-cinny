import { FirstRunSetupContent } from '../../types/matrix/accountData';

/**
 * SelfMatrix: pure content builder for the FirstRunSetup account data event
 * (UI 合意 v1.4 ④). Kept as a pure function (no MatrixClient) so it can be
 * unit tested directly, mirroring makeShellLayoutContent in shellLayout.ts.
 */
export const makeFirstRunSetupContent = (now: number = Date.now()): FirstRunSetupContent => ({
  completedAt: now,
});

export const isFirstRunSetupComplete = (content?: FirstRunSetupContent): boolean =>
  typeof content?.completedAt === 'number';
