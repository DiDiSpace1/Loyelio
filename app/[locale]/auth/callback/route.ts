import {NextResponse, type NextRequest} from 'next/server';

import {localizedPath} from '@/lib/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

type CallbackParams = {
  params: Promise<{
    locale: string;
  }>;
};

export async function GET(request: NextRequest, {params}: CallbackParams) {
  const {locale} = await params;
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? localizedPath(locale, '/dashboard');

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
