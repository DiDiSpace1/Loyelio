import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';

export function LandingPage() {
  const locale = useLocale();
  const t = useTranslations('landing');
  const common = useTranslations('common');
  const prefix = locale === 'fr' ? '' : `/${locale}`;
  const localized = (path: string) => `${prefix}${path}`;
  const pricingPlans = [
    {key: 'free', featured: false},
    {key: 'solo', featured: true},
    {key: 'plus', featured: false},
    {key: 'portfolio', featured: false},
    {key: 'custom', featured: false}
  ];

  return (
    <main className="bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line-soft)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link className="text-sm font-semibold text-[var(--accent)]" href={localized('/')}>
            {common('appName')}
          </Link>
          <nav className="hidden items-center gap-6 text-xs font-medium text-[var(--muted)] sm:flex">
            <a className="hover:text-[var(--foreground)]" href="#features">
              {t('navFeatures')}
            </a>
            <a className="hover:text-[var(--foreground)]" href="#pricing">
              {t('navPricing')}
            </a>
            <Link className="hover:text-[var(--foreground)]" href={localized('/login')}>
              {t('navLogin')}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-md border border-[var(--line-soft)] bg-[var(--panel-muted)] p-1 text-xs font-semibold text-[var(--muted)] sm:flex">
              <Link className={languageClass(locale === 'fr')} href="/">
                FR
              </Link>
              <Link className={languageClass(locale === 'en')} href="/en">
                EN
              </Link>
              <Link className={languageClass(locale === 'zh')} href="/zh">
                中文
              </Link>
            </div>
            <Link
              className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              href={localized('/login')}
            >
              {t('navCta')}
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[var(--line-soft)] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1fr_520px] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
              {t('eyebrow')}
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.06] text-[var(--foreground)] md:text-6xl">
              {t('heroTitle')}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)] md:text-lg">
              {t('heroCopy')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                href={localized('/login')}
              >
                {t('primaryCta')}
              </Link>
              <Link
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-[var(--line)] bg-white px-6 text-sm font-semibold transition hover:bg-[var(--panel-muted)]"
                href={localized('/dashboard')}
              >
                {t('secondaryCta')}
              </Link>
            </div>
            <p className="mt-5 text-sm text-[var(--muted)]">{t('proof')}</p>
          </div>

          <div className="flex items-center">
            <div className="w-full rounded-xl border border-[var(--line-soft)] bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-[var(--line-soft)] pb-3">
                <div>
                  <p className="text-sm font-semibold">{common('appName')}</p>
                  <p className="text-xs text-[var(--muted)]">2026 - LMNP</p>
                </div>
                <div className="rounded-md bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  {t('previewStatus')}
                </div>
              </div>
              <div className="grid gap-3">
                <PreviewRow label={t('featureRent')} value="2 850 EUR" status={t('previewRentStatus')} />
                <PreviewRow label={t('featureReceipts')} value="37" status={t('previewDocsStatus')} />
                <PreviewRow label={t('featureTax')} value="ZIP + PDF" status={t('previewTaxStatus')} />
              </div>
              <div className="mt-5 rounded-md border border-[#ffdbce] bg-[#fff7f3] p-4 text-sm leading-6 text-[#773215]">
                {t('painCopy')}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-[var(--line-soft)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">{t('featuresTitle')}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t('featuresCopy')}</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Feature title={t('featureProperties')} copy={t('featurePropertiesCopy')} />
            <Feature title={t('featureRent')} copy={t('featureRentCopy')} accent />
            <Feature title={t('featureReceipts')} copy={t('featureReceiptsCopy')} />
            <Feature title={t('featureTax')} copy={t('featureTaxCopy')} />
          </div>
        </div>
      </section>

      <section id="pricing" className="border-b border-[var(--line-soft)] bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">{t('pricingTitle')}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t('pricingCopy')}</p>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {pricingPlans.map((plan) => (
              <PricingCard
                key={plan.key}
                cta={plan.key === 'custom' ? t('contactCta') : t('startCta')}
                description={t(`pricing.${plan.key}.description`)}
                featured={plan.featured}
                href={plan.key === 'custom' ? 'mailto:contact@habitatlog.com' : localized('/login')}
                name={t(`pricing.${plan.key}.name`)}
                popularLabel={t('popular')}
                price={t(`pricing.${plan.key}.price`)}
                units={t(`pricing.${plan.key}.units`)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-xl bg-[#2c3130] px-6 py-10 text-center text-white shadow-sm sm:px-10">
          <h2 className="text-2xl font-semibold">{t('finalTitle')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#edf2f0]">{t('finalCopy')}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[#008378]"
              href={localized('/login')}
            >
              {t('primaryCta')}
            </Link>
            <a
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-white/10 px-6 text-sm font-semibold text-white transition hover:bg-white/15"
              href="mailto:contact@habitatlog.com"
            >
              {t('contactCta')}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line-soft)] bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>{common('appName')}</p>
          <div className="flex gap-4">
            <Link className="hover:text-[var(--foreground)]" href={localized('/privacy')}>
              {t('privacy')}
            </Link>
            <Link className="hover:text-[var(--foreground)]" href={localized('/terms')}>
              {t('terms')}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function PreviewRow({label, value, status}: {label: string; value: string; status: string}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 rounded-md border border-[var(--line-soft)] p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{status}</p>
      </div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Feature({title, copy, accent = false}: {title: string; copy: string; accent?: boolean}) {
  return (
    <div
      className={
        accent
          ? 'rounded-xl border border-[var(--accent)] bg-[var(--accent)] p-6 text-white shadow-sm'
          : 'rounded-xl border border-[var(--line-soft)] bg-white p-6 shadow-sm'
      }
    >
      <h3 className="text-base font-semibold">{title}</h3>
      <p className={accent ? 'mt-3 text-sm leading-6 text-white/90' : 'mt-3 text-sm leading-6 text-[var(--muted)]'}>
        {copy}
      </p>
    </div>
  );
}

function PricingCard({
  cta,
  description,
  featured,
  href,
  name,
  popularLabel,
  price,
  units
}: {
  cta: string;
  description: string;
  featured: boolean;
  href: string;
  name: string;
  popularLabel: string;
  price: string;
  units: string;
}) {
  return (
    <div
      className={
        featured
          ? 'relative rounded-xl border border-[var(--accent)] bg-white p-5 shadow-sm'
          : 'rounded-xl border border-[var(--line-soft)] bg-white p-5 shadow-sm'
      }
    >
      {featured ? (
        <span className="absolute right-4 top-4 rounded bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
          {popularLabel}
        </span>
      ) : null}
      <h3 className="text-base font-semibold">{name}</h3>
      <p className="mt-4 text-2xl font-semibold tabular-nums">{price}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">{units}</p>
      <p className="mt-4 min-h-12 text-sm leading-6 text-[var(--muted)]">{description}</p>
      <Link
        className={
          featured
            ? 'focus-ring mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]'
            : 'focus-ring mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold transition hover:bg-[var(--panel-muted)]'
        }
        href={href}
      >
        {cta}
      </Link>
    </div>
  );
}

function languageClass(active: boolean) {
  return active
    ? 'rounded bg-white px-2.5 py-1 text-[var(--foreground)] shadow-sm'
    : 'rounded px-2.5 py-1 hover:bg-white/70 hover:text-[var(--foreground)]';
}
