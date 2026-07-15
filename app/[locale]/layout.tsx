import type {Metadata} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';

import '../globals.css';
import {CookieNotice} from '@/components/app/cookie-notice';
import {MessageProvider} from '@/components/message/MessageProvider';
import {locales, type Locale} from '@/lib/i18n/routing';

export const metadata: Metadata = {
  description: 'Loyers, justificatifs et dossier fiscal pour petits bailleurs LMNP.',
  icons: {
    apple: '/logo.png',
    icon: '/logo.png',
    shortcut: '/logo.png'
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    description: 'Classez vos loyers, factures et contrats, puis exportez un dossier fiscal clair.',
    locale: 'fr_FR',
    siteName: 'Loyelio',
    title: 'Loyelio',
    type: 'website'
  },
  robots: {
    follow: true,
    index: true
  },
  title: {
    default: 'Loyelio',
    template: '%s | Loyelio'
  }
};

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export default async function LocaleLayout({children, params}: LocaleLayoutProps) {
  const {locale} = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <MessageProvider>
            {children}
            <CookieNotice />
          </MessageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
