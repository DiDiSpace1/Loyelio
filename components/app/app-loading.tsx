const navItems = ['dashboard', 'properties', 'tenants', 'bail', 'transactions', 'documents', 'tax', 'settings'];

export function AppLoadingShell() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="fixed inset-y-0 left-0 hidden w-[226px] border-r border-[var(--line-soft)] bg-[var(--background)] px-4 py-6 lg:block">
        <div className="flex items-center gap-2 px-2">
          <div className="h-8 w-8 animate-pulse rounded-md bg-[var(--accent-soft)]" />
          <div className="h-7 w-24 animate-pulse rounded-md bg-[#d9e8e4]" />
        </div>
        <div className="mt-2 h-4 w-20 animate-pulse rounded bg-[#e7efec]" />
        <div className="mt-8 grid gap-2">
          {navItems.map((item, index) => (
            <div className={['h-9 animate-pulse rounded-md', index === 0 ? 'bg-[#e6f3ef]' : 'bg-[#edf4f1]'].join(' ')} key={item} />
          ))}
        </div>
        <div className="absolute inset-x-4 bottom-5 grid gap-3">
          <div className="h-[72px] animate-pulse rounded-lg border border-[var(--line-soft)] bg-white/65" />
          <div className="h-9 animate-pulse rounded-md bg-[#edf4f1]" />
          <div className="h-9 animate-pulse rounded-md bg-[#edf4f1]" />
        </div>
      </aside>

      <div className="lg:pl-[226px]">
        <header className="sticky top-0 z-10 border-b border-[var(--line-soft)] bg-[var(--background)]/95 px-5 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 animate-pulse rounded-md bg-[var(--accent-soft)]" />
            <div className="h-6 w-20 animate-pulse rounded-md bg-[#d9e8e4]" />
          </div>
          <nav className="mt-3 flex gap-2 overflow-hidden pb-1">
            {navItems.slice(0, 7).map((item) => (
              <div className="h-9 w-16 shrink-0 animate-pulse rounded-md border border-[var(--line)] bg-white" key={item} />
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          <AppContentLoading />
        </main>
      </div>
    </div>
  );
}

export function AppContentLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="relative">
      <div className="mb-8 flex flex-col gap-5 border-b border-[var(--line-soft)] pb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="h-9 w-36 animate-pulse rounded-md bg-[#d9e8e4]" />
          <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded bg-[#e7efec]" />
        </div>
        <div className="flex gap-3">
          <div className="h-11 w-24 animate-pulse rounded-lg border border-[var(--line)] bg-white" />
          <div className="h-11 w-28 animate-pulse rounded-lg bg-[var(--accent)]/80" />
        </div>
      </div>

      <div className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-soft)] bg-white text-[var(--accent)] shadow-sm">
        <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['one', 'two', 'three', 'four'].map((item) => (
          <div className="h-36 animate-pulse rounded-xl border border-[var(--line-soft)] bg-white shadow-sm" key={item} />
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="h-72 animate-pulse rounded-xl border border-[var(--line-soft)] bg-white shadow-sm" />
        <div className="h-72 animate-pulse rounded-xl border border-[var(--line-soft)] bg-white shadow-sm" />
      </section>
    </div>
  );
}
