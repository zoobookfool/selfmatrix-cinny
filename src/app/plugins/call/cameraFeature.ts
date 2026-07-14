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
