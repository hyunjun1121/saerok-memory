import i18n from 'i18next';
import type { BackendModule, ReadCallback } from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from '@/locales/ko.json';

const localeLoaders = {
  en: () => import('@/locales/en.json').then((module) => module.default),
  ja: () => import('@/locales/ja.json').then((module) => module.default),
};

const lazyLocaleBackend: BackendModule = {
  type: 'backend',
  init: () => undefined,
  read(language: string, _namespace: string, callback: ReadCallback) {
    if (language === 'ko') {
      callback(null, ko);
      return;
    }
    const loader = localeLoaders[language as keyof typeof localeLoaders];
    if (!loader) {
      callback(new Error(`unsupported-locale:${language}`), false);
      return;
    }
    void loader().then(
      (translations) => callback(null, translations),
      (error: unknown) => callback(error instanceof Error ? error : new Error('locale-load-failed'), false),
    );
  },
};

const savedLanguage = typeof localStorage !== 'undefined' ? localStorage.getItem('memoryGardenLang') || 'ko' : 'ko';

i18n
  .use(lazyLocaleBackend)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
    },
    partialBundledLanguages: true,
    supportedLngs: ['ko', 'ja', 'en'],
    load: 'languageOnly',
    lng: savedLanguage,
    fallbackLng: 'ko',
    interpolation: { escapeValue: false },
  });

export default i18n;
