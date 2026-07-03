import { style } from '@vanilla-extract/css';
import { DefaultReset } from 'folds';

export const VirtualTile = style([
  DefaultReset,
  {
    position: 'absolute',
    width: '100%',
    left: 0,
  },
]);

/**
 * Horizontal variant for chip-row nav layouts (Stage 2). The virtualizer
 * positions tiles along the x-axis (`left`) instead of the y-axis (`top`),
 * so the tile itself must size along height/left rather than width/top.
 */
export const VirtualTileHorizontal = style([
  DefaultReset,
  {
    position: 'absolute',
    height: '100%',
    top: 0,
  },
]);
