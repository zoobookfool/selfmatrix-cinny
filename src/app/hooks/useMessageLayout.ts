import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageLayout } from '../state/settings';

export type MessageLayoutItem = {
  name: string;
  layout: MessageLayout;
};

export const useMessageLayoutItems = (): MessageLayoutItem[] => {
  const { t, i18n } = useTranslation();

  return useMemo(
    () => [
      {
        layout: MessageLayout.Modern,
        name: t('settings.general.message_layout_names.modern'),
      },
      {
        layout: MessageLayout.Compact,
        name: t('settings.general.message_layout_names.compact'),
      },
      {
        layout: MessageLayout.Bubble,
        name: t('settings.general.message_layout_names.bubble'),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  );
};
