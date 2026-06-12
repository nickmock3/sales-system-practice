"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  changeProduct,
  createProduct,
  fetchProductAsOf,
  fetchProductChanges,
  fetchProducts,
} from "./_api";
import {
  buildProductChangeKey,
  classifyProductChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  type ChangeTiming,
} from "./_change-status";
import { productChangeFormSchema, productFormSchema } from "./_schemas";
import {
  taxCategories,
  taxCategoryLabels,
  type ProductChange,
  type ProductChangeFormValues,
  type ProductFormValues,
  type ProductSearchParams,
  type ProductSummary,
} from "./_types";

type DiscontinuedFilter = "all" | "active" | "discontinued";

type ProductChangesResult = {
  readonly productId?: number;
  readonly items: ProductChange[];
};

type ProductAsOfResult = {
  readonly productId?: number;
  readonly asOf?: string;
  readonly item?: ProductSummary;
};

type ProductAsOfError = {
  readonly productId?: number;
  readonly asOf?: string;
  readonly message: string;
};

type ProductLoadOptions = {
  readonly preserveSelectionOnError?: boolean;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);

const buildSearchParams = (
  productCode: string,
  name: string,
  discontinuedFilter: DiscontinuedFilter,
): ProductSearchParams => ({
  productCode: productCode.trim() || undefined,
  name: name.trim() || undefined,
  isDiscontinued:
    discontinuedFilter === "all"
      ? undefined
      : discontinuedFilter === "discontinued",
});

const defaultProductValues = (): ProductFormValues => ({
  productCode: "",
  name: "",
  unit: "個",
  standardUnitPrice: "",
  taxCategory: "STANDARD",
  isDiscontinued: false,
  effectiveFrom: getBusinessDate(),
});

const defaultChangeValues = (
  product?: ProductSummary,
): ProductChangeFormValues => ({
  name: product?.name ?? "",
  unit: product?.unit ?? "個",
  standardUnitPrice: product ? String(product.standardUnitPrice) : "",
  taxCategory: product?.taxCategory ?? "STANDARD",
  isDiscontinued: product?.isDiscontinued ?? false,
  effectiveFrom: getBusinessDate(),
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

function ProductStatusBadge({
  product,
}: {
  readonly product: { readonly isDiscontinued: boolean };
}) {
  return product.isDiscontinued ? (
    <Badge tone="danger">販売停止</Badge>
  ) : (
    <Badge tone="success">販売中</Badge>
  );
}

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
    form.setError(field[0].toLowerCase() + field.slice(1) as Path<T>, {
      message: messages[0],
    });
  });
};

export default function ProductsPage() {
  const [authMode, setAuthMode] = useState<DummyAuthMode>(() =>
    getDummyAuthMode()
  );
  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
  const [discontinuedFilter, setDiscontinuedFilter] =
    useState<DiscontinuedFilter>("all");
  const changesRequestIdRef = useRef(0);
  const [changesResult, setChangesResult] = useState<ProductChangesResult>({
    items: [],
  });
  const [asOfDate, setAsOfDate] = useState(getBusinessDate());
  const asOfDateRef = useRef(asOfDate);
  const asOfRequestIdRef = useRef(0);
  const [asOfResult, setAsOfResult] = useState<ProductAsOfResult>({});
  const [formError, setFormError] = useState("");
  const [asOfErrorState, setAsOfErrorState] = useState<ProductAsOfError>({
    message: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingChangesProductId, setLoadingChangesProductId] =
    useState<number>();
  const [loadingAsOfKey, setLoadingAsOfKey] = useState<{
    readonly productId: number;
    readonly asOf: string;
  }>();

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultProductValues(),
  });

  const changeForm = useForm<ProductChangeFormValues>({
    resolver: zodResolver(productChangeFormSchema),
    defaultValues: defaultChangeValues(),
  });

  const clearSelectedProductState = () => {
    setChangesResult({ items: [] });
    setAsOfResult({});
    setAsOfErrorState({ message: "" });
  };

  const {
    error: listError,
    isLoading: isLoadingProducts,
    items: products,
    loadItems: loadProductItems,
    replaceItems: replaceProducts,
    selectedId: selectedProductId,
    selectedIdRef: selectedProductIdRef,
    selectedItem: selectedProduct,
    selectId: setSelectedProductId,
    setError: setListError,
  } = useListSelectionState<ProductSummary, number>({
    getId: (product) => product.productId,
    onSelectionChange: clearSelectedProductState,
  });

  const changes =
    changesResult.productId === selectedProductId ? changesResult.items : [];
  const asOfProduct =
    asOfResult.productId === selectedProductId
    && asOfResult.asOf === asOfDate
      ? asOfResult.item
      : undefined;
  const asOfError =
    asOfErrorState.productId === selectedProductId
    && asOfErrorState.asOf === asOfDate
      ? asOfErrorState.message
      : "";
  const isLoadingChanges =
    selectedProductId !== undefined
    && loadingChangesProductId === selectedProductId;
  const isLoadingAsOf =
    selectedProductId !== undefined
    && loadingAsOfKey?.productId === selectedProductId
    && loadingAsOfKey?.asOf === asOfDate;
  const businessDate = getBusinessDate();
  const currentEffectiveFrom = findCurrentEffectiveFrom(changes, businessDate);

  const changeAsOfDate = (nextAsOfDate: string) => {
    asOfDateRef.current = nextAsOfDate;
    setAsOfDate(nextAsOfDate);
  };

  const loadProducts = async (
    params = buildSearchParams(productCode, name, discontinuedFilter),
    options: ProductLoadOptions = {},
  ) => loadProductItems(() => fetchProducts(params), options);

  const loadChanges = async (productId: number) => {
    const requestId = changesRequestIdRef.current + 1;
    changesRequestIdRef.current = requestId;
    setLoadingChangesProductId(productId);

    try {
      const nextChanges = await fetchProductChanges(productId);
      if (
        changesRequestIdRef.current === requestId
        && selectedProductIdRef.current === productId
      ) {
        setChangesResult({ productId, items: nextChanges });
      }
    } catch (error) {
      if (
        changesRequestIdRef.current === requestId
        && selectedProductIdRef.current === productId
      ) {
        setListError(formatApiError(error));
        setChangesResult({ productId, items: [] });
      }
    } finally {
      if (changesRequestIdRef.current === requestId) {
        setLoadingChangesProductId(undefined);
      }
    }
  };

  const loadAsOf = async (productId: number, targetAsOf: string) => {
    const requestId = asOfRequestIdRef.current + 1;
    asOfRequestIdRef.current = requestId;
    setLoadingAsOfKey({ productId, asOf: targetAsOf });
    setAsOfErrorState({ message: "" });

    try {
      const nextAsOf = await fetchProductAsOf(productId, targetAsOf);
      if (
        asOfRequestIdRef.current === requestId
        && selectedProductIdRef.current === productId
        && asOfDateRef.current === targetAsOf
      ) {
        setAsOfResult({ productId, asOf: targetAsOf, item: nextAsOf });
      }
    } catch (error) {
      if (
        asOfRequestIdRef.current === requestId
        && selectedProductIdRef.current === productId
        && asOfDateRef.current === targetAsOf
      ) {
        setAsOfResult({ productId, asOf: targetAsOf });
        setAsOfErrorState({
          productId,
          asOf: targetAsOf,
          message: formatApiError(error),
        });
      }
    } finally {
      if (asOfRequestIdRef.current === requestId) {
        setLoadingAsOfKey(undefined);
      }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProducts({}), 0);
    return () => window.clearTimeout(timer);
    // 初回表示だけで一覧を取得する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedProductId === undefined) {
      changeForm.reset(defaultChangeValues());
      return;
    }

    const product = products.find((item) => item.productId === selectedProductId);
    changeForm.reset(defaultChangeValues(product));
    const timer = window.setTimeout(() => {
      void loadChanges(selectedProductId);
      void loadAsOf(selectedProductId, asOfDate);
    }, 0);
    return () => window.clearTimeout(timer);
    // 選択商品の変更に合わせて変更フォームと指定日参照を更新する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  const changeAuthMode = (mode: DummyAuthMode) => {
    setDummyAuthMode(mode);
    setAuthMode(mode);
    setSuccessMessage("");
    void loadProducts();
  };

  const searchProducts = () => {
    setSuccessMessage("");
    void loadProducts(buildSearchParams(productCode, name, discontinuedFilter));
  };

  const submitProduct = async (values: ProductFormValues) => {
    setFormError("");
    setSuccessMessage("");

    try {
      const created = await createProduct(values);
      productForm.reset(defaultProductValues());
      setSuccessMessage("商品を登録し、一覧を更新しました。");
      setProductCode("");
      setName("");
      const loadResult = await loadProducts({});
      if (!loadResult.ok) {
        setSuccessMessage("商品を登録しました。一覧の再読込に失敗しました。");
        return;
      }

      const nextProducts = loadResult.items;
      if (
        isEffectiveOnOrBeforeToday(created.effectiveFrom)
        && !nextProducts.some((product) => product.productId === created.productId)
      ) {
        replaceProducts([created, ...nextProducts], {
          preferredSelectedId: created.productId,
        });
        return;
      }

      if (nextProducts.some((product) => product.productId === created.productId)) {
        setSelectedProductId(created.productId);
      }
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, productForm);
    }
  };

  const submitChange = async (values: ProductChangeFormValues) => {
    if (!selectedProduct) {
      setFormError("情報を変更する商品を一覧から選択してください。");
      return;
    }

    setFormError("");
    setSuccessMessage("");

    try {
      await changeProduct(selectedProduct.productId, values);
      const loadResult = await loadProducts(
        buildSearchParams(productCode, name, discontinuedFilter),
        { preserveSelectionOnError: true },
      );
      setSuccessMessage(
        loadResult.ok
          ? "商品情報を変更し、一覧と変更履歴を更新しました。"
          : "商品情報を変更しました。一覧の再読込に失敗しました。",
      );
      await loadChanges(selectedProduct.productId);
      await loadAsOf(selectedProduct.productId, asOfDate);
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, changeForm);
    }
  };

  const submitAsOf = () => {
    if (!selectedProduct) {
      setAsOfErrorState({
        productId: undefined,
        asOf: asOfDate,
        message: "参照する商品を一覧から選択してください。",
      });
      return;
    }

    void loadAsOf(selectedProduct.productId, asOfDate);
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
            <span className="text-slate-700">商品マスタ</span>
          </nav>
          <h1 className="mt-1.5">商品マスタ</h1>
          <p>
            商品の現在情報と変更履歴を確認し、指定日から商品情報を変更します。
          </p>
        </div>

        {successMessage ? (
          <Alert className="py-2" title="完了しました" tone="success">
            {successMessage}
          </Alert>
        ) : null}
        {listError || formError || asOfError ? (
          <Alert className="py-2" title="エラーを確認してください" tone="danger">
            {[listError, formError, asOfError].filter(Boolean).join(" ")}
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
                  <span>商品コード</span>
                  <Input
                    className="h-8 text-xs"
                    value={productCode}
                    onChange={(event) => setProductCode(event.target.value)}
                  />
                </label>
                <label className="search-field">
                  <span>商品名</span>
                  <Input
                    className="h-8 text-xs"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="search-field search-field-status">
                  <span>販売状態</span>
                  <select
                    className="ui-input h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                    value={discontinuedFilter}
                    onChange={(event) =>
                      setDiscontinuedFilter(event.target.value as DiscontinuedFilter)
                    }
                  >
                    <option value="all">すべて</option>
                    <option value="active">販売中</option>
                    <option value="discontinued">販売停止</option>
                  </select>
                </label>
                <div className="search-actions">
                  <Button className="h-8 px-2 text-xs" onClick={searchProducts}>
                    <Search aria-hidden="true" className="size-4" />
                    検索
                  </Button>
                  <Button
                    className="h-8 px-2 text-xs"
                    onClick={() => void loadProducts()}
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
                <h2 id="list-heading">商品一覧</h2>
                <p>一覧は本日時点で適用される商品情報を表示します。</p>
              </div>
              <Badge tone="neutral">{products.length} 件</Badge>
            </div>
            {products.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table text-left">
                  <thead>
                    <tr>
                      <th>商品コード</th>
                      <th>商品名</th>
                      <th>単位</th>
                      <th className="text-right">標準単価</th>
                      <th>税区分</th>
                      <th>状態</th>
                      <th>適用開始日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr
                        className={cn(
                          "cursor-pointer hover:bg-slate-50",
                          selectedProductId === product.productId
                            && "data-table-row-selected",
                        )}
                        key={product.productId}
                        onClick={() => setSelectedProductId(product.productId)}
                      >
                        <td className="font-mono text-slate-700">
                          {product.productCode}
                        </td>
                        <td className="font-semibold">{product.name}</td>
                        <td>{product.unit}</td>
                        <td className="text-right font-mono">
                          {formatMoney(product.standardUnitPrice)} 円
                        </td>
                        <td>{taxCategoryLabels[product.taxCategory]}</td>
                        <td>
                          <ProductStatusBadge product={product} />
                        </td>
                        <td>{formatDate(product.effectiveFrom)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {isLoadingProducts ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                読み込み中
              </p>
            ) : null}
            {!isLoadingProducts && products.length === 0 ? (
              <div className="result-empty-state">
                <p>該当データなし</p>
                <span>検索条件を変更するか、新しい商品を登録してください。</span>
              </div>
            ) : null}
          </section>

          <section className="surface selected-summary" aria-labelledby="detail-heading">
            <div className="selected-summary-heading">
              <h2 id="detail-heading">選択中の商品</h2>
              {selectedProduct ? <ProductStatusBadge product={selectedProduct} /> : null}
            </div>
            {selectedProduct ? (
              <dl className="selected-summary-list">
                <dt>商品コード</dt>
                <dd className="font-mono">{selectedProduct.productCode}</dd>
                <dt>商品名</dt>
                <dd>{selectedProduct.name}</dd>
                <dt>単位</dt>
                <dd>{selectedProduct.unit}</dd>
                <dt>標準単価</dt>
                <dd>{formatMoney(selectedProduct.standardUnitPrice)} 円</dd>
                <dt>税区分</dt>
                <dd>
                  {taxCategoryLabels[selectedProduct.taxCategory]} (
                  {selectedProduct.taxCategory})
                </dd>
                <dt>適用開始日</dt>
                <dd>{formatDate(selectedProduct.effectiveFrom)}</dd>
              </dl>
            ) : (
              <div className="selected-empty">
                <p>未選択</p>
                <span>商品一覧から行を選択すると現在の商品情報を表示します。</span>
              </div>
            )}
            {selectedProduct ? (
              <Link
                className="selected-summary-link"
                href={`/customer-product-prices?productId=${selectedProduct.productId}`}
              >
                得意先別商品単価でこの商品を確認
              </Link>
            ) : null}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="surface section-pad" aria-labelledby="create-heading">
            <div className="section-heading">
              <h2 id="create-heading">商品新規登録</h2>
              <p>商品本体と初回の商品情報を同時に登録します。</p>
            </div>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                void productForm.handleSubmit(submitProduct)(event);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold">
                  商品コード
                  <Input
                    hasError={Boolean(productForm.formState.errors.productCode)}
                    {...productForm.register("productCode")}
                  />
                  <FieldError message={productForm.formState.errors.productCode?.message} />
                </label>
                <ProductChangeFields form={productForm} />
              </div>
              <Button disabled={productForm.formState.isSubmitting} type="submit">
                {productForm.formState.isSubmitting ? (
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
              <h2 id="change-heading">商品情報変更</h2>
              <p>
                {selectedProduct
                  ? `${selectedProduct.productCode} の情報を指定日から変更します。`
                  : "商品一覧から商品を選択すると情報を変更できます。"}
              </p>
            </div>
            {selectedProduct ? (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  void changeForm.handleSubmit(submitChange)(event);
                }}
              >
                <fieldset
                  className="grid gap-4 sm:grid-cols-2"
                  disabled={!selectedProduct || changeForm.formState.isSubmitting}
                >
                  <ProductChangeFields form={changeForm} />
                </fieldset>
                <Button
                  disabled={!selectedProduct || changeForm.formState.isSubmitting}
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
                <p>商品未選択</p>
                <span>一覧で対象商品を選択してから情報を変更します。</span>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section className="surface section-pad" aria-labelledby="asof-heading">
            <div className="section-heading">
              <h2 id="asof-heading">指定日時点の商品情報</h2>
              <p>対象日以前で一番新しい商品情報を確認します。</p>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">
                参照日
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(event) => changeAsOfDate(event.target.value)}
                />
              </label>
              <Button
                disabled={!selectedProduct || isLoadingAsOf}
                onClick={submitAsOf}
                type="button"
                variant="secondary"
              >
                {isLoadingAsOf ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Search aria-hidden="true" className="size-4" />
                )}
                参照
              </Button>
              {asOfProduct ? (
                <dl className="selected-summary-list">
                  <dt>商品名</dt>
                  <dd>{asOfProduct.name}</dd>
                  <dt>単位</dt>
                  <dd>{asOfProduct.unit}</dd>
                  <dt>標準単価</dt>
                  <dd>{formatMoney(asOfProduct.standardUnitPrice)} 円</dd>
                  <dt>税区分</dt>
                  <dd>{taxCategoryLabels[asOfProduct.taxCategory]}</dd>
                  <dt>状態</dt>
                  <dd>
                    <ProductStatusBadge product={asOfProduct} />
                  </dd>
                  <dt>適用開始日</dt>
                  <dd>{formatDate(asOfProduct.effectiveFrom)}</dd>
                </dl>
              ) : (
                <div className="selected-empty">
                  <p>参照結果なし</p>
                  <span>商品と参照日を指定して確認します。</span>
                </div>
              )}
            </div>
          </section>

          <section className="surface section-pad" aria-labelledby="history-heading">
            <div className="section-heading">
              <h2 id="history-heading">変更履歴</h2>
              <p>
                同じ商品の変更を適用開始日の新しい順で表示します。将来適用予定も含みます。
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
                    <th>商品名</th>
                    <th>単位</th>
                    <th className="text-right">標準単価</th>
                    <th>税区分</th>
                    <th>販売状態</th>
                    <th>適用開始日</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={buildProductChangeKey(change)}>
                      <td>
                        <ChangeTimingBadge
                          timing={classifyProductChange(
                            change,
                            businessDate,
                            currentEffectiveFrom,
                          )}
                        />
                      </td>
                      <td className="font-semibold">{change.name}</td>
                      <td>{change.unit}</td>
                      <td className="text-right font-mono">
                        {formatMoney(change.standardUnitPrice)} 円
                      </td>
                      <td>{taxCategoryLabels[change.taxCategory]}</td>
                      <td>
                        <ProductStatusBadge product={change} />
                      </td>
                      <td>{formatDate(change.effectiveFrom)}</td>
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

function ProductChangeFields<T extends ProductChangeFormValues>({
  form,
}: {
  readonly form: UseFormReturn<T>;
}) {
  const errors = form.formState.errors;
  const namePath = "name" as Path<T>;
  const unitPath = "unit" as Path<T>;
  const standardUnitPricePath = "standardUnitPrice" as Path<T>;
  const taxCategoryPath = "taxCategory" as Path<T>;
  const effectiveFromPath = "effectiveFrom" as Path<T>;
  const isDiscontinuedPath = "isDiscontinued" as Path<T>;

  return (
    <>
      <label className="grid gap-1.5 text-sm font-semibold">
        商品名
        <Input hasError={Boolean(errors.name)} {...form.register(namePath)} />
        <FieldError message={errorMessage(errors.name?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        単位
        <Input hasError={Boolean(errors.unit)} {...form.register(unitPath)} />
        <FieldError message={errorMessage(errors.unit?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        標準単価
        <Input
          hasError={Boolean(errors.standardUnitPrice)}
          inputMode="decimal"
          {...form.register(standardUnitPricePath)}
        />
        <span className="text-xs font-medium text-slate-500">
          得意先別商品単価が存在しない場合のフォールバック単価です。
        </span>
        <FieldError message={errorMessage(errors.standardUnitPrice?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        税区分
        <select
          className={cn(
            "ui-input h-10 rounded-md border bg-white px-3 text-sm",
            errors.taxCategory ? "border-red-500" : "border-slate-300",
          )}
          {...form.register(taxCategoryPath)}
        >
          {taxCategories.map((category) => (
            <option key={category} value={category}>
              {taxCategoryLabels[category]} ({category})
            </option>
          ))}
        </select>
        <FieldError message={errorMessage(errors.taxCategory?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        適用開始日
        <Input
          hasError={Boolean(errors.effectiveFrom)}
          type="date"
          {...form.register(effectiveFromPath)}
        />
        <span className="text-xs font-medium text-slate-500">
          適用開始日は、変更が反映される日です。
        </span>
        <FieldError message={errorMessage(errors.effectiveFrom?.message)} />
      </label>
      <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
        <input
          className="size-4 rounded border-slate-300 accent-teal-700"
          type="checkbox"
          {...form.register(isDiscontinuedPath)}
        />
        販売停止として登録
      </label>
    </>
  );
}
