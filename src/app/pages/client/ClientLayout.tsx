import React, { ReactNode } from 'react';
import { Box } from 'folds';
import { useAtomValue } from 'jotai';
import { getSidebarPosition, shellLayoutAtom } from '../../state/shellLayout';

type ClientLayoutProps = {
  nav: ReactNode;
  children: ReactNode;
};
export function ClientLayout({ nav, children }: ClientLayoutProps) {
  const shellLayout = useAtomValue(shellLayoutAtom);
  const sidebarPosition = getSidebarPosition(shellLayout);
  // Stage 1 only implements left/right docking. top/bottom fall back to left.
  const reverse = sidebarPosition === 'right';

  return (
    <Box grow="Yes" direction={reverse ? 'RowReverse' : undefined}>
      <Box shrink="No">{nav}</Box>
      <Box grow="Yes">{children}</Box>
    </Box>
  );
}
