import Link from 'next/link';
import {getLocale, getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';

import {localizedPath} from '@/lib/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';

const navItems = [
  {href: '/dashboard', key: 'dashboard'},
  {href: '/properties', key: 'properties'},
  {href: '/tenants', key: 'tenants'},
  {href: '/documents', key: 'documents'},
  {href: '/tax', key: 'tax'},
  {href: '/settings', key: 'settings'}
] as const;

export async function AppShell({children}: {children: React.ReactNode}) {
  const t = await getTranslations('nav');
  const common = await getTranslations('common');
  const locale = await getLocale();
  let userEmail: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: {user}
    } = await supabase.auth.getUser();

    if (!user) {
      redirect(localizedPath(locale, '/login'));
    }

    userEmail = user.email ?? null;
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Missing Supabase environment variables.') {
      throw error;
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[var(--line)] bg-white px-4 py-5 lg:block">
        <Link href="/dashboard" className="block px-2 text-lg font-semibold">
          {common('appName')}
        </Link>
        {userEmail ? <p className="mt-2 truncate px-2 text-xs text-[var(--muted)]">{userEmail}</p> : null}
        <nav className="mt-8 grid gap-1">
          {navItems.map((item) => (
            <Link
              className="focus-ring rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[#f2f0ea] hover:text-[#20201d]"
              href={item.href}
              key={item.key}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
        {userEmail ? (
          <form action={localizedPath(locale, '/logout')} className="absolute inset-x-4 bottom-5" method="post">
            <button className="focus-ring w-full rounded-md border border-[var(--line)] px-3 py-2 text-left text-sm font-medium text-[var(--muted)] hover:bg-[#f2f0ea]" type="submit">
              {common('logout')}
            </button>
          </form>
        ) : null}
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-white/95 px-5 py-4 backdrop-blur lg:hidden">
          <div className="font-semibold">{common('appName')}</div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link className="shrink-0 rounded-md border border-[var(--line)] px-3 py-2 text-xs" href={item.href} key={item.key}>
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
