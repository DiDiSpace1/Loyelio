import type {MetadataRoute} from 'next';

import {getAppUrl} from '@/lib/billing/config';
import {locales} from '@/lib/i18n/routing';

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getAppUrl();
  const publicRoutes = [
    {changeFrequency: 'weekly' as const, path: '', priority: 1},
    {changeFrequency: 'monthly' as const, path: '/contact', priority: 0.6},
    {changeFrequency: 'yearly' as const, path: '/privacy', priority: 0.4},
    {changeFrequency: 'yearly' as const, path: '/terms', priority: 0.4}
  ];

  return publicRoutes.flatMap((route) => {
    const languages = Object.fromEntries(locales.map((locale) => [locale, `${appUrl}/${locale}${route.path}`]));

    return locales.map((locale) => ({
      alternates: {
        languages
      },
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      url: `${appUrl}/${locale}${route.path}`
    }));
  });
}
