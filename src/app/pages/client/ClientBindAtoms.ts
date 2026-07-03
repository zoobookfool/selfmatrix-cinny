import { ReactNode } from 'react';

import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useBindAtoms } from '../../state/hooks/useBindAtoms';
import { useLocaleSync } from '../../hooks/useLocaleSync';

type ClientBindAtomsProps = {
  children: ReactNode;
};
export function ClientBindAtoms({ children }: ClientBindAtomsProps) {
  const mx = useMatrixClient();
  useBindAtoms(mx);
  useLocaleSync();

  return children;
}
