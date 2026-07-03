import React, { useRef } from 'react';
import { Scroll } from 'folds';
import { useAtomValue } from 'jotai';

import {
  Sidebar,
  SidebarContent,
  SidebarStackSeparator,
  SidebarStack,
} from '../../components/sidebar';
import {
  DirectTab,
  HomeTab,
  SpaceTabs,
  InboxTab,
  ExploreTab,
  SettingsTab,
  UnverifiedTab,
  SearchTab,
} from './sidebar';
import { CreateTab } from './sidebar/CreateTab';
import { useClientConfig } from '../../hooks/useClientConfig';
import {
  getSidebarPosition,
  isHorizontalDockPosition,
  shellLayoutAtom,
} from '../../state/shellLayout';

export function SidebarNav() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { hideExplore } = useClientConfig();
  const shellLayout = useAtomValue(shellLayoutAtom);
  const horizontal = isHorizontalDockPosition(getSidebarPosition(shellLayout));

  return (
    <Sidebar>
      <SidebarContent
        scrollable={
          <Scroll
            ref={scrollRef}
            variant="Background"
            size="0"
            direction={horizontal ? 'Horizontal' : 'Vertical'}
            style={
              horizontal
                ? { display: 'flex', flexDirection: 'row', alignItems: 'center' }
                : undefined
            }
          >
            <SidebarStack>
              <HomeTab />
              <DirectTab />
            </SidebarStack>
            <SpaceTabs scrollRef={scrollRef} />
            <SidebarStackSeparator />
            <SidebarStack>
              {!hideExplore && <ExploreTab />}
              <CreateTab />
            </SidebarStack>
          </Scroll>
        }
        sticky={
          <>
            <SidebarStackSeparator />
            <SidebarStack>
              <SearchTab />
              <UnverifiedTab />
              <InboxTab />
              <SettingsTab />
            </SidebarStack>
          </>
        }
      />
    </Sidebar>
  );
}
