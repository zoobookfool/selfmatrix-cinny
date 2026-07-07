import React, { ReactNode } from 'react';
import { Box } from 'folds';
import { useAtomValue } from 'jotai';
import {
  getSidebarPosition,
  isHorizontalDockPosition,
  shellLayoutAtom,
} from '../../state/shellLayout';

type SidebarContentProps = {
  scrollable: ReactNode;
  sticky: ReactNode;
};
export function SidebarContent({ scrollable, sticky }: SidebarContentProps) {
  const shellLayout = useAtomValue(shellLayoutAtom);
  const sidebarPosition = getSidebarPosition(shellLayout);
  const horizontal = isHorizontalDockPosition(sidebarPosition);
  const direction = horizontal ? 'Row' : 'Column';
  const swapHorizontalEnds = sidebarPosition === 'bottom';

  return (
    <>
      {swapHorizontalEnds && (
        <Box direction={direction} shrink="No">
          {sticky}
        </Box>
      )}
      <Box direction={direction} grow="Yes" style={{ minWidth: 0, minHeight: 0 }}>
        {scrollable}
      </Box>
      {!swapHorizontalEnds && (
        <Box direction={direction} shrink="No">
          {sticky}
        </Box>
      )}
    </>
  );
}
