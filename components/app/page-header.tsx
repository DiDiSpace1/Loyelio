export function PageHeader({title, subtitle, action}: {title: string; subtitle: string; action?: React.ReactNode}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 max-w-2xl leading-7 text-[var(--muted)]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
