import {redirect} from 'next/navigation';

import {localizedPath} from './navigation';
import {createSupabaseServerClient} from './supabase/server';

export async function getCurrentUserWorkspace(locale: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(localizedPath(locale, '/login'));
  }

  const {data: profile, error} = await supabase
    .from('profiles')
    .select('id, email, full_name, default_workspace_id, country_code, locale')
    .eq('id', user.id)
    .single();

  if (error || !profile?.default_workspace_id) {
    throw new Error(error?.message ?? 'No default workspace found for this user.');
  }

  return {
    profile,
    supabase,
    user,
    workspaceId: profile.default_workspace_id as string
  };
}
