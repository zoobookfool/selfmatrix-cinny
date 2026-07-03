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
  const horizontal = isHorizontalDockPosition(getSidebarPosition(shellLayout));
  const direction = horizontal ? 'Row' : 'Column';

  return (
    <>
      <Box direction={direction} grow="Yes">
        {scrollable}
      </Box>
      <Box direction={direction} shrink="No">
        {sticky}
      </Box>
    </>
  );
}
