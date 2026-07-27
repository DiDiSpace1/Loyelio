import {defineRouting} from 'next-intl/routing';

export const locales = ['fr', 'en', 'zh'] as const;

export const routing = defineRouting({
  defaultLocale: 'fr',
  localeDetection: false,
  localePrefix: 'always',
  locales
});

export type Locale = (typeof locales)[number];
