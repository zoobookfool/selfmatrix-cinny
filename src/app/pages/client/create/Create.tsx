import React from 'react';
import { Box, Icon, Icons, Scroll } from 'folds';
import {
  Page,
  PageContent,
  PageContentCenter,
  PageHero,
  PageHeroSection,
} from '../../../components/page';
import { CreateSpaceForm } from '../../../features/create-space';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { useBranding } from '../../../branding/strings';

export function Create() {
  const { navigateSpace } = useRoomNavigate();
  const branding = useBranding();

  return (
    <Page>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              <PageHeroSection>
                <Box direction="Column" gap="700">
                  <PageHero
                    icon={<Icon size="600" src={Icons.Space} />}
                    title={branding.space.createTitle}
                    subTitle={branding.space.createSubTitle}
                  />
                  <CreateSpaceForm onCreate={navigateSpace} />
                </Box>
              </PageHeroSection>
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
