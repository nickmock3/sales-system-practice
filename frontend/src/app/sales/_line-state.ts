import type {
  CreateSaleLineRequest,
  CreateSaleRequest,
  SaleEntryFormValues,
  SaleLineFormValues,
  SalesLinePreview,
} from "./_types";

export type SaleLineDraft = SaleLineFormValues & {
  readonly clientLineId: string;
  readonly preview: SalesLinePreview | null;
  readonly previewStale: boolean;
};

const emptyLineValues = (): SaleLineFormValues => ({
  productId: "",
  quantity: "",
  unitPrice: "",
  manualUnitPriceReason: "",
});

export const createClientLineId = (): string => crypto.randomUUID();

export const createEmptySaleLineDraft = (): SaleLineDraft => ({
  ...emptyLineValues(),
  clientLineId: createClientLineId(),
  preview: null,
  previewStale: false,
});

export const markSaleLinesStale = (
  lines: readonly SaleLineDraft[],
): SaleLineDraft[] =>
  lines.map((line) =>
    line.productId.length > 0 || line.preview !== null
      ? { ...line, previewStale: true }
      : line,
  );

export const applySalesLinePreview = (
  line: SaleLineDraft,
  preview: SalesLinePreview,
): SaleLineDraft => ({
  ...line,
  productId: String(preview.productId),
  unitPrice: formatUnitPriceInput(preview.autoUnitPrice),
  preview,
  previewStale: false,
});

export const updateSaleLineDraft = (
  line: SaleLineDraft,
  patch: Partial<SaleLineFormValues>,
): SaleLineDraft => {
  const nextLine: SaleLineDraft = { ...line, ...patch };

  if (patch.productId !== undefined && patch.productId !== line.productId) {
    return {
      ...nextLine,
      unitPrice: "",
      manualUnitPriceReason: "",
      preview: null,
      previewStale: patch.productId.length > 0,
    };
  }

  return nextLine;
};

export const isManualUnitPrice = (line: SaleLineDraft): boolean => {
  if (line.preview === null || line.unitPrice.trim().length === 0) {
    return false;
  }

  const unitPrice = Number(line.unitPrice);
  if (!Number.isFinite(unitPrice)) {
    return false;
  }

  return unitPrice !== line.preview.autoUnitPrice;
};

export const toCreateSaleLineRequest = (
  line: SaleLineDraft,
): CreateSaleLineRequest => {
  const manualReason = line.manualUnitPriceReason.trim();
  const isManual = isManualUnitPrice(line);

  return {
    productId: Number(line.productId),
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    manualUnitPriceReason:
      isManual && manualReason.length > 0 ? manualReason : null,
  };
};

export const toCreateSaleRequest = (
  values: SaleEntryFormValues,
): CreateSaleRequest => ({
  salesDate: values.salesDate,
  customerId: Number(values.customerId),
  lines: values.lines.map((line) =>
    toCreateSaleLineRequest({
      ...line,
      clientLineId: "",
      preview: null,
      previewStale: false,
    }),
  ),
});

export const toCreateSaleRequestFromDrafts = (
  header: Pick<SaleEntryFormValues, "salesDate" | "customerId">,
  lines: readonly SaleLineDraft[],
): CreateSaleRequest => ({
  salesDate: header.salesDate,
  customerId: Number(header.customerId),
  lines: lines.map((line) => toCreateSaleLineRequest(line)),
});

const formatUnitPriceInput = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);
