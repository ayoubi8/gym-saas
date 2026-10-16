import { useTranslation } from 'react-i18next';
import type { FormatLang } from './format';

/** Current UI language mapped to a supported Intl locale ('ar' | 'fr'). */
export function useFormatLang(): FormatLang {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('ar') ? 'ar' : 'fr';
}
