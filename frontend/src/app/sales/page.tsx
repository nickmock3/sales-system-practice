"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { fetchCustomerAsOf, fetchCustomers } from "@/app/customers/_api";
import type { CustomerSummary } from "@/app/customers/_types";
import { fetchProducts } from "@/app/products/_api";
import type { ProductSummary } from "@/app/products/_types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  formatApiError,
  getDummyAuthMode,
  isApiError,
  setDummyAuthMode,
  type DummyAuthMode,
} from "@/lib/api";
import { useListSelectionState } from "@/lib/hooks/use-list-selection-state";
import { getBusinessDate } from "@/lib/master-change-status";
import { createSale, fetchSale, fetchSales, fetchSalesLinePreview } from "./_api";
import {
  applySalesLineEntryPreview,
  bumpLinePreviewRequestIds,
  canApplyLinePreviewResponse,
  createEmptySaleLineEntry,
  getSaleSubmitBlockReason,
  mapZodErrorsToFieldMap,
  markSaleLineEntriesStale,
  toSaleEntryFormValues,
  updateSaleLineEntry,
  type CustomerAsOfState,
  type SaleLineEntryState,
} from "./_entry-state";
import { toSaleFormFieldName } from "./_field-errors";
import { toCreateSaleRequestFromDrafts } from "./_line-state";
import { buildSaleSearchParams } from "./_list-state";
import { saleEntryFormSchema } from "./_schemas";
import { SaleDetailPanel } from "./_components/sale-detail-panel";
import { SaleEntrySection } from "./_components/sale-entry-section";
import { SaleListPanel } from "./_components/sale-list-panel";
import type { SaleListItem, SaleResponse } from "./_types";

const authLabels: Record<DummyAuthMode, string> = {
  user: "一般ユーザー",
  admin: "管理者",
  logout: "ログアウト",
};

type SaleHeaderState = {
  readonly salesDate: string;
  readonly customerId: string;
};

type CustomerAsOfResult = {
  readonly customerId?: number;
  readonly salesDate?: string;
  readonly item?: CustomerSummary;
};

type CustomerAsOfError = {
  readonly customerId?: number;
  readonly salesDate?: string;
  readonly message: string;
};

type SaleLoadOptions = {
  readonly preserveSelectionOnError?: boolean;
  readonly preferredSelectedId?: number;
};

const defaultHeader = (): SaleHeaderState => ({
  salesDate: getBusinessDate(),
  customerId: "",
});

export default function SalesPage() {
  const [authMode, setAuthMode] = useState<DummyAuthMode>(() =>
    getDummyAuthMode(),
  );
  const [header, setHeader] = useState<SaleHeaderState>(defaultHeader);
  const [lines, setLines] = useState<SaleLineEntryState[]>([
    createEmptySaleLineEntry(),
  ]);
  const [customerOptions, setCustomerOptions] = useState<
    readonly CustomerSummary[]
  >([]);
  const [productOptions, setProductOptions] = useState<
    readonly ProductSummary[]
  >([]);
  const [loadingMasterOptions, setLoadingMasterOptions] = useState(false);
  const [loadingCustomerAsOf, setLoadingCustomerAsOf] = useState(false);
  const [customerAsOfResult, setCustomerAsOfResult] =
    useState<CustomerAsOfResult>({});
  const [customerAsOfError, setCustomerAsOfError] = useState<CustomerAsOfError>(
    { message: "" },
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [salesDateFrom, setSalesDateFrom] = useState("");
  const [salesDateTo, setSalesDateTo] = useState("");
  const [listCustomerId, setListCustomerId] = useState("");
  const [listCustomerCode, setListCustomerCode] = useState("");
  const [includeCanceled, setIncludeCanceled] = useState(false);
  const [includeCorrections, setIncludeCorrections] = useState(false);

  const [selectedSaleDetail, setSelectedSaleDetail] =
    useState<SaleResponse | null>(null);
  const [loadingSaleDetail, setLoadingSaleDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const customerAsOfRequestIdRef = useRef(0);
  const linePreviewRequestIdsRef = useRef<Record<string, number>>({});
  const saleDetailRequestIdRef = useRef(0);
  const headerRef = useRef(header);
  const linesRef = useRef(lines);

  useEffect(() => {
    headerRef.current = header;
  }, [header]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const {
    error: listError,
    isLoading: isLoadingSales,
    items: sales,
    loadItems: loadSaleItems,
    replaceItems: replaceSales,
    selectedId: selectedSaleId,
    selectedIdRef: selectedSaleIdRef,
    selectId: setSelectedSale,
  } = useListSelectionState<SaleListItem, number>({
    getId: (sale) => sale.saleId,
  });

  const customerAsOfItem =
    customerAsOfResult.customerId === Number(header.customerId)
    && customerAsOfResult.salesDate === header.salesDate
      ? customerAsOfResult.item
      : undefined;
  const customerAsOfMessage =
    customerAsOfError.customerId === Number(header.customerId)
    && customerAsOfError.salesDate === header.salesDate
      ? customerAsOfError.message
      : "";
  const customerAsOfState: CustomerAsOfState = {
    loading: loadingCustomerAsOf,
    errorMessage: customerAsOfMessage,
    item:
      customerAsOfResult.customerId !== undefined
      && customerAsOfResult.salesDate !== undefined
      && customerAsOfResult.item
        ? {
            customerId: customerAsOfResult.customerId,
            salesDate: customerAsOfResult.salesDate,
          }
        : undefined,
  };
  const submitBlockReason = getSaleSubmitBlockReason(authMode, header, lines, {
    customerAsOf: customerAsOfState,
  });

  const currentSearchParams = () =>
    buildSaleSearchParams(
      salesDateFrom,
      salesDateTo,
      listCustomerId,
      listCustomerCode,
      includeCanceled,
      includeCorrections,
    );

  const invalidateAllLinePreviewRequests = (clientLineIds: readonly string[]) => {
    linePreviewRequestIdsRef.current = bumpLinePreviewRequestIds(
      linePreviewRequestIdsRef.current,
      clientLineIds,
    );
  };

  const loadMasterOptions = async () => {
    setLoadingMasterOptions(true);

    try {
      const [customers, products] = await Promise.all([
        fetchCustomers({}),
        fetchProducts({}),
      ]);
      setCustomerOptions(customers);
      setProductOptions(products);
    } catch (error) {
      setFormError(formatApiError(error));
    } finally {
      setLoadingMasterOptions(false);
    }
  };

  const loadSales = async (
    params = currentSearchParams(),
    options: SaleLoadOptions = {},
  ) => {
    const result = await loadSaleItems(() => fetchSales(params), options);
    if (result.ok && options.preferredSelectedId !== undefined) {
      replaceSales(result.items, {
        preferredSelectedId: options.preferredSelectedId,
      });
    }
    return result;
  };

  const loadSaleDetail = async (saleId: number) => {
    const requestId = saleDetailRequestIdRef.current + 1;
    saleDetailRequestIdRef.current = requestId;
    setLoadingSaleDetail(true);
    setDetailError("");
    setSelectedSaleDetail((current) =>
      current?.saleId === saleId ? current : null,
    );

    try {
      const sale = await fetchSale(saleId);
      if (
        saleDetailRequestIdRef.current === requestId
        && selectedSaleIdRef.current === saleId
      ) {
        setSelectedSaleDetail(sale);
      }
    } catch (error) {
      if (
        saleDetailRequestIdRef.current === requestId
        && selectedSaleIdRef.current === saleId
      ) {
        setDetailError(formatApiError(error));
      }
    } finally {
      if (saleDetailRequestIdRef.current === requestId) {
        setLoadingSaleDetail(false);
      }
    }
  };

  const loadCustomerAsOf = async (customerId: string, salesDate: string) => {
    const parsedCustomerId = Number(customerId);
    if (!customerId || !salesDate || !Number.isInteger(parsedCustomerId)) {
      setCustomerAsOfResult({});
      setCustomerAsOfError({ message: "" });
      return;
    }

    const requestId = customerAsOfRequestIdRef.current + 1;
    customerAsOfRequestIdRef.current = requestId;
    setLoadingCustomerAsOf(true);
    setCustomerAsOfError({ message: "" });

    try {
      const item = await fetchCustomerAsOf(parsedCustomerId, salesDate);
      if (customerAsOfRequestIdRef.current === requestId) {
        setCustomerAsOfResult({
          customerId: parsedCustomerId,
          salesDate,
          item,
        });
      }
    } catch (error) {
      if (customerAsOfRequestIdRef.current === requestId) {
        setCustomerAsOfResult({ customerId: parsedCustomerId, salesDate });
        setCustomerAsOfError({
          customerId: parsedCustomerId,
          salesDate,
          message: formatApiError(error),
        });
      }
    } finally {
      if (customerAsOfRequestIdRef.current === requestId) {
        setLoadingCustomerAsOf(false);
      }
    }
  };

  const loadLinePreview = async (
    clientLineId: string,
    productId: number,
    context: SaleHeaderState = header,
  ) => {
    const parsedCustomerId = Number(context.customerId);
    if (
      !context.salesDate
      || !context.customerId
      || !Number.isInteger(parsedCustomerId)
      || !Number.isInteger(productId)
    ) {
      return;
    }

    const nextRequestId = (linePreviewRequestIdsRef.current[clientLineId] ?? 0) + 1;
    linePreviewRequestIdsRef.current[clientLineId] = nextRequestId;
    const requestContext = {
      salesDate: context.salesDate,
      customerId: parsedCustomerId,
      productId,
      requestId: nextRequestId,
    };

    setLines((currentLines) =>
      currentLines.map((line) =>
        line.clientLineId === clientLineId
          ? { ...line, loadingPreview: true, previewError: "" }
          : line,
      ),
    );

    try {
      const preview = await fetchSalesLinePreview(
        context.salesDate,
        parsedCustomerId,
        productId,
      );

      setLines((currentLines) => {
        const activeRequestId = linePreviewRequestIdsRef.current[clientLineId];
        const targetLine = currentLines.find(
          (line) => line.clientLineId === clientLineId,
        );

        if (
          !targetLine
          || !canApplyLinePreviewResponse(
            requestContext,
            activeRequestId,
            headerRef.current,
            targetLine,
          )
        ) {
          if (
            targetLine
            && activeRequestId === requestContext.requestId
            && targetLine.loadingPreview
          ) {
            return currentLines.map((line) =>
              line.clientLineId === clientLineId
                ? { ...line, loadingPreview: false }
                : line,
            );
          }

          return currentLines;
        }

        return currentLines.map((line) =>
          line.clientLineId === clientLineId
            ? applySalesLineEntryPreview(
                {
                  ...line,
                  loadingPreview: false,
                  previewError: "",
                },
                preview,
              )
            : line,
        );
      });
    } catch (error) {
      setLines((currentLines) => {
        const activeRequestId = linePreviewRequestIdsRef.current[clientLineId];
        const targetLine = currentLines.find(
          (line) => line.clientLineId === clientLineId,
        );

        if (
          !targetLine
          || !canApplyLinePreviewResponse(
            requestContext,
            activeRequestId,
            headerRef.current,
            targetLine,
          )
        ) {
          if (
            targetLine
            && activeRequestId === requestContext.requestId
            && targetLine.loadingPreview
          ) {
            return currentLines.map((line) =>
              line.clientLineId === clientLineId
                ? { ...line, loadingPreview: false }
                : line,
            );
          }

          return currentLines;
        }

        return currentLines.map((line) =>
          line.clientLineId === clientLineId
            ? {
                ...line,
                loadingPreview: false,
                preview: null,
                previewStale: true,
                previewError: formatApiError(error),
              }
            : line,
        );
      });
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMasterOptions();
      void loadSales({});
    }, 0);
    return () => window.clearTimeout(timer);
    // 初回表示だけでマスタと売上一覧を取得する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomerAsOf(header.customerId, header.salesDate);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [header.customerId, header.salesDate]);

  useEffect(() => {
    if (selectedSaleId === undefined) {
      setSelectedSaleDetail(null);
      setDetailError("");
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSaleDetail(selectedSaleId);
    }, 0);
    return () => window.clearTimeout(timer);
    // 一覧選択に合わせて売上詳細を取得する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSaleId]);

  const changeAuthMode = (mode: DummyAuthMode) => {
    setDummyAuthMode(mode);
    setAuthMode(mode);
    setSuccessMessage("");
    void loadSales();
  };

  const handleSalesDateChange = (salesDate: string) => {
    invalidateAllLinePreviewRequests(linesRef.current.map((line) => line.clientLineId));
    setHeader((current) => ({ ...current, salesDate }));
    setLines((current) => markSaleLineEntriesStale(current));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.salesDate;
      return next;
    });
    setFormError("");
    setSuccessMessage("");
  };

  const handleCustomerChange = (customerId: string) => {
    invalidateAllLinePreviewRequests(linesRef.current.map((line) => line.clientLineId));
    setHeader((current) => ({ ...current, customerId }));
    setLines((current) => markSaleLineEntriesStale(current));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.customerId;
      return next;
    });
    setFormError("");
    setSuccessMessage("");
  };

  const updateLine = (
    clientLineId: string,
    updater: (line: SaleLineEntryState) => SaleLineEntryState,
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.clientLineId === clientLineId ? updater(line) : line,
      ),
    );
  };

  const handleProductChange = (clientLineId: string, productId: string) => {
    updateLine(clientLineId, (line) =>
      updateSaleLineEntry(line, { productId }),
    );
    setFieldErrors((current) => {
      const lineIndex = lines.findIndex(
        (line) => line.clientLineId === clientLineId,
      );
      if (lineIndex < 0) {
        return current;
      }
      const next = { ...current };
      delete next[`lines.${lineIndex}.productId`];
      return next;
    });

    if (productId) {
      void loadLinePreview(clientLineId, Number(productId));
    }
  };

  const handleLineFieldChange = (
    clientLineId: string,
    field: "quantity" | "unitPrice" | "manualUnitPriceReason",
    value: string,
  ) => {
    updateLine(clientLineId, (line) => ({ ...line, [field]: value }));
    const lineIndex = lines.findIndex(
      (line) => line.clientLineId === clientLineId,
    );
    if (lineIndex >= 0) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[`lines.${lineIndex}.${field}`];
        return next;
      });
    }
  };

  const addLine = () => {
    setLines((current) => [...current, createEmptySaleLineEntry()]);
  };

  const removeLine = (clientLineId: string) => {
    setLines((current) => {
      if (current.length <= 1) {
        return current;
      }
      delete linePreviewRequestIdsRef.current[clientLineId];
      return current.filter((line) => line.clientLineId !== clientLineId);
    });
  };

  const refreshLinePreview = (clientLineId: string) => {
    const line = lines.find((item) => item.clientLineId === clientLineId);
    if (!line?.productId) {
      return;
    }

    void loadLinePreview(clientLineId, Number(line.productId));
  };

  const applyApiFieldErrors = (error: unknown) => {
    if (!isApiError(error)) {
      return;
    }

    const nextErrors: Record<string, string> = {};
    Object.entries(error.fieldErrors).forEach(([field, messages]) => {
      const formField = toSaleFormFieldName(field);
      if (messages[0]) {
        nextErrors[formField] = messages[0];
      }
    });
    setFieldErrors(nextErrors);
  };

  const submitSale = async () => {
    setFormError("");
    setSuccessMessage("");
    setFieldErrors({});

    const blockReason = getSaleSubmitBlockReason(authMode, header, lines, {
      customerAsOf: customerAsOfState,
    });
    if (blockReason) {
      setFormError(blockReason);
      return;
    }

    const formValues = toSaleEntryFormValues(header, lines);
    const parsed = saleEntryFormSchema.safeParse(formValues);
    if (!parsed.success) {
      setFieldErrors(mapZodErrorsToFieldMap(parsed.error));
      setFormError("入力内容を確認してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const request = toCreateSaleRequestFromDrafts(header, lines);
      const created = await createSale(request);

      let displaySale = created;
      try {
        displaySale = await fetchSale(created.saleId);
      } catch {
        displaySale = created;
      }

      setSalesDateFrom("");
      setSalesDateTo("");
      setListCustomerId("");
      setListCustomerCode("");
      setIncludeCanceled(false);
      setIncludeCorrections(false);

      const loadResult = await loadSales({}, {
        preferredSelectedId: created.saleId,
      });
      if (loadResult.ok) {
        setSelectedSaleDetail(displaySale);
      }

      setSuccessMessage(`売上 ${displaySale.saleId} を登録しました。`);
    } catch (error) {
      setFormError(formatApiError(error));
      applyApiFieldErrors(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const searchSales = () => {
    setSuccessMessage("");
    void loadSales(currentSearchParams());
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <p className="app-brand-kicker">Sales System Practice</p>
            <p className="app-brand-title">販売管理システム</p>
          </div>
          <div className="app-header-actions" aria-label="ダミー認証状態">
            {(["user", "admin", "logout"] as const).map((mode) => (
              <Button
                key={mode}
                onClick={() => changeAuthMode(mode)}
                variant={authMode === mode ? "primary" : "secondary"}
              >
                {authLabels[mode]}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <div className="app-shell app-shell-dense flex flex-col gap-4">
        <div className="page-intro page-intro-compact">
          <nav
            aria-label="breadcrumb"
            className="flex items-center gap-1 text-xs font-semibold text-slate-500"
          >
            <Link className="hover:text-teal-700" href="/">
              販売管理システム
            </Link>
            <ChevronRight aria-hidden="true" className="size-4" />
            <span className="text-slate-700">売上</span>
          </nav>
          <h1 className="mt-1.5">売上</h1>
          <p>
            売上の入力・登録、一覧検索、詳細確認を同じ画面で行います。
          </p>
        </div>

        {successMessage ? (
          <Alert className="py-2" title="完了しました" tone="success">
            {successMessage}
          </Alert>
        ) : null}
        {listError || formError || customerAsOfMessage ? (
          <Alert className="py-2" title="エラーを確認してください" tone="danger">
            {[listError, formError, customerAsOfMessage].filter(Boolean).join(" ")}
          </Alert>
        ) : null}
        {submitBlockReason && authMode !== "admin" ? (
          <Alert className="py-2" title="登録できません" tone="info">
            {submitBlockReason}
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <SaleEntrySection
            customerAsOfItem={customerAsOfItem}
            customerOptions={customerOptions}
            fieldErrors={fieldErrors}
            header={header}
            isSubmitting={isSubmitting}
            lines={lines}
            loadingCustomerAsOf={loadingCustomerAsOf}
            loadingMasterOptions={loadingMasterOptions}
            onAddLine={addLine}
            onCustomerChange={handleCustomerChange}
            onManualReasonChange={(clientLineId, value) =>
              handleLineFieldChange(clientLineId, "manualUnitPriceReason", value)
            }
            onProductChange={handleProductChange}
            onQuantityChange={(clientLineId, value) =>
              handleLineFieldChange(clientLineId, "quantity", value)
            }
            onRefreshPreview={refreshLinePreview}
            onReloadCustomerAsOf={() =>
              void loadCustomerAsOf(header.customerId, header.salesDate)
            }
            onRemoveLine={removeLine}
            onSalesDateChange={handleSalesDateChange}
            onSubmit={() => {
              void submitSale();
            }}
            onUnitPriceChange={(clientLineId, value) =>
              handleLineFieldChange(clientLineId, "unitPrice", value)
            }
            productOptions={productOptions}
            submitBlockReason={submitBlockReason}
          />

          <SaleDetailPanel
            errorMessage={detailError}
            isLoading={loadingSaleDetail}
            sale={selectedSaleDetail}
          />
        </div>

        <SaleListPanel
          customerOptions={customerOptions}
          customerCode={listCustomerCode}
          customerId={listCustomerId}
          includeCanceled={includeCanceled}
          includeCorrections={includeCorrections}
          isLoading={isLoadingSales}
          loadingCustomerOptions={loadingMasterOptions}
          onCustomerCodeChange={setListCustomerCode}
          onCustomerIdChange={setListCustomerId}
          onIncludeCanceledChange={setIncludeCanceled}
          onIncludeCorrectionsChange={setIncludeCorrections}
          onReload={() => {
            void loadSales();
          }}
          onSalesDateFromChange={setSalesDateFrom}
          onSalesDateToChange={setSalesDateTo}
          onSearch={searchSales}
          onSelectSale={setSelectedSale}
          sales={sales}
          salesDateFrom={salesDateFrom}
          salesDateTo={salesDateTo}
          selectedSaleId={selectedSaleId}
        />
      </div>
    </main>
  );
}
