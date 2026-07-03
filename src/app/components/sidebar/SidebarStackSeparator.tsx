import React from 'react';
import { Line, toRem } from 'folds';
import { useAtomValue } from 'jotai';
import {
  getSidebarPosition,
  isHorizontalDockPosition,
  shellLayoutAtom,
} from '../../state/shellLayout';

export function SidebarStackSeparator() {
  const shellLayout = useAtomValue(shellLayoutAtom);
  const horizontal = isHorizontalDockPosition(getSidebarPosition(shellLayout));

  if (horizontal) {
    return (
      <Line
        role="separator"
        direction="Vertical"
        style={{ height: toRem(24), margin: 'auto 0' }}
        variant="Background"
        size="300"
      />
    );
  }

  return (
    <Line
      role="separator"
      style={{ width: toRem(24), margin: '0 auto' }}
      variant="Background"
      size="300"
    />
  );
}
