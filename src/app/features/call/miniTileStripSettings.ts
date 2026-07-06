/**
 * SelfMatrix: 通話ミニタイル一覧のドッキング位置 — element-call fork との共有契約。
 *
 * Element Call (iframe ウィジェット、同一オリジンで埋め込み) はレイアウト構築時に
 * ここで書き込む localStorage のキーを Setting クラス (matrix-setting-* キー) 経由で
 * 読み直す。キー名・値の JSON 表現 (JSON.stringify した文字列) は EC 側
 * (element-call/src/settings/settings.ts の miniTileStripPosition,
 * キー "mini-tile-strip-position" → 実キーは prefix 込みで
 * "matrix-setting-mini-tile-strip-position") と完全に一致させる必要がある。
 * どちらか一方だけを変更するとミニタイルの位置が反映されなくなるため、変更する際は
 * 必ず両リポジトリを同期すること。
 */

export type MiniTileStripPosition = 'top' | 'bottom' | 'left' | 'right';

export const MINI_TILE_STRIP_POSITION_KEY = 'matrix-setting-mini-tile-strip-position';

export const DEFAULT_MINI_TILE_STRIP_POSITION: MiniTileStripPosition = 'bottom';

const VALID_POSITIONS: MiniTileStripPosition[] = ['top', 'bottom', 'left', 'right'];

const isMiniTileStripPosition = (value: unknown): value is MiniTileStripPosition =>
  typeof value === 'string' && (VALID_POSITIONS as string[]).includes(value);

export const getMiniTileStripPosition = (): MiniTileStripPosition => {
  const item = localStorage.getItem(MINI_TILE_STRIP_POSITION_KEY);
  if (item === null) return DEFAULT_MINI_TILE_STRIP_POSITION;
  try {
    const parsed: unknown = JSON.parse(item);
    return isMiniTileStripPosition(parsed) ? parsed : DEFAULT_MINI_TILE_STRIP_POSITION;
  } catch {
    return DEFAULT_MINI_TILE_STRIP_POSITION;
  }
};

export const setMiniTileStripPosition = (position: MiniTileStripPosition): void => {
  localStorage.setItem(MINI_TILE_STRIP_POSITION_KEY, JSON.stringify(position));
};
