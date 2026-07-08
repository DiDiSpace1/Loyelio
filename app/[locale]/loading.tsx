export default function LoadingPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 h-8 w-48 animate-pulse rounded-md bg-[#e7e3d8]" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-lg border border-[var(--line)] bg-white" />
          <div className="h-32 animate-pulse rounded-lg border border-[var(--line)] bg-white" />
          <div className="h-32 animate-pulse rounded-lg border border-[var(--line)] bg-white" />
        </div>
        <div className="mt-8 h-72 animate-pulse rounded-lg border border-[var(--line)] bg-white" />
      </div>
    </main>
  );
}
