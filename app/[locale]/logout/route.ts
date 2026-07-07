import {NextResponse, type NextRequest} from 'next/server';

import {localizedPath} from '@/lib/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

type LogoutParams = {
  params: Promise<{
    locale: string;
  }>;
};

export async function POST(request: NextRequest, {params}: LogoutParams) {
  const {locale} = await params;
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL(localizedPath(locale, '/login'), request.url));
}
