/**
 * Currency utilities for consistent formatting and conversion across the app.
 * Uses en-US locale for consistent display regardless of device settings.
 */

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

/**
 * List of commonly supported currencies.
 */
export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
];

/**
 * Get currency info by code.
 */
export const getCurrencyInfo = (code: string): CurrencyInfo | undefined => {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code.toUpperCase());
};

/**
 * Get currency symbol by code.
 */
export const getCurrencySymbol = (code: string): string => {
  const info = getCurrencyInfo(code);
  return info?.symbol ?? code;
};

/**
 * Format a number as currency with consistent locale (en-US).
 * This ensures all users see the same format regardless of device settings.
 *
 * @param value - The numeric value to format
 * @param currency - Currency code (e.g., "USD", "EUR")
 * @param options - Additional Intl.NumberFormatOptions
 * @returns Formatted currency string
 */
export const formatCurrency = (
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
): string => {
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const minimumFractionDigits = Math.min(
    options?.minimumFractionDigits ?? 0,
    maximumFractionDigits,
  );

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      ...options,
      maximumFractionDigits,
      minimumFractionDigits,
    }).format(value);
  } catch {
    // Fallback for invalid currency codes with thousand separators
    const symbol = getCurrencySymbol(currency);
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString("en-US", {
      minimumFractionDigits,
      maximumFractionDigits,
    });
    return value < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  }
};

/**
 * Format currency in compact form for space-constrained UIs.
 * Examples: +1.2k, -500, +$2.5k
 */
export const formatCurrencyCompact = (
  value: number,
  options?: {
    showSign?: boolean;
    showSymbol?: boolean;
    currency?: string;
  },
): string => {
  const { showSign = true, showSymbol = false, currency } = options ?? {};

  if (value === 0) return showSymbol && currency ? formatCurrency(0, currency) : "-";

  const abs = Math.abs(value);
  const sign = showSign ? (value > 0 ? "+" : "-") : value < 0 ? "-" : "";
  const prefix = showSymbol && currency ? getCurrencySymbol(currency) : "";

  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}${prefix}${abs.toFixed(0)}`;
};

/**
 * Check if a currency code is valid/supported.
 */
export const isValidCurrency = (code: string): boolean => {
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
};

/**
 * Default currency.
 */
export const DEFAULT_CURRENCY = "USD";

// ============================================================================
// Exchange Rate API Configuration
// ============================================================================

/**
 * Exchange rate API configuration.
 * Default: open.er-api.com (unlimited free)
 * Can be changed to other providers by updating the config.
 */
export interface ExchangeRateApiConfig {
  name: string;
  baseUrl: string;
  getUrl: (baseCurrency: string) => string;
  parseRates: (response: unknown) => Record<string, number>;
}

/**
 * Available API providers.
 * Add new providers here as needed.
 */
export const EXCHANGE_RATE_APIS: Record<string, ExchangeRateApiConfig> = {
  // Open Exchange Rates API - Unlimited free tier
  openExchangeRates: {
    name: "Open Exchange Rates API",
    baseUrl: "https://open.er-api.com/v6",
    getUrl: (baseCurrency: string) =>
      `https://open.er-api.com/v6/latest/${baseCurrency.toUpperCase()}`,
    parseRates: (response: unknown) => {
      const data = response as { rates?: Record<string, number> };
      return data.rates ?? {};
    },
  },
  // ExchangeRate-API (alternative - 1500 requests/month free)
  exchangeRateApi: {
    name: "ExchangeRate-API",
    baseUrl: "https://api.exchangerate-api.com/v4",
    getUrl: (baseCurrency: string) =>
      `https://api.exchangerate-api.com/v4/latest/${baseCurrency.toUpperCase()}`,
    parseRates: (response: unknown) => {
      const data = response as { rates?: Record<string, number> };
      return data.rates ?? {};
    },
  },
};

// Current active API (can be changed)
let currentExchangeRateApi: ExchangeRateApiConfig = EXCHANGE_RATE_APIS.openExchangeRates;

/**
 * Get the current exchange rate API.
 */
export const getCurrentExchangeRateApi = (): ExchangeRateApiConfig => currentExchangeRateApi;

/**
 * Set the active exchange rate API.
 */
export const setExchangeRateApi = (apiKey: keyof typeof EXCHANGE_RATE_APIS): void => {
  if (EXCHANGE_RATE_APIS[apiKey]) {
    currentExchangeRateApi = EXCHANGE_RATE_APIS[apiKey];
  }
};

/**
 * Fetch exchange rates from the API.
 * Rates are relative to the base currency (1 base = X target).
 */
export const fetchExchangeRates = async (
  baseCurrency: string = "USD",
): Promise<{ rates: Record<string, number>; timestamp: string } | null> => {
  try {
    const url = currentExchangeRateApi.getUrl(baseCurrency);
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Exchange rate API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const rates = currentExchangeRateApi.parseRates(data);

    return {
      rates,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to fetch exchange rates:", error);
    return null;
  }
};

/**
 * Convert an amount from one currency to another.
 *
 * @param amount - The amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @param rates - Exchange rates (relative to base currency)
 * @param baseCurrency - The base currency the rates are relative to
 * @returns Converted amount, or original if conversion not possible
 */
export const convertCurrency = (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
  baseCurrency: string = "USD",
): number => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  const base = baseCurrency.toUpperCase();

  // If converting from base currency
  if (from === base && rates[to]) {
    return amount * rates[to];
  }

  // If converting to base currency
  if (to === base && rates[from]) {
    return amount / rates[from];
  }

  // Cross-conversion through base currency
  if (rates[from] && rates[to]) {
    // First convert to base, then to target
    const amountInBase = amount / rates[from];
    return amountInBase * rates[to];
  }

  // Fallback: return original amount if no rate available
  console.warn(`No exchange rate available for ${from} -> ${to}`);
  return amount;
};

/**
 * Check if exchange rates need to be synced (older than 7 days).
 */
export const shouldAutoSyncRates = (lastUpdated: string | null): boolean => {
  if (!lastUpdated) {
    return true;
  }

  const lastUpdate = new Date(lastUpdated);
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceUpdate >= 7;
};

/**
 * Get a human-readable "time ago" string for last sync.
 */
export const getLastSyncText = (lastUpdated: string | null): string => {
  if (!lastUpdated) {
    return "Never synced";
  }

  const lastUpdate = new Date(lastUpdated);
  const now = new Date();
  const diffMs = now.getTime() - lastUpdate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return lastUpdate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
