import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import fr from './fr.json';

export const LANG_STORAGE_KEY = 'gymdz.lang';
export const SUPPORTED_LANGS = ['ar', 'fr'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

export function isAppLang(value: unknown): value is AppLang {
  return value === 'ar' || value === 'fr';
}

export function dirForLang(lang: AppLang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function getInitialLang(): AppLang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (isAppLang(stored)) return stored;
  } catch {
    /* localStorage unavailable (SSR / privacy mode) */
  }
  return 'fr';
}

export function applyDirection(lang: AppLang): void {
  document.documentElement.setAttribute('dir', dirForLang(lang));
  document.documentElement.setAttribute('lang', lang);
}

export async function initI18n(): Promise<typeof i18n> {
  const lang = getInitialLang();
  await i18n.use(initReactI18next).init({
    resources: {
      ar: { translation: ar },
      fr: { translation: fr },
    },
    lng: lang,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  applyDirection(lang);
  return i18n;
}

export async function changeLanguage(lang: AppLang): Promise<void> {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* localStorage unavailable */
  }
  await i18n.changeLanguage(lang);
  applyDirection(lang);
}

export default i18n;
