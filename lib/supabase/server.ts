import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';

import {getSupabaseEnv} from './env';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const {supabaseAnonKey, supabaseUrl} = getSupabaseEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({name, value, options}) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Server Actions and Route Handlers can.
        }
      }
    }
  });
}
