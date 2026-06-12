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
  changeCustomer,
  createCustomer,
  fetchCustomerAsOf,
  fetchCustomerChanges,
  fetchCustomers,
} from "./_api";
import {
  buildCustomerChangeKey,
  classifyCustomerChange,
  findCurrentEffectiveFrom,
  getBusinessDate,
  isEffectiveOnOrBeforeToday,
  type ChangeTiming,
} from "./_change-status";
import { customerChangeFormSchema, customerFormSchema } from "./_schemas";
import type {
  CustomerChange,
  CustomerChangeFormValues,
  CustomerFormValues,
  CustomerSearchParams,
  CustomerSummary,
} from "./_types";

type CustomerChangesResult = {
  readonly customerId?: number;
  readonly items: CustomerChange[];
};

type CustomerAsOfResult = {
  readonly customerId?: number;
  readonly asOf?: string;
  readonly item?: CustomerSummary;
};

type CustomerAsOfError = {
  readonly customerId?: number;
  readonly asOf?: string;
  readonly message: string;
};

type CustomerLoadOptions = {
  readonly preserveSelectionOnError?: boolean;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const buildSearchParams = (
  customerCode: string,
  name: string,
): CustomerSearchParams => ({
  customerCode: customerCode.trim() || undefined,
  name: name.trim() || undefined,
});

const defaultCustomerValues = (): CustomerFormValues => ({
  customerCode: "",
  name: "",
  address: "",
  phoneNumber: "",
  effectiveFrom: getBusinessDate(),
});

const defaultChangeValues = (
  customer?: CustomerSummary,
): CustomerChangeFormValues => ({
  name: customer?.name ?? "",
  address: customer?.address ?? "",
  phoneNumber: customer?.phoneNumber ?? "",
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
    form.setError(field[0].toLowerCase() + field.slice(1) as Path<T>, {
      message: messages[0],
    });
  });
};

export default function CustomersPage() {
  const [authMode, setAuthMode] = useState<DummyAuthMode>(() =>
    getDummyAuthMode()
  );
  const [customerCode, setCustomerCode] = useState("");
  const [name, setName] = useState("");
  const changesRequestIdRef = useRef(0);
  const [changesResult, setChangesResult] = useState<CustomerChangesResult>({
    items: [],
  });
  const [asOfDate, setAsOfDate] = useState(getBusinessDate());
  const asOfDateRef = useRef(asOfDate);
  const asOfRequestIdRef = useRef(0);
  const [asOfResult, setAsOfResult] = useState<CustomerAsOfResult>({});
  const [formError, setFormError] = useState("");
  const [asOfErrorState, setAsOfErrorState] = useState<CustomerAsOfError>({
    message: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingChangesCustomerId, setLoadingChangesCustomerId] =
    useState<number>();
  const [loadingAsOfKey, setLoadingAsOfKey] = useState<{
    readonly customerId: number;
    readonly asOf: string;
  }>();

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultCustomerValues(),
  });

  const changeForm = useForm<CustomerChangeFormValues>({
    resolver: zodResolver(customerChangeFormSchema),
    defaultValues: defaultChangeValues(),
  });

  const clearSelectedCustomerState = () => {
    setChangesResult({ items: [] });
    setAsOfResult({});
    setAsOfErrorState({ message: "" });
  };

  const {
    error: listError,
    isLoading: isLoadingCustomers,
    items: customers,
    loadItems: loadCustomerItems,
    replaceItems: replaceCustomers,
    selectedId: selectedCustomerId,
    selectedIdRef: selectedCustomerIdRef,
    selectedItem: selectedCustomer,
    selectId: setSelectedCustomer,
    setError: setListError,
  } = useListSelectionState<CustomerSummary, number>({
    getId: (customer) => customer.customerId,
    onSelectionChange: clearSelectedCustomerState,
  });

  const changes =
    changesResult.customerId === selectedCustomerId ? changesResult.items : [];
  const asOfCustomer =
    asOfResult.customerId === selectedCustomerId
    && asOfResult.asOf === asOfDate
      ? asOfResult.item
      : undefined;
  const asOfError =
    asOfErrorState.customerId === selectedCustomerId
    && asOfErrorState.asOf === asOfDate
      ? asOfErrorState.message
      : "";
  const isLoadingChanges =
    selectedCustomerId !== undefined
    && loadingChangesCustomerId === selectedCustomerId;
  const isLoadingAsOf =
    selectedCustomerId !== undefined
    && loadingAsOfKey?.customerId === selectedCustomerId
    && loadingAsOfKey?.asOf === asOfDate;
  const businessDate = getBusinessDate();
  const currentEffectiveFrom = findCurrentEffectiveFrom(changes, businessDate);

  const changeAsOfDate = (nextAsOfDate: string) => {
    asOfDateRef.current = nextAsOfDate;
    setAsOfDate(nextAsOfDate);
  };

  const loadCustomers = async (
    params = buildSearchParams(customerCode, name),
    options: CustomerLoadOptions = {},
  ) => loadCustomerItems(() => fetchCustomers(params), options);

  const loadChanges = async (customerId: number) => {
    const requestId = changesRequestIdRef.current + 1;
    changesRequestIdRef.current = requestId;
    setLoadingChangesCustomerId(customerId);

    try {
      const nextChanges = await fetchCustomerChanges(customerId);
      if (
        changesRequestIdRef.current === requestId
        && selectedCustomerIdRef.current === customerId
      ) {
        setChangesResult({ customerId, items: nextChanges });
      }
    } catch (error) {
      if (
        changesRequestIdRef.current === requestId
        && selectedCustomerIdRef.current === customerId
      ) {
        setListError(formatApiError(error));
        setChangesResult({ customerId, items: [] });
      }
    } finally {
      if (changesRequestIdRef.current === requestId) {
        setLoadingChangesCustomerId(undefined);
      }
    }
  };

  const loadAsOf = async (customerId: number, targetAsOf: string) => {
    const requestId = asOfRequestIdRef.current + 1;
    asOfRequestIdRef.current = requestId;
    setLoadingAsOfKey({ customerId, asOf: targetAsOf });
    setAsOfErrorState({ message: "" });

    try {
      const nextAsOf = await fetchCustomerAsOf(customerId, targetAsOf);
      if (
        asOfRequestIdRef.current === requestId
        && selectedCustomerIdRef.current === customerId
        && asOfDateRef.current === targetAsOf
      ) {
        setAsOfResult({ customerId, asOf: targetAsOf, item: nextAsOf });
      }
    } catch (error) {
      if (
        asOfRequestIdRef.current === requestId
        && selectedCustomerIdRef.current === customerId
        && asOfDateRef.current === targetAsOf
      ) {
        setAsOfResult({ customerId, asOf: targetAsOf });
        setAsOfErrorState({
          customerId,
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
    const timer = window.setTimeout(() => void loadCustomers({}), 0);
    return () => window.clearTimeout(timer);
    // 初回表示だけで一覧を取得する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCustomerId === undefined) {
      changeForm.reset(defaultChangeValues());
      return;
    }

    const customer = customers.find(
      (item) => item.customerId === selectedCustomerId,
    );
    changeForm.reset(defaultChangeValues(customer));
    const timer = window.setTimeout(() => {
      void loadChanges(selectedCustomerId);
      void loadAsOf(selectedCustomerId, asOfDate);
    }, 0);
    return () => window.clearTimeout(timer);
    // 選択得意先の変更に合わせて変更フォームと指定日参照を更新する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId]);

  const changeAuthMode = (mode: DummyAuthMode) => {
    setDummyAuthMode(mode);
    setAuthMode(mode);
    setSuccessMessage("");
    void loadCustomers();
  };

  const searchCustomers = () => {
    setSuccessMessage("");
    void loadCustomers(buildSearchParams(customerCode, name));
  };

  const submitCustomer = async (values: CustomerFormValues) => {
    setFormError("");
    setSuccessMessage("");

    try {
      const created = await createCustomer(values);
      customerForm.reset(defaultCustomerValues());
      setSuccessMessage("得意先を登録し、一覧を更新しました。");
      setCustomerCode("");
      setName("");
      const loadResult = await loadCustomers({});
      if (!loadResult.ok) {
        setSuccessMessage("得意先を登録しました。一覧の再読込に失敗しました。");
        return;
      }

      const nextCustomers = loadResult.items;
      if (
        isEffectiveOnOrBeforeToday(created.effectiveFrom)
        && !nextCustomers.some((customer) => customer.customerId === created.customerId)
      ) {
        replaceCustomers([created, ...nextCustomers], {
          preferredSelectedId: created.customerId,
        });
        return;
      }

      if (nextCustomers.some((customer) => customer.customerId === created.customerId)) {
        setSelectedCustomer(created.customerId);
      }
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, customerForm);
    }
  };

  const submitChange = async (values: CustomerChangeFormValues) => {
    if (!selectedCustomer) {
      setFormError("情報を変更する得意先を一覧から選択してください。");
      return;
    }

    setFormError("");
    setSuccessMessage("");

    try {
      await changeCustomer(selectedCustomer.customerId, values);
      const loadResult = await loadCustomers(
        buildSearchParams(customerCode, name),
        { preserveSelectionOnError: true },
      );
      setSuccessMessage(
        loadResult.ok
          ? "得意先情報を変更し、一覧と変更履歴を更新しました。"
          : "得意先情報を変更しました。一覧の再読込に失敗しました。",
      );
      await loadChanges(selectedCustomer.customerId);
      await loadAsOf(selectedCustomer.customerId, asOfDate);
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, changeForm);
    }
  };

  const submitAsOf = () => {
    if (!selectedCustomer) {
      setAsOfErrorState({
        customerId: undefined,
        asOf: asOfDate,
        message: "参照する得意先を一覧から選択してください。",
      });
      return;
    }

    void loadAsOf(selectedCustomer.customerId, asOfDate);
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
            <span className="text-slate-700">得意先マスタ</span>
          </nav>
          <h1 className="mt-1.5">得意先マスタ</h1>
          <p>
            得意先の現在情報と変更履歴を確認し、指定日から得意先情報を変更します。
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
                  <span>得意先コード</span>
                  <Input
                    className="h-8 text-xs"
                    value={customerCode}
                    onChange={(event) => setCustomerCode(event.target.value)}
                  />
                </label>
                <label className="search-field">
                  <span>得意先名</span>
                  <Input
                    className="h-8 text-xs"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <div className="search-actions">
                  <Button className="h-8 px-2 text-xs" onClick={searchCustomers}>
                    <Search aria-hidden="true" className="size-4" />
                    検索
                  </Button>
                  <Button
                    className="h-8 px-2 text-xs"
                    onClick={() => void loadCustomers()}
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
                <h2 id="list-heading">得意先一覧</h2>
                <p>一覧は本日時点で適用される得意先情報を表示します。</p>
              </div>
              <Badge tone="neutral">{customers.length} 件</Badge>
            </div>
            {customers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table text-left">
                  <thead>
                    <tr>
                      <th>得意先コード</th>
                      <th>得意先名</th>
                      <th>住所</th>
                      <th>電話番号</th>
                      <th>適用開始日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        className={cn(
                          "cursor-pointer hover:bg-slate-50",
                          selectedCustomerId === customer.customerId
                            && "data-table-row-selected",
                        )}
                        key={customer.customerId}
                        onClick={() => setSelectedCustomer(customer.customerId)}
                      >
                        <td className="font-mono text-slate-700">
                          {customer.customerCode}
                        </td>
                        <td className="font-semibold">{customer.name}</td>
                        <td>{customer.address}</td>
                        <td className="font-mono">{customer.phoneNumber}</td>
                        <td>{formatDate(customer.effectiveFrom)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {isLoadingCustomers ? (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                読み込み中
              </p>
            ) : null}
            {!isLoadingCustomers && customers.length === 0 ? (
              <div className="result-empty-state">
                <p>該当データなし</p>
                <span>検索条件を変更するか、新しい得意先を登録してください。</span>
              </div>
            ) : null}
          </section>

          <section className="surface selected-summary" aria-labelledby="detail-heading">
            <div className="selected-summary-heading">
              <h2 id="detail-heading">選択中の得意先</h2>
            </div>
            {selectedCustomer ? (
              <dl className="selected-summary-list">
                <dt>得意先コード</dt>
                <dd className="font-mono">{selectedCustomer.customerCode}</dd>
                <dt>得意先名</dt>
                <dd>{selectedCustomer.name}</dd>
                <dt>住所</dt>
                <dd>{selectedCustomer.address}</dd>
                <dt>電話番号</dt>
                <dd className="font-mono">{selectedCustomer.phoneNumber}</dd>
                <dt>適用開始日</dt>
                <dd>{formatDate(selectedCustomer.effectiveFrom)}</dd>
              </dl>
            ) : (
              <div className="selected-empty">
                <p>未選択</p>
                <span>得意先一覧から行を選択すると現在の得意先情報を表示します。</span>
              </div>
            )}
            {selectedCustomer ? (
              <Link
                className="selected-summary-link"
                href={`/customer-product-prices?customerId=${selectedCustomer.customerId}`}
              >
                得意先別商品単価でこの得意先を確認
              </Link>
            ) : null}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="surface section-pad" aria-labelledby="create-heading">
            <div className="section-heading">
              <h2 id="create-heading">得意先新規登録</h2>
              <p>得意先本体と初回の得意先情報を同時に登録します。</p>
            </div>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                void customerForm.handleSubmit(submitCustomer)(event);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold">
                  得意先コード
                  <Input
                    hasError={Boolean(customerForm.formState.errors.customerCode)}
                    {...customerForm.register("customerCode")}
                  />
                  <FieldError
                    message={customerForm.formState.errors.customerCode?.message}
                  />
                </label>
                <CustomerChangeFields form={customerForm} />
              </div>
              <Button disabled={customerForm.formState.isSubmitting} type="submit">
                {customerForm.formState.isSubmitting ? (
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
              <h2 id="change-heading">得意先情報変更</h2>
              <p>
                {selectedCustomer
                  ? `${selectedCustomer.customerCode} の情報を指定日から変更します。`
                  : "得意先一覧から得意先を選択すると情報を変更できます。"}
              </p>
            </div>
            {selectedCustomer ? (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  void changeForm.handleSubmit(submitChange)(event);
                }}
              >
                <fieldset
                  className="grid gap-4 sm:grid-cols-2"
                  disabled={!selectedCustomer || changeForm.formState.isSubmitting}
                >
                  <CustomerChangeFields form={changeForm} />
                </fieldset>
                <Button
                  disabled={!selectedCustomer || changeForm.formState.isSubmitting}
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
                <p>得意先未選択</p>
                <span>一覧で対象得意先を選択してから情報を変更します。</span>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section className="surface section-pad" aria-labelledby="asof-heading">
            <div className="section-heading">
              <h2 id="asof-heading">指定日時点の得意先情報</h2>
              <p>対象日以前で一番新しい得意先情報を確認します。</p>
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
                disabled={!selectedCustomer || isLoadingAsOf}
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
              {asOfCustomer ? (
                <dl className="selected-summary-list">
                  <dt>得意先名</dt>
                  <dd>{asOfCustomer.name}</dd>
                  <dt>住所</dt>
                  <dd>{asOfCustomer.address}</dd>
                  <dt>電話番号</dt>
                  <dd className="font-mono">{asOfCustomer.phoneNumber}</dd>
                  <dt>適用開始日</dt>
                  <dd>{formatDate(asOfCustomer.effectiveFrom)}</dd>
                </dl>
              ) : (
                <div className="selected-empty">
                  <p>参照結果なし</p>
                  <span>得意先と参照日を指定して確認します。</span>
                </div>
              )}
            </div>
          </section>

          <section className="surface section-pad" aria-labelledby="history-heading">
            <div className="section-heading">
              <h2 id="history-heading">変更履歴</h2>
              <p>
                同じ得意先の変更を適用開始日の新しい順で表示します。将来適用予定も含みます。
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
                    <th>得意先名</th>
                    <th>住所</th>
                    <th>電話番号</th>
                    <th>適用開始日</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={buildCustomerChangeKey(change)}>
                      <td>
                        <ChangeTimingBadge
                          timing={classifyCustomerChange(
                            change,
                            businessDate,
                            currentEffectiveFrom,
                          )}
                        />
                      </td>
                      <td className="font-semibold">{change.name}</td>
                      <td>{change.address}</td>
                      <td className="font-mono">{change.phoneNumber}</td>
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

function CustomerChangeFields<T extends CustomerChangeFormValues>({
  form,
}: {
  readonly form: UseFormReturn<T>;
}) {
  const errors = form.formState.errors;
  const namePath = "name" as Path<T>;
  const addressPath = "address" as Path<T>;
  const phoneNumberPath = "phoneNumber" as Path<T>;
  const effectiveFromPath = "effectiveFrom" as Path<T>;

  return (
    <>
      <label className="grid gap-1.5 text-sm font-semibold">
        得意先名
        <Input hasError={Boolean(errors.name)} {...form.register(namePath)} />
        <FieldError message={errorMessage(errors.name?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        住所
        <Input hasError={Boolean(errors.address)} {...form.register(addressPath)} />
        <FieldError message={errorMessage(errors.address?.message)} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        電話番号
        <Input
          hasError={Boolean(errors.phoneNumber)}
          inputMode="tel"
          {...form.register(phoneNumberPath)}
        />
        <FieldError message={errorMessage(errors.phoneNumber?.message)} />
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
    </>
  );
}
