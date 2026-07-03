import { VirtualItem } from '@tanstack/react-virtual';
import { as } from 'folds';
import React from 'react';
import classNames from 'classnames';
import * as css from './style.css';

type VirtualTileProps = {
  virtualItem: VirtualItem;
  /**
   * Lays the tile out along the x-axis (`left`) instead of the y-axis
   * (`top`). Used by chip-row nav layouts (Stage 2) whose virtualizer is
   * configured with `horizontal: true`.
   */
  horizontal?: boolean;
};
export const VirtualTile = as<'div', VirtualTileProps>(
  ({ className, virtualItem, horizontal, style, ...props }, ref) => (
    <div
      className={classNames(horizontal ? css.VirtualTileHorizontal : css.VirtualTile, className)}
      style={{ [horizontal ? 'left' : 'top']: virtualItem.start, ...style }}
      data-index={virtualItem.index}
      {...props}
      ref={ref}
    />
  )
);
