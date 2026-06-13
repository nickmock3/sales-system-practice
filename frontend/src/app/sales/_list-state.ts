import {
  saleCorrectionTypeLabels,
  type SaleListItem,
  type SaleSearchParams,
} from "./_types";

export const buildSaleSearchParams = (
  salesDateFrom: string,
  salesDateTo: string,
  customerId: string,
  customerCode: string,
  includeCanceled: boolean,
  includeCorrections: boolean,
): SaleSearchParams => {
  const parsedCustomerId = Number(customerId);

  return {
    salesDateFrom: salesDateFrom.trim() || undefined,
    salesDateTo: salesDateTo.trim() || undefined,
    customerId:
      customerId.trim().length > 0
      && Number.isInteger(parsedCustomerId)
      && parsedCustomerId > 0
        ? parsedCustomerId
        : undefined,
    customerCode: customerCode.trim() || undefined,
    includeCanceled: includeCanceled ? true : undefined,
    includeCorrections: includeCorrections ? true : undefined,
  };
};

export const formatSaleCorrectionSummary = (item: SaleListItem): string => {
  if (!item.correctionType) {
    return "—";
  }

  const label = saleCorrectionTypeLabels[item.correctionType];
  if (item.correctionReason) {
    return `${label}（${item.correctionReason}）`;
  }

  return label;
};
