'use client';

import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {useEffect, useRef} from 'react';

import {useMessage} from './MessageProvider';

function removeMessageParams(pathname: string, searchParams: URLSearchParams) {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete('success');
  nextParams.delete('error');
  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function RouteMessageListener() {
  const message = useMessage();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('routeMessages');
  const lastMessageKeyRef = useRef('');

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const key = `${pathname}:${success ?? ''}:${error ?? ''}`;

    if ((!success && !error) || lastMessageKeyRef.current === key) {
      return;
    }

    lastMessageKeyRef.current = key;

    if (success) {
      const translationKey = `success.${success}`;
      message.success(t.has(translationKey as never) ? t(translationKey as never) : t('success.fallback'));
    }

    if (error) {
      const translationKey = `error.${error}`;
      message.error(t.has(translationKey as never) ? t(translationKey as never) : t('error.fallback'));
    }

    router.replace(removeMessageParams(pathname, searchParams), {scroll: false});
  }, [message, pathname, router, searchParams, t]);

  return null;
}
