import {
  type ChangeTiming,
  classifyChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  normalizeEffectiveDate,
} from "@/lib/master-change-status";
import type { ProductChange } from "./_types";

export type { ChangeTiming };
export {
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  normalizeEffectiveDate,
};

export const classifyProductChange = (
  change: ProductChange,
  businessDate: string,
  currentEffectiveFrom: string | undefined,
): ChangeTiming => classifyChange(change, businessDate, currentEffectiveFrom);

export const buildProductChangeKey = (change: ProductChange) =>
  [
    normalizeEffectiveDate(change.effectiveFrom),
    change.name,
    change.unit,
    change.standardUnitPrice,
    change.taxCategory,
    change.isDiscontinued,
  ].join("|");
