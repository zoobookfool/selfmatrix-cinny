import { describe, expect, it } from 'vitest';
import {
  getCallIframeAllow,
  getCameraFeaturePolicy,
  isCameraEnabledForWidgetUrl,
} from './cameraFeature';

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

describe('camera iframe permission policy', () => {
  it('omits camera permission while the feature is disabled', () => {
    expect(getCallIframeAllow()).toBe('microphone; display-capture; autoplay; clipboard-write;');
  });

  it('allows camera only for a widget URL with video explicitly enabled', () => {
    const enabledUrl = 'https://selfmatrix.invalid/call?disableVideo=false';
    const disabledUrl = 'https://selfmatrix.invalid/call?disableVideo=true';

    expect(isCameraEnabledForWidgetUrl(enabledUrl)).toBe(true);
    expect(isCameraEnabledForWidgetUrl(disabledUrl)).toBe(false);
    expect(isCameraEnabledForWidgetUrl('not a url')).toBe(false);
    expect(getCallIframeAllow(isCameraEnabledForWidgetUrl(enabledUrl))).toBe(
      'microphone; camera; display-capture; autoplay; clipboard-write;'
    );
  });
});
