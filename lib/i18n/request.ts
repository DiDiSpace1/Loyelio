import {getRequestConfig} from 'next-intl/server';

import {locales, type Locale} from './routing';

function isLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : 'fr';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
