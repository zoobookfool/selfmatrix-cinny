import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSpacing } from '../state/settings';

export type MessageSpacingItem = {
  name: string;
  spacing: MessageSpacing;
};

export const useMessageSpacingItems = (): MessageSpacingItem[] => {
  const { t, i18n } = useTranslation();

  return useMemo(
    () => [
      {
        spacing: '0',
        name: t('settings.general.message_spacing_names.none'),
      },
      {
        spacing: '100',
        name: t('settings.general.message_spacing_names.ultra_small'),
      },
      {
        spacing: '200',
        name: t('settings.general.message_spacing_names.extra_small'),
      },
      {
        spacing: '300',
        name: t('settings.general.message_spacing_names.small'),
      },
      {
        spacing: '400',
        name: t('settings.general.message_spacing_names.normal'),
      },
      {
        spacing: '500',
        name: t('settings.general.message_spacing_names.large'),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  );
};
