"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronRight,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { useForm, type Path, type UseFormReturn } from "react-hook-form";
import { fetchCustomers } from "@/app/customers/_api";
import type { CustomerSummary } from "@/app/customers/_types";
import { fetchProducts } from "@/app/products/_api";
import type { ProductSummary } from "@/app/products/_types";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatApiError,
  getDummyAuthMode,
  isApiError,
  setDummyAuthMode,
  type DummyAuthMode,
} from "@/lib/api";
import { useListSelectionState } from "@/lib/hooks/use-list-selection-state";
import { cn } from "@/lib/utils/cn";
import {
  changeCustomerProductPrice,
  createCustomerProductPrice,
  fetchCustomerProductPriceChanges,
  fetchCustomerProductPricePreviewComposed,
  fetchCustomerProductPrices,
} from "./_api";
import {
  buildCustomerProductPriceChangeKey,
  classifyCustomerProductPriceChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  type ChangeTiming,
} from "./_change-status";
import { toCustomerProductPriceFormFieldName } from "./_field-errors";
import {
  parsePositiveIntParam,
  toCombinationKey,
  type CombinationKey,
} from "./_selection";
import {
  customerProductPriceChangeFormSchema,
  customerProductPriceFormSchema,
  previewFormSchema,
} from "./_schemas";
import {
  formatDateTime,
  formatMoney,
  unitPriceSourceLabels,
  type CustomerProductPriceChange,
  type CustomerProductPriceChangeFormValues,
  type CustomerProductPriceFormValues,
  type CustomerProductPricePreviewComposed,
  type CustomerProductPriceSearchParams,
  type CustomerProductPriceSummary,
  type PreviewFormValues,
} from "./_types";

type CustomerProductPriceChangesResult = {
  readonly combinationKey?: CombinationKey;
  readonly summary?: CustomerProductPriceSummary;
  readonly items: CustomerProductPriceChange[];
};

type PreviewResult = {
  readonly customerId?: number;
  readonly productId?: number;
  readonly asOf?: string;
  readonly item?: CustomerProductPricePreviewComposed;
};

type PreviewError = {
  readonly customerId?: number;
  readonly productId?: number;
  readonly asOf?: string;
  readonly message: string;
};

type ListLoadOptions = {
  readonly preserveSelectionOnError?: boolean;
  readonly adjustDeepLinkSelection?: boolean;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const buildSearchParams = (
  customerIdFilter: string,
  productIdFilter: string,
  customerCode: string,
  productCode: string,
): CustomerProductPriceSearchParams => {
  const parsedCustomerId = parsePositiveIntParam(customerIdFilter);
  const parsedProductId = parsePositiveIntParam(productIdFilter);

  return {
    customerId: parsedCustomerId,
    productId: parsedProductId,
    customerCode: customerCode.trim() || undefined,
    productCode: productCode.trim() || undefined,
  };
};

const defaultCreateValues = (): CustomerProductPriceFormValues => ({
  customerId: "",
  productId: "",
  unitPrice: "",
  effectiveFrom: getBusinessDate(),
});

const defaultChangeValues = (
  price?: CustomerProductPriceSummary,
): CustomerProductPriceChangeFormValues => ({
  unitPrice: price ? String(price.unitPrice) : "",
  effectiveFrom: getBusinessDate(),
});

const defaultPreviewValues = (
  price?: CustomerProductPriceSummary,
): PreviewFormValues => ({
  customerId: price ? String(price.customerId) : "",
  productId: price ? String(price.productId) : "",
  asOf: getBusinessDate(),
});

const authLabels: Record<DummyAuthMode, string> = {
  user: "一般ユーザー",
  admin: "管理者",
  logout: "ログアウト",
};

const changeTimingLabels: Record<ChangeTiming, string> = {
  current: "現在適用中",
  future: "将来適用予定",
  past: "過去の変更",
};

const changeTimingTones: Record<
  ChangeTiming,
  "success" | "warning" | "neutral"
> = {
  current: "success",
  future: "warning",
  past: "neutral",
};

function ChangeTimingBadge({ timing }: { readonly timing: ChangeTiming }) {
  return (
    <Badge tone={changeTimingTones[timing]}>{changeTimingLabels[timing]}</Badge>
  );
}

function FieldError({ message }: { readonly message?: string }) {
  return message ? (
    <span className="text-sm font-medium text-red-700">{message}</span>
  ) : null;
}

const errorMessage = (message: unknown) =>
  typeof message === "string" ? message : undefined;

const applyFieldErrors = <T extends Record<string, unknown>>(
  error: unknown,
  form: UseFormReturn<T>,
) => {
  if (!isApiError(error)) {
    return;
  }

  Object.entries(error.fieldErrors).forEach(([field, messages]) => {
    form.setError(toCustomerProductPriceFormFieldName(field) as Path<T>, {
      message: messages[0],
    });
  });
};

function CustomerProductPricesContent() {
  const searchParams = useSearchParams();
  const initialCustomerId = parsePositiveIntParam(
    searchParams.get("customerId"),
  );
  const initialProductId = parsePositiveIntParam(searchParams.get("productId"));
  const hasDeepLinkFilter =
    initialCustomerId !== undefined || initialProductId !== undefined;

  const [authMode, setAuthMode] = useState<DummyAuthMode>(() =>
    getDummyAuthMode(),
  );
  const [customerIdFilter, setCustomerIdFilter] = useState(
    initialCustomerId !== undefined ? String(initialCustomerId) : "",
  );
  const [productIdFilter, setProductIdFilter] = useState(
    initialProductId !== undefined ? String(initialProductId) : "",
  );
  const [customerCode, setCustomerCode] = useState("");
  const [productCode, setProductCode] = useState("");
  const [customerOptions, setCustomerOptions] = useState<
    readonly CustomerSummary[]
  >([]);
  const [productOptions, setProductOptions] = useState<
    readonly ProductSummary[]
  >([]);
  const [loadingMasterOptions, setLoadingMasterOptions] = useState(false);

  const changesRequestIdRef = useRef(0);
  const [changesResult, setChangesResult] =
    useState<CustomerProductPriceChangesResult>({ items: [] });

  const previewRequestIdRef = useRef(0);
  const [previewResult, setPreviewResult] = useState<PreviewResult>({});
  const [previewErrorState, setPreviewErrorState] = useState<PreviewError>({
    message: "",
  });
  const [loadingPreviewKey, setLoadingPreviewKey] = useState<{
    readonly customerId: number;
    readonly productId: number;
    readonly asOf: string;
  }>();

  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingChangesKey, setLoadingChangesKey] = useState<CombinationKey>();

  const createForm = useForm<CustomerProductPriceFormValues>({
    resolver: zodResolver(customerProductPriceFormSchema),
    defaultValues: defaultCreateValues(),
  });

  const changeForm = useForm<CustomerProductPriceChangeFormValues>({
    resolver: zodResolver(customerProductPriceChangeFormSchema),
    defaultValues: defaultChangeValues(),
  });

  const previewForm = useForm<PreviewFormValues>({
    resolver: zodResolver(previewFormSchema),
    defaultValues: defaultPreviewValues(),
  });

  const clearSelectedPriceState = () => {
    setChangesResult({ items: [] });
    setPreviewResult({});
    setPreviewErrorState({ message: "" });
  };

  const {
    error: listError,
    isLoading: isLoadingPrices,
    items: prices,
    loadItems: loadPriceItems,
    replaceItems: replacePrices,
    selectedId: selectedCombinationKey,
    selectedIdRef: selectedCombinationKeyRef,
    selectedItem: selectedPrice,
    selectId: setSelectedCombinationKey,
    setError: setListError,
  } = useListSelectionState<CustomerProductPriceSummary, CombinationKey>({
    getId: (price) => toCombinationKey(price.customerId, price.productId),
    onSelectionChange: clearSelectedPriceState,
  });

  const changes =
    selectedPrice
    && changesResult.combinationKey === selectedCombinationKey
      ? changesResult.items
      : [];
  const changesSummary =
    selectedPrice
    && changesResult.combinationKey === selectedCombinationKey
      ? changesResult.summary
      : undefined;
  const previewItem =
    selectedPrice
    && previewResult.customerId === selectedPrice.customerId
    && previewResult.productId === selectedPrice.productId
    && previewResult.asOf === previewForm.getValues("asOf")
      ? previewResult.item
      : undefined;
  const previewError =
    selectedPrice
    && previewErrorState.customerId === selectedPrice.customerId
    && previewErrorState.productId === selectedPrice.productId
    && previewErrorState.asOf === previewForm.getValues("asOf")
      ? previewErrorState.message
      : selectedPrice === undefined
        ? previewErrorState.message
        : "";
  const isLoadingChanges =
    selectedCombinationKey !== undefined
    && loadingChangesKey === selectedCombinationKey;
  const isLoadingPreview =
    selectedPrice !== undefined
    && loadingPreviewKey?.customerId === selectedPrice.customerId
    && loadingPreviewKey?.productId === selectedPrice.productId;

  const businessDate = getBusinessDate();
  const currentEffectiveFrom = findCurrentEffectiveFrom(changes, businessDate);

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
      setListError(formatApiError(error));
    } finally {
      setLoadingMasterOptions(false);
    }
  };

  const loadPriceList = async (
    params = buildSearchParams(
      customerIdFilter,
      productIdFilter,
      customerCode,
      productCode,
    ),
    options: ListLoadOptions = {},
  ) => {
    const result = await loadPriceItems(
      () => fetchCustomerProductPrices(params),
      options,
    );

    if (options.adjustDeepLinkSelection && result.ok) {
      if (result.items.length === 1) {
        const only = result.items[0];
        setSelectedCombinationKey(
          toCombinationKey(only.customerId, only.productId),
        );
      } else if (hasDeepLinkFilter) {
        setSelectedCombinationKey(undefined);
      }
    }

    return result;
  };

  const loadChanges = async (price: CustomerProductPriceSummary) => {
    const combinationKey = toCombinationKey(price.customerId, price.productId);
    const requestId = changesRequestIdRef.current + 1;
    changesRequestIdRef.current = requestId;
    setLoadingChangesKey(combinationKey);

    try {
      const nextChanges = await fetchCustomerProductPriceChanges(
        price.customerId,
        price.productId,
      );
      if (
        changesRequestIdRef.current === requestId
        && selectedCombinationKeyRef.current === combinationKey
      ) {
        setChangesResult({
          combinationKey,
          summary: price,
          items: nextChanges,
        });
      }
    } catch (error) {
      if (
        changesRequestIdRef.current === requestId
        && selectedCombinationKeyRef.current === combinationKey
      ) {
        setListError(formatApiError(error));
        setChangesResult({ combinationKey, summary: price, items: [] });
      }
    } finally {
      if (changesRequestIdRef.current === requestId) {
        setLoadingChangesKey(undefined);
      }
    }
  };

  const loadPreview = async (
    customerId: number,
    productId: number,
    asOf: string,
  ) => {
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setLoadingPreviewKey({ customerId, productId, asOf });
    setPreviewErrorState({ message: "" });

    try {
      const nextPreview = await fetchCustomerProductPricePreviewComposed(
        customerId,
        productId,
        asOf,
      );
      if (
        previewRequestIdRef.current === requestId
        && selectedPrice?.customerId === customerId
        && selectedPrice?.productId === productId
        && previewForm.getValues("asOf") === asOf
      ) {
        setPreviewResult({ customerId, productId, asOf, item: nextPreview });
      }
    } catch (error) {
      if (
        previewRequestIdRef.current === requestId
        && selectedPrice?.customerId === customerId
        && selectedPrice?.productId === productId
        && previewForm.getValues("asOf") === asOf
      ) {
        setPreviewResult({ customerId, productId, asOf });
        setPreviewErrorState({
          customerId,
          productId,
          asOf,
          message: formatApiError(error),
        });
      }
    } finally {
      if (previewRequestIdRef.current === requestId) {
        setLoadingPreviewKey(undefined);
      }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMasterOptions();
      void loadPriceList(
        buildSearchParams(
          initialCustomerId !== undefined ? String(initialCustomerId) : "",
          initialProductId !== undefined ? String(initialProductId) : "",
          "",
          "",
        ),
        { adjustDeepLinkSelection: true },
      );
    }, 0);
    return () => window.clearTimeout(timer);
    // 初回表示だけで一覧とマスタ選択肢を取得する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPrice) {
      changeForm.reset(defaultChangeValues());
      previewForm.reset(defaultPreviewValues());
      return;
    }

    changeForm.reset(defaultChangeValues(selectedPrice));
    previewForm.reset(defaultPreviewValues(selectedPrice));
    const timer = window.setTimeout(() => {
      void loadChanges(selectedPrice);
    }, 0);
    return () => window.clearTimeout(timer);
    // 選択組み合わせの変更に合わせて変更フォームと履歴を更新する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCombinationKey]);

  const changeAuthMode = (mode: DummyAuthMode) => {
    setDummyAuthMode(mode);
    setAuthMode(mode);
    setSuccessMessage("");
    void loadPriceList();
  };

  const searchPrices = () => {
    setSuccessMessage("");
    void loadPriceList();
  };

  const submitCreate = async (values: CustomerProductPriceFormValues) => {
    setFormError("");
    setSuccessMessage("");

    try {
      const created = await createCustomerProductPrice(values);
      createForm.reset(defaultCreateValues());
      setSuccessMessage("得意先別商品単価を登録し、一覧を更新しました。");
      const loadResult = await loadPriceList({}, { preserveSelectionOnError: true });
      if (!loadResult.ok) {
        setSuccessMessage(
          "得意先別商品単価を登録しました。一覧の再読込に失敗しました。",
        );
        return;
      }

      const nextPrices = loadResult.items;
      if (
        isEffectiveOnOrBeforeToday(created.effectiveFrom)
        && !nextPrices.some(
          (price) =>
            price.customerId === created.customerId
            && price.productId === created.productId,
        )
      ) {
        replacePrices([created, ...nextPrices], {
          preferredSelectedId: toCombinationKey(
            created.customerId,
            created.productId,
          ),
        });
      } else if (
        nextPrices.some(
          (price) =>
            price.customerId === created.customerId
            && price.productId === created.productId,
        )
      ) {
        setSelectedCombinationKey(
          toCombinationKey(created.customerId, created.productId),
        );
      }
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, createForm);
    }
  };

  const submitChange = async (values: CustomerProductPriceChangeFormValues) => {
    if (!selectedPrice) {
      setFormError("単価を変更する組み合わせを一覧から選択してください。");
      return;
    }

    setFormError("");
    setSuccessMessage("");

    try {
      await changeCustomerProductPrice(
        selectedPrice.customerId,
        selectedPrice.productId,
        values,
      );
      const loadResult = await loadPriceList(undefined, {
        preserveSelectionOnError: true,
      });
      setSuccessMessage(
        loadResult.ok
          ? "得意先別商品単価を変更し、一覧と変更履歴を更新しました。"
          : "得意先別商品単価を変更しました。一覧の再読込に失敗しました。",
      );
      await loadChanges(selectedPrice);
      const previewValues = previewForm.getValues();
      if (
        previewValues.customerId === String(selectedPrice.customerId)
        && previewValues.productId === String(selectedPrice.productId)
        && previewValues.asOf
      ) {
        await loadPreview(
          selectedPrice.customerId,
          selectedPrice.productId,
          previewValues.asOf,
        );
      }
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, changeForm);
    }
  };

  const submitPreview = async (values: PreviewFormValues) => {
    const customerId = Number(values.customerId);
    const productId = Number(values.productId);

    if (!selectedPrice) {
      setPreviewErrorState({
        asOf: values.asOf,
        message: "参照する組み合わせを一覧から選択してください。",
      });
      return;
    }

    if (
      customerId !== selectedPrice.customerId
      || productId !== selectedPrice.productId
    ) {
      setPreviewErrorState({
        customerId,
        productId,
        asOf: values.asOf,
        message: "プレビューは選択中の得意先・商品の組み合わせで確認してください。",
      });
      return;
    }

    await loadPreview(customerId, productId, values.asOf);
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
            <span className="text-slate-700">得意先別商品単価</span>
          </nav>
          <h1 className="mt-1.5">得意先別商品単価</h1>
          <p>
            得意先と商品の組み合わせごとの例外単価を確認・登録し、指定日から単価を変更します。
          </p>
        </div>

        {successMessage ? (
          <Alert className="py-2" title="完了しました" tone="success">
            {successMessage}
          </Alert>
        ) : null}
        {listError || formError || previewError ? (
          <Alert className="py-2" title="エラーを確認してください" tone="danger">
            {[listError, formError, previewError].filter(Boolean).join(" ")}
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
          <section className="surface result-surface" aria-labelledby="list-heading">
            <div
              className="search-bar search-bar-embedded"
              aria-labelledby="search-heading"
            >
              <div className="search-bar-heading">
                <h2 id="search-heading">検索条件</h2>
              </div>
              <div className="search-bar-fields">
                <label className="search-field">
                  <span>得意先 ID</span>
                  <Input
                    className="h-8 text-xs"
                    inputMode="numeric"
                    value={customerIdFilter}
                    onChange={(event) => setCustomerIdFilter(event.target.value)}
                  />
                </label>
                <label className="search-field">
                  <span>商品 ID</span>
                  <Input
                    className="h-8 text-xs"
                    inputMode="numeric"
                    value={productIdFilter}
                    onChange={(event) => setProductIdFilter(event.target.value)}
                  />
                </label>
                <label className="search-field">
                  <span>得意先コード</span>
                  <Input
                    className="h-8 text-xs"
                    value={customerCode}
                    onChange={(event) => setCustomerCode(event.target.value)}
                  />
                </label>
                <label className="search-field">
                  <span>商品コード</span>
                  <Input
                    className="h-8 text-xs"
                    value={productCode}
                    onChange={(event) => setProductCode(event.target.value)}
                  />
                </label>
                <div className="search-actions">
                  <Button className="h-8 px-2 text-xs" onClick={searchPrices}>
                    <Search aria-hidden="true" className="size-4" />
                    検索
                  </Button>
                  <Button
                    className="h-8 px-2 text-xs"
                    onClick={() => void loadPriceList()}
                    variant="secondary"
                  >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    再読込
                  </Button>
                </div>
              </div>
            </div>
            <div className="result-heading">
              <div>
                <h2 id="list-heading">得意先別商品単価一覧</h2>
                <p>一覧は本日時点で適用される単価を表示します。</p>
              </div>
              <Badge tone="neutral">{prices.length} 件</Badge>
            </div>
            {prices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table text-left">
                  <thead>
                    <tr>
                      <th>得意先コード</th>
                      <th>得意先名</th>
                      <th>商品コード</th>
                      <th>商品名</th>
                      <th className="text-right">単価</th>
                      <th>適用開始日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((price) => {
                      const combinationKey = toCombinationKey(
                        price.customerId,
                        price.productId,
                      );
                      return (
                        <tr
                          className={cn(
                            "cursor-pointer hover:bg-slate-50",
                            selectedCombinationKey === combinationKey
                              && "data-table-row-selected",
                          )}
                          key={combinationKey}
                          onClick={() => setSelectedCombinationKey(combinationKey)}
                        >
                          <td className="font-mono text-slate-700">
                            {price.customerCode}
                          </td>
                          <td className="font-semibold">{price.customerName}</td>
                          <td className="font-mono text-slate-700">
                            {price.productCode}
                          </td>
                          <td className="font-semibold">{price.productName}</td>
                          <td className="text-right font-mono">
                            {formatMoney(price.unitPrice)}
                          </td>
                          <td>{formatDate(price.effectiveFrom)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {isLoadingPrices ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                読み込み中
              </p>
            ) : null}
            {!isLoadingPrices && prices.length === 0 ? (
              <div className="result-empty-state">
                <p>該当データなし</p>
                <span>検索条件を変更するか、新しい組み合わせを登録してください。</span>
              </div>
            ) : null}
          </section>

          <section className="surface selected-summary" aria-labelledby="detail-heading">
            <div className="selected-summary-heading">
              <h2 id="detail-heading">選択中の組み合わせ</h2>
            </div>
            {selectedPrice ? (
              <dl className="selected-summary-list">
                <dt>得意先コード</dt>
                <dd className="font-mono">{selectedPrice.customerCode}</dd>
                <dt>得意先名</dt>
                <dd>{selectedPrice.customerName}</dd>
                <dt>商品コード</dt>
                <dd className="font-mono">{selectedPrice.productCode}</dd>
                <dt>商品名</dt>
                <dd>{selectedPrice.productName}</dd>
                <dt>単価</dt>
                <dd>{formatMoney(selectedPrice.unitPrice)}</dd>
                <dt>適用開始日</dt>
                <dd>{formatDate(selectedPrice.effectiveFrom)}</dd>
              </dl>
            ) : (
              <div className="selected-empty">
                <p>未選択</p>
                <span>一覧から行を選択すると現在の単価情報を表示します。</span>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="surface section-pad" aria-labelledby="create-heading">
            <div className="section-heading">
              <h2 id="create-heading">初回登録</h2>
              <p>新しい得意先・商品の組み合わせに初回単価を登録します。</p>
            </div>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                void createForm.handleSubmit(submitCreate)(event);
              }}
            >
              <CreateFields
                customerOptions={customerOptions}
                form={createForm}
                loadingMasterOptions={loadingMasterOptions}
                productOptions={productOptions}
              />
              <Button disabled={createForm.formState.isSubmitting} type="submit">
                {createForm.formState.isSubmitting ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Save aria-hidden="true" className="size-4" />
                )}
                登録
              </Button>
            </form>
          </section>

          <section className="surface section-pad" aria-labelledby="change-heading">
            <div className="section-heading">
              <h2 id="change-heading">単価変更</h2>
              <p>
                {selectedPrice
                  ? `${selectedPrice.customerName} × ${selectedPrice.productName} の単価を指定日から変更します。`
                  : "一覧から組み合わせを選択すると単価を変更できます。"}
              </p>
            </div>
            {selectedPrice ? (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  void changeForm.handleSubmit(submitChange)(event);
                }}
              >
                <fieldset
                  className="grid gap-4"
                  disabled={!selectedPrice || changeForm.formState.isSubmitting}
                >
                  <ChangeFields form={changeForm} />
                </fieldset>
                <Button
                  disabled={!selectedPrice || changeForm.formState.isSubmitting}
                  type="submit"
                >
                  {changeForm.formState.isSubmitting ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Plus aria-hidden="true" className="size-4" />
                  )}
                  変更を登録
                </Button>
              </form>
            ) : (
              <div className="form-empty-state">
                <p>組み合わせ未選択</p>
                <span>一覧で対象組み合わせを選択してから単価を変更します。</span>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section
            className="surface section-pad"
            aria-labelledby="preview-heading"
          >
            <div className="section-heading">
              <h2 id="preview-heading">指定日時点の自動取得単価</h2>
              <p>売上入力時に採用される単価と根拠を確認します。</p>
            </div>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                void previewForm.handleSubmit(submitPreview)(event);
              }}
            >
              <PreviewFields form={previewForm} selectedPrice={selectedPrice} />
              <Button
                disabled={!selectedPrice || isLoadingPreview}
                type="submit"
                variant="secondary"
              >
                {isLoadingPreview ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Search aria-hidden="true" className="size-4" />
                )}
                参照
              </Button>
              {previewItem ? (
                <dl className="selected-summary-list">
                  <dt>対象日</dt>
                  <dd>{formatDate(previewItem.asOf)}</dd>
                  <dt>得意先コード</dt>
                  <dd className="font-mono">{previewItem.customerCode}</dd>
                  <dt>得意先名</dt>
                  <dd>{previewItem.customerName}</dd>
                  <dt>商品コード</dt>
                  <dd className="font-mono">{previewItem.productCode}</dd>
                  <dt>商品名</dt>
                  <dd>{previewItem.productName}</dd>
                  <dt>単位</dt>
                  <dd>{previewItem.unit}</dd>
                  <dt>自動取得単価</dt>
                  <dd>{formatMoney(previewItem.autoUnitPrice)}</dd>
                  <dt>単価根拠</dt>
                  <dd>{unitPriceSourceLabels[previewItem.unitPriceSource]}</dd>
                  <dt>得意先別商品単価の適用開始日</dt>
                  <dd>
                    {previewItem.customerProductPriceEffectiveFrom
                      ? formatDate(previewItem.customerProductPriceEffectiveFrom)
                      : "—"}
                  </dd>
                  <dt>商品標準単価</dt>
                  <dd>{formatMoney(previewItem.standardUnitPrice)}</dd>
                  <dt>商品情報の適用開始日</dt>
                  <dd>{formatDate(previewItem.productEffectiveFrom)}</dd>
                </dl>
              ) : (
                <div className="selected-empty">
                  <p>参照結果なし</p>
                  <span>組み合わせと参照日を指定して確認します。</span>
                </div>
              )}
            </form>
          </section>

          <section className="surface section-pad" aria-labelledby="history-heading">
            <div className="section-heading">
              <h2 id="history-heading">変更履歴</h2>
              <p>
                同じ得意先・商品の変更を適用開始日の新しい順で表示します。将来適用予定も含みます。
              </p>
            </div>
            {isLoadingChanges ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                変更履歴を読み込み中
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="data-table text-left">
                <thead>
                  <tr>
                    <th>状態</th>
                    <th>得意先コード</th>
                    <th>得意先名</th>
                    <th>商品コード</th>
                    <th>商品名</th>
                    <th className="text-right">単価</th>
                    <th>適用開始日</th>
                    <th>登録日時</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={buildCustomerProductPriceChangeKey(change)}>
                      <td>
                        <ChangeTimingBadge
                          timing={classifyCustomerProductPriceChange(
                            change,
                            businessDate,
                            currentEffectiveFrom,
                          )}
                        />
                      </td>
                      <td className="font-mono text-slate-700">
                        {changesSummary?.customerCode ?? selectedPrice?.customerCode}
                      </td>
                      <td className="font-semibold">
                        {changesSummary?.customerName ?? selectedPrice?.customerName}
                      </td>
                      <td className="font-mono text-slate-700">
                        {changesSummary?.productCode ?? selectedPrice?.productCode}
                      </td>
                      <td className="font-semibold">
                        {changesSummary?.productName ?? selectedPrice?.productName}
                      </td>
                      <td className="text-right font-mono">
                        {formatMoney(change.unitPrice)}
                      </td>
                      <td>{formatDate(change.effectiveFrom)}</td>
                      <td>{formatDateTime(change.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLoadingChanges && changes.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-slate-500">
                変更履歴なし
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function CustomerProductPricesPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 text-slate-950">
          <div className="app-shell py-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              得意先別商品単価画面を読み込み中
            </p>
          </div>
        </main>
      }
    >
      <CustomerProductPricesContent />
    </Suspense>
  );
}

function CreateFields({
  customerOptions,
  form,
  loadingMasterOptions,
  productOptions,
}: {
  readonly customerOptions: readonly CustomerSummary[];
  readonly form: UseFormReturn<CustomerProductPriceFormValues>;
  readonly loadingMasterOptions: boolean;
  readonly productOptions: readonly ProductSummary[];
}) {
  const errors = form.formState.errors;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-semibold">
        得意先
        <select
          className={cn(
            "ui-input h-10 rounded-md border bg-white px-3 text-sm",
            errors.customerId ? "border-red-500" : "border-slate-300",
          )}
          disabled={loadingMasterOptions}
          {...form.register("customerId")}
        >
          <option value="">選択してください</option>
          {customerOptions.map((customer) => (
            <option key={customer.customerId} value={customer.customerId}>
              {customer.customerCode} / {customer.name}
            </option>
          ))}
        </select>
        <FieldError message={errorMessage(errors.customerId?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        商品
        <select
          className={cn(
            "ui-input h-10 rounded-md border bg-white px-3 text-sm",
            errors.productId ? "border-red-500" : "border-slate-300",
          )}
          disabled={loadingMasterOptions}
          {...form.register("productId")}
        >
          <option value="">選択してください</option>
          {productOptions.map((product) => (
            <option key={product.productId} value={product.productId}>
              {product.productCode} / {product.name}
            </option>
          ))}
        </select>
        <FieldError message={errorMessage(errors.productId?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        単価
        <Input
          hasError={Boolean(errors.unitPrice)}
          inputMode="decimal"
          {...form.register("unitPrice")}
        />
        <FieldError message={errorMessage(errors.unitPrice?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        適用開始日
        <Input
          hasError={Boolean(errors.effectiveFrom)}
          type="date"
          {...form.register("effectiveFrom")}
        />
        <FieldError message={errorMessage(errors.effectiveFrom?.message)} />
      </label>
    </div>
  );
}

function ChangeFields({
  form,
}: {
  readonly form: UseFormReturn<CustomerProductPriceChangeFormValues>;
}) {
  const errors = form.formState.errors;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-semibold">
        単価
        <Input
          hasError={Boolean(errors.unitPrice)}
          inputMode="decimal"
          {...form.register("unitPrice")}
        />
        <FieldError message={errorMessage(errors.unitPrice?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        適用開始日
        <Input
          hasError={Boolean(errors.effectiveFrom)}
          type="date"
          {...form.register("effectiveFrom")}
        />
        <FieldError message={errorMessage(errors.effectiveFrom?.message)} />
      </label>
    </div>
  );
}

function PreviewFields({
  form,
  selectedPrice,
}: {
  readonly form: UseFormReturn<PreviewFormValues>;
  readonly selectedPrice?: CustomerProductPriceSummary;
}) {
  const errors = form.formState.errors;

  return (
    <div className="grid gap-4">
      <input type="hidden" {...form.register("customerId")} />
      <input type="hidden" {...form.register("productId")} />
      <label className="grid gap-1.5 text-sm font-semibold">
        参照日
        <Input
          hasError={Boolean(errors.asOf)}
          type="date"
          {...form.register("asOf")}
        />
        <FieldError message={errorMessage(errors.asOf?.message)} />
      </label>
      {selectedPrice ? (
        <p className="text-xs font-medium text-slate-500">
          対象: {selectedPrice.customerCode} / {selectedPrice.customerName} ×{" "}
          {selectedPrice.productCode} / {selectedPrice.productName}
        </p>
      ) : null}
    </div>
  );
}
