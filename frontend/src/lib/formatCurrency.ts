const inrOptions: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

const inrFormatter = new Intl.NumberFormat("en-IN", inrOptions);

/**
 * Format a rupee amount with Indian grouping (e.g. ₹1,50,000). Missing or invalid values show ₹0.
 */
export function formatInr(value: number | null | undefined): string {
  const n = value == null || Number.isNaN(Number(value)) ? 0 : Number(value);
  return inrFormatter.format(Math.round(n));
}

/**
 * Same as {@link formatInr} but keeps a sign prefix for non-zero deltas (e.g. +₹12,00,000).
 */
export function formatSignedInrRupees(rupeeDelta: number | null | undefined): string {
  const n = rupeeDelta == null || Number.isNaN(Number(rupeeDelta)) ? 0 : Math.round(Number(rupeeDelta));
  return new Intl.NumberFormat("en-IN", {
    ...inrOptions,
    signDisplay: "exceptZero",
  }).format(n);
}

/**
 * Scenario / dashboard field `logistics_cost_musd` is displayed as Indian Rupees: values are treated as ₹ Crore
 * (same numeric from the API; multiplied by 1 Cr rupees for display).
 */
export function formatScenarioLogisticsCostInr(croreInr: number | null | undefined): string {
  const c = croreInr == null || Number.isNaN(Number(croreInr)) ? 0 : Number(croreInr);
  return formatInr(c * 1e7);
}
