import React from 'react';
import { Box, Text, IconButton, Icon, Icons, Scroll, Button, config, toRem } from 'folds';
import { Trans, useTranslation } from 'react-i18next';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import CinnySVG from '../../../../../public/res/svg/cinny.svg';
import { clearCacheAndReload } from '../../../../client/initMatrix';
import { useMatrixClient } from '../../../hooks/useMatrixClient';

type AboutProps = {
  requestClose: () => void;
};
export function About({ requestClose }: AboutProps) {
  const { t } = useTranslation();
  const mx = useMatrixClient();

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              {t('settings.about.title')}
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box gap="400">
                <Box shrink="No">
                  <img
                    style={{ width: toRem(60), height: toRem(60) }}
                    src={CinnySVG}
                    alt={t('settings.about.logo_alt')}
                  />
                </Box>
                <Box direction="Column" gap="300">
                  <Box direction="Column" gap="100">
                    <Box gap="100" alignItems="End">
                      <Text size="H3">SelfMatrix</Text>
                      <Text size="T200">v4.12.3</Text>
                    </Box>
                    <Text>{t('settings.about.tagline')}</Text>
                  </Box>

                  <Box gap="200" wrap="Wrap">
                    <Button
                      as="a"
                      href="https://github.com/zoobookfool/selfmatrix-cinny"
                      rel="noreferrer noopener"
                      target="_blank"
                      variant="Secondary"
                      fill="Soft"
                      size="300"
                      radii="300"
                      before={<Icon src={Icons.Code} size="100" filled />}
                    >
                      <Text size="B300">{t('settings.about.source_code')}</Text>
                    </Button>
                    <Button
                      as="a"
                      href="https://cinny.in/#sponsor"
                      rel="noreferrer noopener"
                      target="_blank"
                      variant="Critical"
                      fill="Soft"
                      size="300"
                      radii="300"
                      before={<Icon src={Icons.Heart} size="100" filled />}
                    >
                      <Text size="B300">{t('settings.about.support')}</Text>
                    </Button>
                  </Box>
                </Box>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">{t('settings.about.options')}</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title={t('settings.about.clear_cache.title')}
                    description={t('settings.about.clear_cache.description')}
                    after={
                      <Button
                        onClick={() => clearCacheAndReload(mx)}
                        variant="Secondary"
                        fill="Soft"
                        size="300"
                        radii="300"
                        outlined
                      >
                        <Text size="B300">{t('settings.about.clear_cache.button')}</Text>
                      </Button>
                    }
                  />
                </SequenceCard>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">{t('settings.about.credits.title')}</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <Box
                    as="ul"
                    direction="Column"
                    gap="200"
                    style={{
                      margin: 0,
                      paddingLeft: config.space.S400,
                    }}
                  >
                    <li>
                      <Text size="T300">
                        <Trans i18nKey="settings.about.credits.matrix_js_sdk">
                          <a
                            href="https://github.com/matrix-org/matrix-js-sdk"
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            matrix-js-sdk
                          </a>
                          <a
                            href="https://matrix.org/foundation"
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            The Matrix.org Foundation C.I.C
                          </a>
                          <a
                            href="http://www.apache.org/licenses/LICENSE-2.0"
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            Apache 2.0
                          </a>
                        </Trans>
                      </Text>
                    </li>
                    <li>
                      <Text size="T300">
                        <Trans i18nKey="settings.about.credits.twemoji_colr">
                          <a
                            href="https://github.com/mozilla/twemoji-colr"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            twemoji-colr
                          </a>
                          <a href="https://mozilla.org/" target="_blank" rel="noreferrer noopener">
                            Mozilla Foundation
                          </a>
                          <a
                            href="http://www.apache.org/licenses/LICENSE-2.0"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Apache 2.0
                          </a>
                        </Trans>
                      </Text>
                    </li>
                    <li>
                      <Text size="T300">
                        <Trans i18nKey="settings.about.credits.twemoji">
                          <a
                            href="https://twemoji.twitter.com"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Twemoji
                          </a>
                          <a
                            href="https://twemoji.twitter.com"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Twitter, Inc and other contributors
                          </a>
                          <a
                            href="https://creativecommons.org/licenses/by/4.0/"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            CC-BY 4.0
                          </a>
                        </Trans>
                      </Text>
                    </li>
                    <li>
                      <Text size="T300">
                        <Trans i18nKey="settings.about.credits.material_sound">
                          <a
                            href="https://material.io/design/sound/sound-resources.html"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Material sound resources
                          </a>
                          <a href="https://google.com" target="_blank" rel="noreferrer noopener">
                            Google
                          </a>
                          <a
                            href="https://creativecommons.org/licenses/by/4.0/"
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            CC-BY 4.0
                          </a>
                        </Trans>
                      </Text>
                    </li>
                  </Box>
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
