import type { DummyAuthMode } from "@/lib/api";
import type { SaleLineAmountInput } from "./_amounts";
import type { SaleEntryFormValues, SalesLinePreview } from "./_types";
import {
  applySalesLinePreview,
  createEmptySaleLineDraft,
  isManualUnitPrice,
  updateSaleLineDraft,
  type SaleLineDraft,
} from "./_line-state";
import { saleEntryFormSchema } from "./_schemas";
import type { ZodError } from "zod";

export type SaleLineEntryState = SaleLineDraft & {
  readonly previewError: string;
  readonly loadingPreview: boolean;
};

export type CustomerAsOfState = {
  readonly loading: boolean;
  readonly errorMessage: string;
  readonly item?: {
    readonly customerId: number;
    readonly salesDate: string;
  };
};

export type LinePreviewRequestContext = {
  readonly salesDate: string;
  readonly customerId: number;
  readonly productId: number;
  readonly requestId: number;
};

export type SaleSubmitDependencies = {
  readonly customerAsOf: CustomerAsOfState;
};

export const createEmptySaleLineEntry = (): SaleLineEntryState => ({
  ...createEmptySaleLineDraft(),
  previewError: "",
  loadingPreview: false,
});

export const markSaleLineEntriesStale = (
  lines: readonly SaleLineEntryState[],
): SaleLineEntryState[] =>
  lines.map((line) => {
    if (line.productId.length === 0 && line.preview === null) {
      return { ...line, loadingPreview: false };
    }

    return {
      ...line,
      previewStale: true,
      previewError: "",
      loadingPreview: false,
    };
  });

export const bumpLinePreviewRequestIds = (
  current: Readonly<Record<string, number>>,
  clientLineIds: readonly string[],
): Record<string, number> => {
  const next = { ...current };

  for (const clientLineId of clientLineIds) {
    next[clientLineId] = (next[clientLineId] ?? 0) + 1;
  }

  return next;
};

export const canApplyLinePreviewResponse = (
  request: LinePreviewRequestContext,
  activeRequestId: number | undefined,
  header: Pick<SaleEntryFormValues, "salesDate" | "customerId">,
  line: Pick<SaleLineEntryState, "productId">,
): boolean => {
  if (activeRequestId !== request.requestId) {
    return false;
  }

  const headerCustomerId = Number(header.customerId);
  if (
    !header.salesDate
    || !header.customerId
    || !Number.isInteger(headerCustomerId)
  ) {
    return false;
  }

  const lineProductId = Number(line.productId);
  if (line.productId.length === 0 || !Number.isInteger(lineProductId)) {
    return false;
  }

  return (
    request.salesDate === header.salesDate
    && request.customerId === headerCustomerId
    && request.productId === lineProductId
  );
};

export const isCustomerAsOfReady = (
  header: Pick<SaleEntryFormValues, "salesDate" | "customerId">,
  customerAsOf: CustomerAsOfState,
): boolean => {
  if (!header.salesDate || !header.customerId) {
    return false;
  }

  const customerId = Number(header.customerId);
  if (!Number.isInteger(customerId)) {
    return false;
  }

  return (
    !customerAsOf.loading
    && customerAsOf.errorMessage.length === 0
    && customerAsOf.item?.customerId === customerId
    && customerAsOf.item.salesDate === header.salesDate
  );
};

export const toSaleEntryFormValues = (
  header: Pick<SaleEntryFormValues, "salesDate" | "customerId">,
  lines: readonly SaleLineEntryState[],
): SaleEntryFormValues => ({
  salesDate: header.salesDate,
  customerId: header.customerId,
  lines: lines.map(
    ({ productId, quantity, unitPrice, manualUnitPriceReason }) => ({
      productId,
      quantity,
      unitPrice,
      manualUnitPriceReason,
    }),
  ),
});

export const getSaleFormValidationBlockReason = (
  header: Pick<SaleEntryFormValues, "salesDate" | "customerId">,
  lines: readonly SaleLineEntryState[],
): string | null => {
  const parsed = saleEntryFormSchema.safeParse(
    toSaleEntryFormValues(header, lines),
  );

  if (parsed.success) {
    return null;
  }

  return parsed.error.issues[0]?.message ?? "入力内容を確認してください。";
};

export const mapZodErrorsToFieldMap = (
  error: ZodError,
): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
};

export const getLineFieldError = (
  fieldErrors: Record<string, string>,
  lineIndex: number,
  fieldName: string,
): string | undefined => fieldErrors[`lines.${lineIndex}.${fieldName}`];

export const getSaleSubmitBlockReason = (
  authMode: DummyAuthMode,
  header: Pick<SaleEntryFormValues, "salesDate" | "customerId">,
  lines: readonly SaleLineEntryState[],
  dependencies: SaleSubmitDependencies,
): string | null => {
  if (authMode === "logout") {
    return "ログアウト状態では売上を登録できません。管理者としてログインしてください。";
  }

  if (authMode === "user") {
    return "売上登録は管理者のみ実行できます。ヘッダーで管理者に切り替えてください。";
  }

  if (!header.salesDate || !header.customerId) {
    return "売上日と得意先を指定してください。";
  }

  if (dependencies.customerAsOf.loading) {
    return "対象日時点の得意先を取得中です。完了するまで登録できません。";
  }

  if (!isCustomerAsOfReady(header, dependencies.customerAsOf)) {
    return "対象日時点の得意先を確認できていません。売上日と得意先を指定して再取得してください。";
  }

  const validationBlockReason = getSaleFormValidationBlockReason(header, lines);
  if (validationBlockReason) {
    return validationBlockReason;
  }

  if (lines.length === 0) {
    return "明細を1行以上追加してください。";
  }

  for (const line of lines) {
    if (line.loadingPreview) {
      return "明細プレビューを取得中です。完了するまで登録できません。";
    }

    if (line.previewError) {
      return "プレビューエラーのある明細があります。内容を確認してください。";
    }

    if (line.previewStale) {
      return "売上日・得意先・商品の変更に伴い、明細の再取得が必要です。";
    }

    if (line.preview?.isDiscontinued) {
      return "販売停止中の商品が含まれているため登録できません。";
    }

    if (line.productId && !line.preview) {
      return "プレビュー未取得の明細があります。再取得してください。";
    }
  }

  return null;
};

export const buildLineAmountInput = (
  line: SaleLineEntryState,
): SaleLineAmountInput | null => {
  if (!line.preview || line.quantity.trim().length === 0) {
    return null;
  }

  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);

  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
    return null;
  }

  return {
    quantity,
    unitPrice,
    taxRate: line.preview.taxRate,
  };
};

export const collectLineAmountInputs = (
  lines: readonly SaleLineEntryState[],
): SaleLineAmountInput[] =>
  lines.flatMap((line) => {
    const input = buildLineAmountInput(line);
    return input ? [input] : [];
  });

export const applySalesLineEntryPreview = (
  line: SaleLineEntryState,
  preview: SalesLinePreview,
): SaleLineEntryState => ({
  ...applySalesLinePreview(line, preview),
  previewError: "",
  loadingPreview: false,
});

export const updateSaleLineEntry = (
  line: SaleLineEntryState,
  patch: Partial<
    Pick<
      SaleLineEntryState,
      "productId" | "quantity" | "unitPrice" | "manualUnitPriceReason"
    >
  >,
): SaleLineEntryState => {
  const updated = updateSaleLineDraft(line, patch);
  const productChanged =
    patch.productId !== undefined && patch.productId !== line.productId;

  return {
    ...updated,
    previewError: productChanged ? "" : line.previewError,
    loadingPreview: productChanged ? false : line.loadingPreview,
  };
};

export const isLineManualUnitPrice = (line: SaleLineEntryState): boolean =>
  isManualUnitPrice(line);
