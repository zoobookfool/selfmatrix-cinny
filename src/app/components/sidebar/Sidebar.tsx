import classNames from 'classnames';
import { as } from 'folds';
import React from 'react';
import { useAtomValue } from 'jotai';
import * as css from './Sidebar.css';
import {
  getSidebarPosition,
  isHorizontalDockPosition,
  shellLayoutAtom,
} from '../../state/shellLayout';

export const Sidebar = as<'div'>(({ as: AsSidebar = 'div', className, ...props }, ref) => {
  const shellLayout = useAtomValue(shellLayoutAtom);
  const horizontal = isHorizontalDockPosition(getSidebarPosition(shellLayout));

  return (
    <AsSidebar
      className={classNames(horizontal ? css.SidebarHorizontal : css.Sidebar, className)}
      {...props}
      ref={ref}
    />
  );
});
