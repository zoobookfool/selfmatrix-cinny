import React from 'react';
import classNames from 'classnames';
import { as } from 'folds';
import { useAtomValue } from 'jotai';
import * as css from './Sidebar.css';
import {
  getSidebarPosition,
  isHorizontalDockPosition,
  shellLayoutAtom,
} from '../../state/shellLayout';

export const SidebarStack = as<'div'>(
  ({ as: AsSidebarStack = 'div', className, ...props }, ref) => {
    const shellLayout = useAtomValue(shellLayoutAtom);
    const horizontal = isHorizontalDockPosition(getSidebarPosition(shellLayout));

    return (
      <AsSidebarStack
        className={classNames(
          horizontal ? css.SidebarStackHorizontal : css.SidebarStack,
          className
        )}
        {...props}
        ref={ref}
      />
    );
  }
);
