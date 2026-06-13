import {
  type ChangeTiming,
  classifyChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  normalizeEffectiveDate,
} from "@/lib/master-change-status";
import type { CustomerProductPriceChange } from "./_types";

export type { ChangeTiming };
export {
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  normalizeEffectiveDate,
};

export const classifyCustomerProductPriceChange = (
  change: CustomerProductPriceChange,
  businessDate: string,
  currentEffectiveFrom: string | undefined,
): ChangeTiming => classifyChange(change, businessDate, currentEffectiveFrom);

export const buildCustomerProductPriceChangeKey = (
  change: CustomerProductPriceChange,
) =>
  [
    normalizeEffectiveDate(change.effectiveFrom),
    change.unitPrice,
    change.createdAt,
  ].join("|");
