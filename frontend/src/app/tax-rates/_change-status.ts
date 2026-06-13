import {
  type ChangeTiming,
  classifyChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  normalizeEffectiveDate,
} from "@/lib/master-change-status";
import type { TaxRateChange } from "./_types";

export type { ChangeTiming };
export {
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  normalizeEffectiveDate,
};

export const classifyTaxRateChange = (
  change: TaxRateChange,
  businessDate: string,
  currentEffectiveFrom: string | undefined,
): ChangeTiming => classifyChange(change, businessDate, currentEffectiveFrom);

export const buildTaxRateChangeKey = (change: TaxRateChange) =>
  [
    normalizeEffectiveDate(change.effectiveFrom),
    change.taxCategory,
    change.rate,
    change.accountingCategory,
  ].join("|");
