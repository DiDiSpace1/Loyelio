export type CountryCode = 'FR';
export type TaxRegime = 'LMNP';

export type CountryConfig = {
  countryCode: CountryCode;
  defaultCurrency: 'EUR';
  defaultLocale: 'fr';
  supportedTaxRegimes: TaxRegime[];
};

export const countryConfigs: Record<CountryCode, CountryConfig> = {
  FR: {
    countryCode: 'FR',
    defaultCurrency: 'EUR',
    defaultLocale: 'fr',
    supportedTaxRegimes: ['LMNP']
  }
};
