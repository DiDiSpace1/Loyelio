import Link from 'next/link';
import {useTranslations} from 'next-intl';

export function LandingPage() {
  const t = useTranslations('landing');
  const common = useTranslations('common');

  return (
    <main>
      <section className="min-h-[92vh] border-b border-[var(--line)] bg-[#f7f6f2]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1fr_460px] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
              {t('eyebrow')}
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] text-[#20201d] md:text-7xl">
              {t('heroTitle')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              {t('heroCopy')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                href="/login"
              >
                {t('primaryCta')}
              </Link>
              <Link
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-[var(--line)] bg-white px-6 text-sm font-semibold transition hover:border-[#bbb6a8]"
                href="/dashboard"
              >
                {t('secondaryCta')}
              </Link>
            </div>
            <p className="mt-5 text-sm text-[var(--muted)]">{t('proof')}</p>
          </div>

          <div className="flex items-center">
            <div className="w-full rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
                <div>
                  <p className="text-sm font-semibold">{common('appName')}</p>
                  <p className="text-xs text-[var(--muted)]">2026 - LMNP</p>
                </div>
                <div className="rounded-full bg-[#e8f3ef] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  FR
                </div>
              </div>
              <div className="grid gap-3">
                <PreviewRow label={t('featureRent')} value="2 850 EUR" status="OK" />
                <PreviewRow label={t('featureReceipts')} value="37 fichiers" status="A classer" />
                <PreviewRow label={t('featureTax')} value="ZIP + PDF" status="Pret" />
              </div>
              <div className="mt-5 rounded-md bg-[#fbf5e9] p-4 text-sm leading-6 text-[#7a4a11]">
                {t('painCopy')}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--line)] bg-white px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          <Feature title={t('featureRent')} copy="Par mois, locataire, chambre et bail." />
          <Feature title={t('featureReceipts')} copy="Factures, contrats et assurances au même endroit." />
          <Feature title={t('featureTax')} copy="Un dossier propre à partager avec votre comptable." />
        </div>
      </section>
      <footer className="bg-white px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>{common('appName')}</p>
          <div className="flex gap-4">
            <Link className="hover:text-[var(--foreground)]" href="/privacy">
              Confidentialite
            </Link>
            <Link className="hover:text-[var(--foreground)]" href="/terms">
              Conditions
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PreviewRow({label, value, status}: {label: string; value: string; status: string}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 rounded-md border border-[var(--line)] p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{status}</p>
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function Feature({title, copy}: {title: string; copy: string}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-3 leading-7 text-[var(--muted)]">{copy}</p>
    </div>
  );
}
