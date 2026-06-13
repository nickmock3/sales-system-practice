import { apiFetch } from "@/lib/api";
import {
  percentToDecimalRate,
  taxRateChangesResponseSchema,
  taxRateListResponseSchema,
  taxRateResponseSchema,
} from "./_schemas";
import type {
  TaxCategory,
  TaxRateChange,
  TaxRateChangeFormValues,
  TaxRateFormValues,
  TaxRateSummary,
} from "./_types";

const toChangeTaxRateRequest = (
  values: TaxRateChangeFormValues | TaxRateFormValues,
) => ({
  rate: percentToDecimalRate(values.ratePercent),
  effectiveFrom: values.effectiveFrom,
});

export const fetchTaxRates = async (
  asOf?: string,
): Promise<TaxRateSummary[]> =>
  taxRateListResponseSchema.parse(
    await apiFetch<unknown>(
      asOf
        ? `/api/tax-rates?asOf=${encodeURIComponent(asOf)}`
        : "/api/tax-rates",
    ),
  );

export const fetchTaxRateChanges = async (
  taxCategory: TaxCategory,
): Promise<TaxRateChange[]> =>
  taxRateChangesResponseSchema.parse(
    await apiFetch<unknown>(`/api/tax-rates/${taxCategory}/changes`),
  );

export const fetchTaxRateAsOf = async (
  taxCategory: TaxCategory,
  asOf: string,
): Promise<TaxRateSummary> =>
  taxRateResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/tax-rates/${taxCategory}?asOf=${encodeURIComponent(asOf)}`,
    ),
  );

export const changeTaxRate = async (
  taxCategory: TaxCategory,
  values: TaxRateChangeFormValues | TaxRateFormValues,
): Promise<TaxRateSummary> =>
  taxRateResponseSchema.parse(
    await apiFetch<unknown>(`/api/tax-rates/${taxCategory}/changes`, {
      method: "POST",
      body: toChangeTaxRateRequest(values),
    }),
  );
