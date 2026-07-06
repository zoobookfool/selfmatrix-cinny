import { atom } from 'jotai';

/**
 * SelfMatrix: serializes the FirstRunSetup dialog against VerificationReminder
 * (UI 合意 v1.4 ④ — "モーダル連発禁止"). FirstRunSetup sets this to `true`
 * while it is open or its completion status is still unknown (account data
 * not loaded yet), and VerificationReminder must not render while it is true.
 * Starts `true` so VerificationReminder never has a chance to flash before
 * FirstRunSetup has determined whether it needs to show.
 */
export const firstRunSetupBlockingAtom = atom<boolean>(true);
