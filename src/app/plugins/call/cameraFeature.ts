export type CameraFeaturePolicy = {
  hideVideoButton: boolean;
  disableVideo: boolean;
  initialVideoEnabled: boolean;
};

export const getCameraFeaturePolicy = (
  cameraEnabled = false,
  requestedVideo = false
): CameraFeaturePolicy => ({
  hideVideoButton: !cameraEnabled,
  disableVideo: !cameraEnabled,
  initialVideoEnabled: cameraEnabled && requestedVideo,
});

export const isCameraEnabledForWidgetUrl = (url: string): boolean => {
  try {
    return new URL(url, 'https://selfmatrix.invalid').searchParams.get('disableVideo') === 'false';
  } catch {
    return false;
  }
};

export const getCallIframeAllow = (cameraEnabled = false): string =>
  `${[
    'microphone',
    ...(cameraEnabled ? ['camera'] : []),
    'display-capture',
    'autoplay',
    'clipboard-write',
  ].join('; ')};`;
