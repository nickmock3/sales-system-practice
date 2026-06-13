"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronRight,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { useForm, type Path, type PathValue, type UseFormReturn } from "react-hook-form";
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
  changeTaxRate,
  fetchTaxRateAsOf,
  fetchTaxRateChanges,
  fetchTaxRates,
} from "./_api";
import {
  buildTaxRateChangeKey,
  classifyTaxRateChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  type ChangeTiming,
} from "./_change-status";
import { toTaxRateFormFieldName } from "./_field-errors";
import { taxRateChangeFormSchema, taxRateFormSchema } from "./_schemas";
import {
  accountingCategoryLabels,
  formatRatePercent,
  rateToPercentInput,
  requiresZeroRate,
  taxCategories,
  taxCategoryLabels,
  type AccountingCategory,
  type TaxCategory,
  type TaxRateChange,
  type TaxRateChangeFormValues,
  type TaxRateFormValues,
  type TaxRateSummary,
} from "./_types";

type TaxRateChangesResult = {
  readonly taxCategory?: TaxCategory;
  readonly items: TaxRateChange[];
};

type TaxRateAsOfResult = {
  readonly taxCategory?: TaxCategory;
  readonly asOf?: string;
  readonly item?: TaxRateSummary;
};

type TaxRateAsOfError = {
  readonly taxCategory?: TaxCategory;
  readonly asOf?: string;
  readonly message: string;
};

type TaxRateLoadOptions = {
  readonly preserveSelectionOnError?: boolean;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const formatAccountingCategory = (value: AccountingCategory) =>
  accountingCategoryLabels[value];

const defaultTaxRateValues = (): TaxRateFormValues => ({
  taxCategory: "STANDARD",
  ratePercent: "10",
  effectiveFrom: getBusinessDate(),
});

const defaultChangeValues = (
  taxRate?: TaxRateSummary,
): TaxRateChangeFormValues => ({
  taxCategory: taxRate?.taxCategory ?? "STANDARD",
  ratePercent: taxRate ? rateToPercentInput(taxRate.rate) : "10",
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
    form.setError(toTaxRateFormFieldName(field) as Path<T>, {
      message: messages[0],
    });
  });
};

export default function TaxRatesPage() {
  const [authMode, setAuthMode] = useState<DummyAuthMode>(() =>
    getDummyAuthMode()
  );
  const changesRequestIdRef = useRef(0);
  const [changesResult, setChangesResult] = useState<TaxRateChangesResult>({
    items: [],
  });
  const [asOfDate, setAsOfDate] = useState(getBusinessDate());
  const asOfDateRef = useRef(asOfDate);
  const asOfRequestIdRef = useRef(0);
  const [asOfResult, setAsOfResult] = useState<TaxRateAsOfResult>({});
  const [formError, setFormError] = useState("");
  const [asOfErrorState, setAsOfErrorState] = useState<TaxRateAsOfError>({
    message: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingChangesTaxCategory, setLoadingChangesTaxCategory] =
    useState<TaxCategory>();
  const [loadingAsOfKey, setLoadingAsOfKey] = useState<{
    readonly taxCategory: TaxCategory;
    readonly asOf: string;
  }>();

  const taxRateForm = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateFormSchema),
    defaultValues: defaultTaxRateValues(),
  });

  const changeForm = useForm<TaxRateChangeFormValues>({
    resolver: zodResolver(taxRateChangeFormSchema),
    defaultValues: defaultChangeValues(),
  });

  const clearSelectedTaxRateState = () => {
    setChangesResult({ items: [] });
    setAsOfResult({});
    setAsOfErrorState({ message: "" });
  };

  const {
    error: listError,
    isLoading: isLoadingTaxRates,
    items: taxRates,
    loadItems: loadTaxRateItems,
    replaceItems: replaceTaxRates,
    selectedId: selectedTaxCategory,
    selectedIdRef: selectedTaxCategoryRef,
    selectedItem: selectedTaxRate,
    selectId: setSelectedTaxCategory,
    setError: setListError,
  } = useListSelectionState<TaxRateSummary, TaxCategory>({
    getId: (taxRate) => taxRate.taxCategory,
    onSelectionChange: clearSelectedTaxRateState,
  });

  const changes =
    changesResult.taxCategory === selectedTaxCategory
      ? changesResult.items
      : [];
  const asOfTaxRate =
    asOfResult.taxCategory === selectedTaxCategory
    && asOfResult.asOf === asOfDate
      ? asOfResult.item
      : undefined;
  const asOfError =
    asOfErrorState.taxCategory === selectedTaxCategory
    && asOfErrorState.asOf === asOfDate
      ? asOfErrorState.message
      : "";
  const isLoadingChanges =
    selectedTaxCategory !== undefined
    && loadingChangesTaxCategory === selectedTaxCategory;
  const isLoadingAsOf =
    selectedTaxCategory !== undefined
    && loadingAsOfKey?.taxCategory === selectedTaxCategory
    && loadingAsOfKey?.asOf === asOfDate;
  const businessDate = getBusinessDate();
  const currentEffectiveFrom = findCurrentEffectiveFrom(changes, businessDate);

  const changeAsOfDate = (nextAsOfDate: string) => {
    asOfDateRef.current = nextAsOfDate;
    setAsOfDate(nextAsOfDate);
  };

  const loadTaxRatesList = async (options: TaxRateLoadOptions = {}) =>
    loadTaxRateItems(() => fetchTaxRates(), options);

  const loadChanges = async (taxCategory: TaxCategory) => {
    const requestId = changesRequestIdRef.current + 1;
    changesRequestIdRef.current = requestId;
    setLoadingChangesTaxCategory(taxCategory);

    try {
      const nextChanges = await fetchTaxRateChanges(taxCategory);
      if (
        changesRequestIdRef.current === requestId
        && selectedTaxCategoryRef.current === taxCategory
      ) {
        setChangesResult({ taxCategory, items: nextChanges });
      }
    } catch (error) {
      if (
        changesRequestIdRef.current === requestId
        && selectedTaxCategoryRef.current === taxCategory
      ) {
        setListError(formatApiError(error));
        setChangesResult({ taxCategory, items: [] });
      }
    } finally {
      if (changesRequestIdRef.current === requestId) {
        setLoadingChangesTaxCategory(undefined);
      }
    }
  };

  const loadAsOf = async (taxCategory: TaxCategory, targetAsOf: string) => {
    const requestId = asOfRequestIdRef.current + 1;
    asOfRequestIdRef.current = requestId;
    setLoadingAsOfKey({ taxCategory, asOf: targetAsOf });
    setAsOfErrorState({ message: "" });

    try {
      const nextAsOf = await fetchTaxRateAsOf(taxCategory, targetAsOf);
      if (
        asOfRequestIdRef.current === requestId
        && selectedTaxCategoryRef.current === taxCategory
        && asOfDateRef.current === targetAsOf
      ) {
        setAsOfResult({ taxCategory, asOf: targetAsOf, item: nextAsOf });
      }
    } catch (error) {
      if (
        asOfRequestIdRef.current === requestId
        && selectedTaxCategoryRef.current === taxCategory
        && asOfDateRef.current === targetAsOf
      ) {
        setAsOfResult({ taxCategory, asOf: targetAsOf });
        setAsOfErrorState({
          taxCategory,
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
    const timer = window.setTimeout(() => void loadTaxRatesList(), 0);
    return () => window.clearTimeout(timer);
    // 初回表示だけで一覧を取得する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTaxCategory === undefined) {
      changeForm.reset(defaultChangeValues());
      return;
    }

    const taxRate = taxRates.find(
      (item) => item.taxCategory === selectedTaxCategory,
    );
    changeForm.reset(defaultChangeValues(taxRate));
    const timer = window.setTimeout(() => {
      void loadChanges(selectedTaxCategory);
      void loadAsOf(selectedTaxCategory, asOfDate);
    }, 0);
    return () => window.clearTimeout(timer);
    // 選択税区分の変更に合わせて変更フォームと指定日参照を更新する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaxCategory]);

  const changeAuthMode = (mode: DummyAuthMode) => {
    setDummyAuthMode(mode);
    setAuthMode(mode);
    setSuccessMessage("");
    void loadTaxRatesList();
  };

  const submitTaxRate = async (values: TaxRateFormValues) => {
    setFormError("");
    setSuccessMessage("");

    try {
      const created = await changeTaxRate(values.taxCategory, values);
      taxRateForm.reset(defaultTaxRateValues());
      setSuccessMessage("税率を登録し、一覧を更新しました。");
      const loadResult = await loadTaxRatesList();
      if (!loadResult.ok) {
        setSuccessMessage("税率を登録しました。一覧の再読込に失敗しました。");
        return;
      }

      const nextTaxRates = loadResult.items;
      if (
        isEffectiveOnOrBeforeToday(created.effectiveFrom)
        && !nextTaxRates.some(
          (taxRate) => taxRate.taxCategory === created.taxCategory,
        )
      ) {
        replaceTaxRates([created, ...nextTaxRates], {
          preferredSelectedId: created.taxCategory,
        });
        return;
      }

      if (
        nextTaxRates.some(
          (taxRate) => taxRate.taxCategory === created.taxCategory,
        )
      ) {
        setSelectedTaxCategory(created.taxCategory);
      }
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, taxRateForm);
    }
  };

  const submitChange = async (values: TaxRateChangeFormValues) => {
    if (!selectedTaxRate) {
      setFormError("税率を変更する税区分を一覧から選択してください。");
      return;
    }

    setFormError("");
    setSuccessMessage("");

    try {
      await changeTaxRate(selectedTaxRate.taxCategory, values);
      const loadResult = await loadTaxRatesList({
        preserveSelectionOnError: true,
      });
      setSuccessMessage(
        loadResult.ok
          ? "税率を変更し、一覧と変更履歴を更新しました。"
          : "税率を変更しました。一覧の再読込に失敗しました。",
      );
      await loadChanges(selectedTaxRate.taxCategory);
      await loadAsOf(selectedTaxRate.taxCategory, asOfDate);
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, changeForm);
    }
  };

  const submitAsOf = () => {
    if (!selectedTaxRate) {
      setAsOfErrorState({
        taxCategory: undefined,
        asOf: asOfDate,
        message: "参照する税区分を一覧から選択してください。",
      });
      return;
    }

    void loadAsOf(selectedTaxRate.taxCategory, asOfDate);
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
            <span className="text-slate-700">税率マスタ</span>
          </nav>
          <h1 className="mt-1.5">税率マスタ</h1>
          <p>
            税区分ごとの税率と変更履歴を確認し、指定日から税率を変更します。
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
            <div className="result-heading">
              <div>
                <h2 id="list-heading">税率一覧</h2>
                <p>一覧は本日時点で適用される税率を表示します。</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{taxRates.length} 件</Badge>
                <Button
                  className="h-8 px-2 text-xs"
                  onClick={() => void loadTaxRatesList()}
                  variant="secondary"
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  再読込
                </Button>
              </div>
            </div>
            {taxRates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table text-left">
                  <thead>
                    <tr>
                      <th>税区分コード</th>
                      <th>税区分名</th>
                      <th>会計分類</th>
                      <th className="text-right">税率</th>
                      <th>適用開始日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxRates.map((taxRate) => (
                      <tr
                        className={cn(
                          "cursor-pointer hover:bg-slate-50",
                          selectedTaxCategory === taxRate.taxCategory
                            && "data-table-row-selected",
                        )}
                        key={taxRate.taxCategory}
                        onClick={() => setSelectedTaxCategory(taxRate.taxCategory)}
                      >
                        <td className="font-mono text-slate-700">
                          {taxRate.taxCategory}
                        </td>
                        <td className="font-semibold">{taxRate.taxCategoryName}</td>
                        <td>
                          {formatAccountingCategory(taxRate.accountingCategory)}
                        </td>
                        <td className="text-right font-mono">
                          {formatRatePercent(taxRate.rate)}
                        </td>
                        <td>{formatDate(taxRate.effectiveFrom)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {isLoadingTaxRates ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                読み込み中
              </p>
            ) : null}
            {!isLoadingTaxRates && taxRates.length === 0 ? (
              <div className="result-empty-state">
                <p>該当データなし</p>
                <span>税区分を初回登録すると一覧に表示されます。</span>
              </div>
            ) : null}
          </section>

          <section className="surface selected-summary" aria-labelledby="detail-heading">
            <div className="selected-summary-heading">
              <h2 id="detail-heading">選択中の税区分</h2>
            </div>
            {selectedTaxRate ? (
              <dl className="selected-summary-list">
                <dt>税区分コード</dt>
                <dd className="font-mono">{selectedTaxRate.taxCategory}</dd>
                <dt>税区分名</dt>
                <dd>{selectedTaxRate.taxCategoryName}</dd>
                <dt>会計分類</dt>
                <dd>
                  {formatAccountingCategory(selectedTaxRate.accountingCategory)}
                </dd>
                <dt>税率</dt>
                <dd>{formatRatePercent(selectedTaxRate.rate)}</dd>
                <dt>適用開始日</dt>
                <dd>{formatDate(selectedTaxRate.effectiveFrom)}</dd>
              </dl>
            ) : (
              <div className="selected-empty">
                <p>未選択</p>
                <span>税率一覧から行を選択すると現在の税率情報を表示します。</span>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="surface section-pad" aria-labelledby="create-heading">
            <div className="section-heading">
              <h2 id="create-heading">税率初回登録</h2>
              <p>税区分ごとの初回税率を登録します。</p>
            </div>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                void taxRateForm.handleSubmit(submitTaxRate)(event);
              }}
            >
              <TaxRateFields form={taxRateForm} includeTaxCategory />
              <Button disabled={taxRateForm.formState.isSubmitting} type="submit">
                {taxRateForm.formState.isSubmitting ? (
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
              <h2 id="change-heading">税率変更</h2>
              <p>
                {selectedTaxRate
                  ? `${selectedTaxRate.taxCategoryName} の税率を指定日から変更します。`
                  : "税率一覧から税区分を選択すると税率を変更できます。"}
              </p>
            </div>
            {selectedTaxRate ? (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  void changeForm.handleSubmit(submitChange)(event);
                }}
              >
                <fieldset
                  className="grid gap-4"
                  disabled={!selectedTaxRate || changeForm.formState.isSubmitting}
                >
                  <TaxRateFields form={changeForm} />
                </fieldset>
                <Button
                  disabled={!selectedTaxRate || changeForm.formState.isSubmitting}
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
                <p>税区分未選択</p>
                <span>一覧で対象税区分を選択してから税率を変更します。</span>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section className="surface section-pad" aria-labelledby="asof-heading">
            <div className="section-heading">
              <h2 id="asof-heading">指定日時点の税率</h2>
              <p>対象日以前で一番新しい税率を確認します。</p>
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
                disabled={!selectedTaxRate || isLoadingAsOf}
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
              {asOfTaxRate ? (
                <dl className="selected-summary-list">
                  <dt>税区分名</dt>
                  <dd>{asOfTaxRate.taxCategoryName}</dd>
                  <dt>会計分類</dt>
                  <dd>
                    {formatAccountingCategory(asOfTaxRate.accountingCategory)}
                  </dd>
                  <dt>税率</dt>
                  <dd>{formatRatePercent(asOfTaxRate.rate)}</dd>
                  <dt>適用開始日</dt>
                  <dd>{formatDate(asOfTaxRate.effectiveFrom)}</dd>
                </dl>
              ) : (
                <div className="selected-empty">
                  <p>参照結果なし</p>
                  <span>税区分と参照日を指定して確認します。</span>
                </div>
              )}
            </div>
          </section>

          <section className="surface section-pad" aria-labelledby="history-heading">
            <div className="section-heading">
              <h2 id="history-heading">変更履歴</h2>
              <p>
                同じ税区分の変更を適用開始日の新しい順で表示します。将来適用予定も含みます。
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
                    <th>税区分名</th>
                    <th>会計分類</th>
                    <th className="text-right">税率</th>
                    <th>適用開始日</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={buildTaxRateChangeKey(change)}>
                      <td>
                        <ChangeTimingBadge
                          timing={classifyTaxRateChange(
                            change,
                            businessDate,
                            currentEffectiveFrom,
                          )}
                        />
                      </td>
                      <td className="font-semibold">{change.taxCategoryName}</td>
                      <td>
                        {formatAccountingCategory(change.accountingCategory)}
                      </td>
                      <td className="text-right font-mono">
                        {formatRatePercent(change.rate)}
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

function TaxRateFields<T extends TaxRateChangeFormValues>({
  form,
  includeTaxCategory = false,
}: {
  readonly form: UseFormReturn<T>;
  readonly includeTaxCategory?: boolean;
}) {
  const errors = form.formState.errors;
  const taxCategoryPath = "taxCategory" as Path<T>;
  const ratePercentPath = "ratePercent" as Path<T>;
  const effectiveFromPath = "effectiveFrom" as Path<T>;
  const taxCategory = form.watch(taxCategoryPath) as TaxCategory | undefined;
  const isZeroRateCategory =
    taxCategory !== undefined && requiresZeroRate(taxCategory);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {includeTaxCategory ? (
        <label className="grid gap-1.5 text-sm font-semibold">
          税区分
          <select
            className={cn(
              "ui-input h-10 rounded-md border bg-white px-3 text-sm",
              errors.taxCategory ? "border-red-500" : "border-slate-300",
            )}
            {...(() => {
              const { onChange, ...registration } = form.register(taxCategoryPath);
              return {
                ...registration,
                onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                  void onChange(event);
                  if (requiresZeroRate(event.target.value as TaxCategory)) {
                    form.setValue(
                      ratePercentPath,
                      "0" as PathValue<T, Path<T>>,
                    );
                  }
                },
              };
            })()}
          >
            {taxCategories.map((category) => (
              <option key={category} value={category}>
                {taxCategoryLabels[category]} ({category})
              </option>
            ))}
          </select>
          <FieldError message={errorMessage(errors.taxCategory?.message)} />
        </label>
      ) : null}
      <label className="grid gap-1.5 text-sm font-semibold">
        税率 (%)
        <Input
          disabled={isZeroRateCategory}
          hasError={Boolean(errors.ratePercent)}
          inputMode="decimal"
          {...form.register(ratePercentPath)}
        />
        <span className="text-xs font-medium text-slate-500">
          {isZeroRateCategory
            ? "非課税・免税は0%固定です。"
            : "画面入力は百分率です。API には小数税率で送信します。"}
        </span>
        <FieldError message={errorMessage(errors.ratePercent?.message)} />
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
    </div>
  );
}
