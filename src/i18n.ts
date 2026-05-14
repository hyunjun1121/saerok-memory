import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import en from './locales/en.json';

const savedLanguage = typeof localStorage !== 'undefined' ? localStorage.getItem('memoryGardenLang') || 'ko' : 'ko';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      ja: { translation: ja },
      en: { translation: en },
    },
    lng: savedLanguage,
    fallbackLng: 'ko',
    interpolation: { escapeValue: false },
  });

export default i18n;
