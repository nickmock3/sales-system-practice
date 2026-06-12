import {
  type ChangeTiming,
  classifyChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  normalizeEffectiveDate,
} from "@/lib/master-change-status";
import type { CustomerChange } from "./_types";

export type { ChangeTiming };
export {
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  normalizeEffectiveDate,
};

export const classifyCustomerChange = (
  change: CustomerChange,
  businessDate: string,
  currentEffectiveFrom: string | undefined,
): ChangeTiming => classifyChange(change, businessDate, currentEffectiveFrom);

export const buildCustomerChangeKey = (change: CustomerChange) =>
  [
    normalizeEffectiveDate(change.effectiveFrom),
    change.name,
    change.address,
    change.phoneNumber,
  ].join("|");
