'use client';

import { useLanguage } from '../contexts/LanguageContext';

const languages = [
  { code: 'en' as const, label: 'EN' },
  { code: 'ar' as const, label: 'AR' },
];

export default function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`flex gap-1 ${compact ? '' : 'flex-wrap'}`}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLanguage(lang.code)}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            language === lang.code
              ? 'bg-amber-500 text-black'
              : 'bg-zinc-800 text-zinc-400 hover:text-amber-300'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
