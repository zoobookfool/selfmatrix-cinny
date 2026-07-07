import React, { ComponentProps, ReactNode } from 'react';
import { Box } from 'folds';
import { useAtomValue } from 'jotai';
import {
  getSidebarPosition,
  isHorizontalDockPosition,
  shellLayoutAtom,
} from '../../state/shellLayout';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';

type ClientLayoutProps = {
  nav: ReactNode;
  children: ReactNode;
};
export function ClientLayout({ nav, children }: ClientLayoutProps) {
  const screenSize = useScreenSizeContext();
  const shellLayout = useAtomValue(shellLayoutAtom);
  const sidebarPosition = getSidebarPosition(shellLayout);
  // Mobile keeps its own dedicated layout regardless of this setting.
  const horizontal = screenSize !== ScreenSize.Mobile && isHorizontalDockPosition(sidebarPosition);

  let direction: ComponentProps<typeof Box>['direction'];
  if (horizontal) {
    direction = sidebarPosition === 'bottom' ? 'ColumnReverse' : 'Column';
  } else {
    direction = sidebarPosition === 'right' ? 'RowReverse' : undefined;
  }

  return (
    <Box grow="Yes" direction={direction} style={{ minWidth: 0, minHeight: 0 }}>
      <Box shrink="No">{nav}</Box>
      <Box grow="Yes" style={{ minWidth: 0, minHeight: 0 }}>
        {children}
      </Box>
    </Box>
  );
}
