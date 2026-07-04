import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend, { HttpBackendOptions } from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';
import dayjs from 'dayjs';
// SelfMatrix: 言語パック追加時は dayjs ロケールもここに追加する (import 'dayjs/locale/<lng>' + syncDayjsLocale のマッピング)。
import 'dayjs/locale/ja';
import { trimTrailingSlash } from './utils/common';

// SelfMatrix: i18next の言語変化に dayjs のグローバルロケールを連動させる。
const syncDayjsLocale = (lng?: string) => {
  const language = lng?.split('-')[0];
  dayjs.locale(language === 'ja' ? 'ja' : 'en');
};

i18n.on('languageChanged', syncDayjsLocale);

i18n
  // i18next-http-backend
  // loads translations from your server
  // https://github.com/i18next/i18next-http-backend
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init<HttpBackendOptions>({
    debug: false,
    fallbackLng: 'en',
    supportedLngs: ['en', 'de', 'ja'],
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    load: 'languageOnly',
    backend: {
      loadPath: `${trimTrailingSlash(import.meta.env.BASE_URL)}/public/locales/{{lng}}.json`,
    },
  })
  .then(() => {
    // SelfMatrix: languageChanged が init 時に発火しないケースの保険として、初期同期を明示的に行う。
    syncDayjsLocale(i18n.resolvedLanguage);
  });

export default i18n;
