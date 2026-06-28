'use client';

import { useLanguage } from '../contexts/LanguageContext';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';

const messages: Record<string, Record<string, unknown>> = { en, ar };

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }

  return typeof current === 'string' ? current : path;
}

export function useTranslations() {
  const { language } = useLanguage();

  const t = (key: string): string => {
    const langMessages = messages[language] || messages.en;
    return getNestedValue(langMessages, key);
  };

  return { t, language };
}
