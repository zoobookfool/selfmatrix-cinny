/**
 * SelfMatrix: 画面共有 (配信) の画質/FPS 設定 — element-call fork との共有契約。
 *
 * Element Call (iframe ウィジェット、同一オリジンで埋め込み) は画面共有を開始する際に
 * ここで書き込む localStorage のキーを Setting クラス (matrix-setting-* キー) 経由で
 * 読み直す。キー名・値の JSON 表現 (JSON.stringify した文字列 / 数値) は EC 側
 * (element-call/src/settings/settings.ts) と完全に一致させる必要がある。
 * どちらか一方だけを変更すると配信の画質/FPS が反映されなくなるため、変更する際は
 * 必ず両リポジトリを同期すること。
 */

export type ScreenShareQuality = '480' | '720' | '1080' | '2160';
export type ScreenShareFps = 15 | 30 | 60;

export const SCREEN_SHARE_QUALITY_KEY = 'matrix-setting-screen-share-quality';
export const SCREEN_SHARE_FPS_KEY = 'matrix-setting-screen-share-fps';

export const DEFAULT_SCREEN_SHARE_QUALITY: ScreenShareQuality = '2160';
export const DEFAULT_SCREEN_SHARE_FPS: ScreenShareFps = 60;

const VALID_QUALITIES: ScreenShareQuality[] = ['480', '720', '1080', '2160'];
const VALID_FPS: ScreenShareFps[] = [15, 30, 60];

const isScreenShareQuality = (value: unknown): value is ScreenShareQuality =>
  typeof value === 'string' && (VALID_QUALITIES as string[]).includes(value);

const isScreenShareFps = (value: unknown): value is ScreenShareFps =>
  typeof value === 'number' && (VALID_FPS as number[]).includes(value);

export const getScreenShareQuality = (): ScreenShareQuality => {
  const item = localStorage.getItem(SCREEN_SHARE_QUALITY_KEY);
  if (item === null) return DEFAULT_SCREEN_SHARE_QUALITY;
  try {
    const parsed: unknown = JSON.parse(item);
    return isScreenShareQuality(parsed) ? parsed : DEFAULT_SCREEN_SHARE_QUALITY;
  } catch {
    return DEFAULT_SCREEN_SHARE_QUALITY;
  }
};

export const setScreenShareQuality = (quality: ScreenShareQuality): void => {
  localStorage.setItem(SCREEN_SHARE_QUALITY_KEY, JSON.stringify(quality));
};

export const getScreenShareFps = (): ScreenShareFps => {
  const item = localStorage.getItem(SCREEN_SHARE_FPS_KEY);
  if (item === null) return DEFAULT_SCREEN_SHARE_FPS;
  try {
    const parsed: unknown = JSON.parse(item);
    return isScreenShareFps(parsed) ? parsed : DEFAULT_SCREEN_SHARE_FPS;
  } catch {
    return DEFAULT_SCREEN_SHARE_FPS;
  }
};

export const setScreenShareFps = (fps: ScreenShareFps): void => {
  localStorage.setItem(SCREEN_SHARE_FPS_KEY, JSON.stringify(fps));
};
