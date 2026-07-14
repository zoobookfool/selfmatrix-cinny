import { describe, expect, it } from 'vitest';
import { getCameraFeaturePolicy } from './cameraFeature';

describe('getCameraFeaturePolicy', () => {
  it('disables the camera feature by default', () => {
    expect(getCameraFeaturePolicy()).toEqual({
      hideVideoButton: true,
      disableVideo: true,
      initialVideoEnabled: false,
    });
  });

  it('shows camera controls without starting the camera automatically', () => {
    expect(getCameraFeaturePolicy(true)).toEqual({
      hideVideoButton: false,
      disableVideo: false,
      initialVideoEnabled: false,
    });
  });

  it('honors an explicit pre-call camera selection only when enabled', () => {
    expect(getCameraFeaturePolicy(true, true).initialVideoEnabled).toBe(true);
    expect(getCameraFeaturePolicy(false, true).initialVideoEnabled).toBe(false);
  });
});
