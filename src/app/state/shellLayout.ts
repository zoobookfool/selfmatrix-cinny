import { atom, useSetAtom } from 'jotai';
import { ClientEvent, MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useEffect } from 'react';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { getAccountData } from '../utils/room';

export type ShellDockPosition = 'left' | 'right' | 'top' | 'bottom';

export type ShellLayoutContent = {
  sidebarPosition?: ShellDockPosition;
  navPosition?: ShellDockPosition;
};

export const DEFAULT_SHELL_LAYOUT: Required<ShellLayoutContent> = {
  sidebarPosition: 'left',
  navPosition: 'left',
};

export const getSidebarPosition = (content?: ShellLayoutContent): ShellDockPosition =>
  content?.sidebarPosition ?? DEFAULT_SHELL_LAYOUT.sidebarPosition;

export const getNavPosition = (content?: ShellLayoutContent): ShellDockPosition =>
  content?.navPosition ?? DEFAULT_SHELL_LAYOUT.navPosition;

export const isHorizontalDockPosition = (position: ShellDockPosition): boolean =>
  position === 'top' || position === 'bottom';

export type ShellLayoutAction = {
  type: 'INITIALIZE' | 'UPDATE';
  content: ShellLayoutContent;
};

const baseShellLayoutAtom = atom<ShellLayoutContent>({});
export const shellLayoutAtom = atom<ShellLayoutContent, [ShellLayoutAction], undefined>(
  (get) => get(baseShellLayoutAtom),
  (get, set, action) => {
    set(baseShellLayoutAtom, action.content);
  }
);

export const useBindShellLayoutAtom = (mx: MatrixClient, shellLayout: typeof shellLayoutAtom) => {
  const setShellLayout = useSetAtom(shellLayout);

  useEffect(() => {
    const shellLayoutEvent = getAccountData(mx, AccountDataEvent.ShellLayout);
    if (shellLayoutEvent) {
      setShellLayout({
        type: 'INITIALIZE',
        content: shellLayoutEvent.getContent<ShellLayoutContent>(),
      });
    }

    const handleAccountData = (event: MatrixEvent) => {
      if (event.getType() === AccountDataEvent.ShellLayout) {
        setShellLayout({
          type: 'UPDATE',
          content: event.getContent<ShellLayoutContent>(),
        });
      }
    };

    mx.on(ClientEvent.AccountData, handleAccountData);
    return () => {
      mx.removeListener(ClientEvent.AccountData, handleAccountData);
    };
  }, [mx, setShellLayout]);
};

export const makeShellLayoutContent = (
  mx: MatrixClient,
  patch: ShellLayoutContent
): ShellLayoutContent => {
  const currentShellLayout =
    getAccountData(mx, AccountDataEvent.ShellLayout)?.getContent<ShellLayoutContent>() ?? {};

  const newShellLayoutContent: ShellLayoutContent = {
    ...currentShellLayout,
    ...patch,
  };

  return newShellLayoutContent;
};
