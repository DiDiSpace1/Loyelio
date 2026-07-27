'use client';

import NextLink from 'next/link';
import {useLocale} from 'next-intl';
import type {ComponentProps} from 'react';

type LocalizedLinkProps = ComponentProps<typeof NextLink>;

function localizePath(pathname: string, locale: string) {
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /^\/(fr|en|zh)(?:\/|$)/.test(pathname)) {
    return pathname;
  }

  return `/${locale}${pathname}`;
}

export function Link({href, ...props}: LocalizedLinkProps) {
  const locale = useLocale();
  const localizedHref =
    typeof href === 'string'
      ? localizePath(href, locale)
      : {
          ...href,
          pathname: href.pathname ? localizePath(href.pathname, locale) : href.pathname
        };

  return <NextLink href={localizedHref} {...props} />;
}
