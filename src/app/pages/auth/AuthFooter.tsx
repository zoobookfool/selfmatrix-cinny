import React from 'react';
import { Box, Text } from 'folds';
import { useTranslation } from 'react-i18next';
import * as css from './styles.css';

export function AuthFooter() {
  const { t } = useTranslation();
  return (
    <Box className={css.AuthFooter} justifyContent="Center" gap="400" wrap="Wrap">
      <Text
        as="a"
        size="T300"
        href="https://github.com/zoobookfool/selfmatrix"
        target="_blank"
        rel="noreferrer"
      >
        {t('auth.common.about')}
      </Text>
      <Text
        as="a"
        size="T300"
        href="https://github.com/zoobookfool/selfmatrix-cinny/releases"
        target="_blank"
        rel="noreferrer"
      >
        v4.12.3
      </Text>
      <Text as="a" size="T300" href="https://matrix.org" target="_blank" rel="noreferrer">
        {t('auth.common.powered_by_matrix')}
      </Text>
    </Box>
  );
}
