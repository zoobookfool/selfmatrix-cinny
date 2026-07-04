import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type LanguageItem = {
  value: string;
  name: string;
};

// SelfMatrix: 言語セレクタの選択肢。新しい言語パックを public/locales/<lng>.json に
// 追加したら、ここにも 1 エントリ追加する。
export const useLanguageItems = (): LanguageItem[] => {
  const { t, i18n } = useTranslation();

  return useMemo(
    () => [
      { value: 'system', name: t('settings.general.language_names.system') },
      { value: 'en', name: 'English' },
      { value: 'ja', name: '日本語' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language]
  );
};
