'use server';

import {redirect} from 'next/navigation';

import {localizedPath} from '@/lib/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value.trim();
}

export async function signInAction(formData: FormData) {
  const email = getRequiredValue(formData, 'email');
  const password = getRequiredValue(formData, 'password');
  const locale = getRequiredValue(formData, 'locale');
  const supabase = await createSupabaseServerClient();

  const {error} = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`${localizedPath(locale, '/login')}?error=invalid_credentials`);
  }

  redirect(localizedPath(locale, '/dashboard'));
}

export async function signUpAction(formData: FormData) {
  const email = getRequiredValue(formData, 'email');
  const password = getRequiredValue(formData, 'password');
  const countryCode = getRequiredValue(formData, 'country');
  const locale = getRequiredValue(formData, 'locale');
  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const {data, error} = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        country_code: countryCode,
        locale
      },
      emailRedirectTo: `${appUrl}${localizedPath(locale, '/auth/callback')}`
    }
  });

  if (error) {
    redirect(`${localizedPath(locale, '/login')}?error=signup_failed`);
  }

  if (!data.session) {
    redirect(`${localizedPath(locale, '/login')}?registered=check_email`);
  }

  redirect(localizedPath(locale, '/dashboard'));
}
