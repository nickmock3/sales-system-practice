export type ChangeTiming = "current" | "future" | "past";

export type EffectiveDated = {
  readonly effectiveFrom: string;
};

export const normalizeEffectiveDate = (value: string) => value.slice(0, 10);

export const getBusinessDate = (now: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const findCurrentEffectiveFrom = <T extends EffectiveDated>(
  changes: readonly T[],
  businessDate: string,
): string | undefined => {
  const current = changes.find(
    (change) => normalizeEffectiveDate(change.effectiveFrom) <= businessDate,
  );

  return current
    ? normalizeEffectiveDate(current.effectiveFrom)
    : undefined;
};

export const classifyChange = <T extends EffectiveDated>(
  change: T,
  businessDate: string,
  currentEffectiveFrom: string | undefined,
): ChangeTiming => {
  const effectiveDate = normalizeEffectiveDate(change.effectiveFrom);

  if (effectiveDate > businessDate) {
    return "future";
  }

  if (effectiveDate === currentEffectiveFrom) {
    return "current";
  }

  return "past";
};

export const isEffectiveOnOrBeforeToday = (effectiveFrom: string) =>
  normalizeEffectiveDate(effectiveFrom) <= getBusinessDate();
