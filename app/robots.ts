import type {MetadataRoute} from 'next';

import {getAppUrl} from '@/lib/billing/config';
import {locales} from '@/lib/i18n/routing';

export default function robots(): MetadataRoute.Robots {
  const publicPaths = locales.flatMap((locale) => [`/${locale}`, `/${locale}/contact`, `/${locale}/privacy`, `/${locale}/terms`]);
  const privateSegments = [
    'auth',
    'bail',
    'collections',
    'dashboard',
    'documents',
    'forgot-password',
    'login',
    'logout',
    'properties',
    'reminders',
    'reset-password',
    'settings',
    'signup',
    'support',
    'tasks',
    'tax',
    'tenants',
    'transactions'
  ];
  const privatePaths = locales.flatMap((locale) => privateSegments.map((segment) => `/${locale}/${segment}`));

  return {
    rules: [
      {
        allow: ['/', ...publicPaths],
        disallow: ['/api/', ...privateSegments.map((segment) => `/${segment}`), ...privatePaths],
        userAgent: '*'
      }
    ],
    sitemap: `${getAppUrl()}/sitemap.xml`
  };
}
