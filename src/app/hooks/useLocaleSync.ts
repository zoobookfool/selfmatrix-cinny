import { useEffect } from 'react';
import i18n from '../i18n';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

// SelfMatrix: 言語設定 ('system' | 'en' | 'ja') を i18next に反映する。
// i18next-browser-languagedetector が 'system' 時の自動検出を担うため、
// 明示的な言語が選ばれている場合のみ changeLanguage を呼ぶ。
export const SUPPORTED_LANGUAGES = ['en', 'ja'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const detectSystemLanguage = (): SupportedLanguage => {
  const navigatorLanguages =
    typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];

  const matched = navigatorLanguages
    .map((lang) => lang?.split('-')[0])
    .map((languageOnly) => SUPPORTED_LANGUAGES.find((supported) => supported === languageOnly))
    .find((match) => match !== undefined);

  return matched ?? 'en';
};

export const useLocaleSync = (): void => {
  const [language] = useSetting(settingsAtom, 'language');

  useEffect(() => {
    const targetLanguage = language === 'system' ? detectSystemLanguage() : language;
    if (i18n.language !== targetLanguage) {
      i18n.changeLanguage(targetLanguage);
    }
  }, [language]);
};
