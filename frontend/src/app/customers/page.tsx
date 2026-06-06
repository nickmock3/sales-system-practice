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
import { cn } from "@/lib/utils/cn";
import {
  createCustomer,
  createCustomerVersion,
  fetchCustomers,
  fetchCustomerVersions,
  previewCustomer,
} from "./_api";
import { customerFormSchema, customerVersionFormSchema } from "./_schemas";
import type {
  CustomerFormValues,
  CustomerListItem,
  CustomerSearchParams,
  CustomerVersion,
  CustomerVersionFormValues,
} from "./_types";

type CustomerVersionsResult = {
  readonly customerId?: number;
  readonly items: CustomerVersion[];
};

type CustomerPreviewResult = {
  readonly customerId?: number;
  readonly targetDate?: string;
  readonly item?: CustomerVersion;
};

type CustomerPreviewError = {
  readonly customerId?: number;
  readonly targetDate?: string;
  readonly message: string;
};

type CustomerLoadResult =
  | {
      readonly ok: true;
      readonly items: CustomerListItem[];
    }
  | {
      readonly ok: false;
    };

type CustomerLoadOptions = {
  readonly preserveSelectionOnError?: boolean;
};

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const isEffectiveToday = (validFrom: string) =>
  validFrom.slice(0, 10) <= today();

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
  validFrom: today(),
});

const defaultVersionValues = (
  customer?: CustomerListItem,
): CustomerVersionFormValues => ({
  name: customer?.name ?? "",
  address: customer?.address ?? "",
  phoneNumber: customer?.phoneNumber ?? "",
  validFrom: today(),
});

const authLabels: Record<DummyAuthMode, string> = {
  user: "一般ユーザー",
  admin: "管理者",
  logout: "ログアウト",
};

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
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const customersRequestIdRef = useRef(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>();
  const selectedCustomerIdRef = useRef<number>();
  const versionsRequestIdRef = useRef(0);
  const [versionsResult, setVersionsResult] = useState<CustomerVersionsResult>({
    items: [],
  });
  const [previewDate, setPreviewDate] = useState(today());
  const previewDateRef = useRef(previewDate);
  const previewRequestIdRef = useRef(0);
  const [previewResult, setPreviewResult] = useState<CustomerPreviewResult>({});
  const [listError, setListError] = useState("");
  const [formError, setFormError] = useState("");
  const [previewErrorState, setPreviewErrorState] =
    useState<CustomerPreviewError>({ message: "" });
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [loadingVersionsCustomerId, setLoadingVersionsCustomerId] =
    useState<number>();
  const [loadingPreviewKey, setLoadingPreviewKey] = useState<{
    readonly customerId: number;
    readonly targetDate: string;
  }>();

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultCustomerValues(),
  });

  const versionForm = useForm<CustomerVersionFormValues>({
    resolver: zodResolver(customerVersionFormSchema),
    defaultValues: defaultVersionValues(),
  });

  const selectedCustomer = customers.find(
    (customer) => customer.customerId === selectedCustomerId,
  );
  const versions =
    versionsResult.customerId === selectedCustomerId ? versionsResult.items : [];
  const preview =
    previewResult.customerId === selectedCustomerId
    && previewResult.targetDate === previewDate
      ? previewResult.item
      : undefined;
  const previewError =
    previewErrorState.customerId === selectedCustomerId
    && previewErrorState.targetDate === previewDate
      ? previewErrorState.message
      : "";
  const isLoadingVersions =
    selectedCustomerId !== undefined
    && loadingVersionsCustomerId === selectedCustomerId;
  const isLoadingPreview =
    selectedCustomerId !== undefined
    && loadingPreviewKey?.customerId === selectedCustomerId
    && loadingPreviewKey?.targetDate === previewDate;

  const clearSelectedCustomerState = () => {
    setVersionsResult({ items: [] });
    setPreviewResult({});
    setPreviewErrorState({ message: "" });
  };

  const setSelectedCustomer = (customerId: number | undefined) => {
    if (customerId === selectedCustomerIdRef.current) {
      return;
    }

    clearSelectedCustomerState();
    selectedCustomerIdRef.current = customerId;
    setSelectedCustomerId(customerId);
  };

  const changePreviewDate = (nextPreviewDate: string) => {
    previewDateRef.current = nextPreviewDate;
    setPreviewDate(nextPreviewDate);
  };

  const loadCustomers = async (
    params = buildSearchParams(customerCode, name),
    options: CustomerLoadOptions = {},
  ): Promise<CustomerLoadResult> => {
    const requestId = customersRequestIdRef.current + 1;
    customersRequestIdRef.current = requestId;
    setIsLoadingCustomers(true);
    setListError("");

    try {
      const nextCustomers = await fetchCustomers(params);
      if (customersRequestIdRef.current !== requestId) {
        return { ok: false };
      }

      setCustomers(nextCustomers);
      const current = selectedCustomerIdRef.current;
      const nextSelectedCustomerId = nextCustomers.some(
        (customer) => customer.customerId === current,
      )
        ? current
        : nextCustomers[0]?.customerId;
      setSelectedCustomer(nextSelectedCustomerId);
      return { ok: true, items: nextCustomers };
    } catch (error) {
      if (customersRequestIdRef.current !== requestId) {
        return { ok: false };
      }

      setListError(formatApiError(error));
      if (!options.preserveSelectionOnError) {
        setCustomers([]);
        setSelectedCustomer(undefined);
      }
      return { ok: false };
    } finally {
      if (customersRequestIdRef.current === requestId) {
        setIsLoadingCustomers(false);
      }
    }
  };

  const loadVersions = async (customerId: number) => {
    const requestId = versionsRequestIdRef.current + 1;
    versionsRequestIdRef.current = requestId;
    setLoadingVersionsCustomerId(customerId);

    try {
      const nextVersions = await fetchCustomerVersions(customerId);
      if (
        versionsRequestIdRef.current === requestId
        && selectedCustomerIdRef.current === customerId
      ) {
        setVersionsResult({ customerId, items: nextVersions });
      }
    } catch (error) {
      if (
        versionsRequestIdRef.current === requestId
        && selectedCustomerIdRef.current === customerId
      ) {
        setListError(formatApiError(error));
        setVersionsResult({ customerId, items: [] });
      }
    } finally {
      if (versionsRequestIdRef.current === requestId) {
        setLoadingVersionsCustomerId(undefined);
      }
    }
  };

  const loadPreview = async (customerId: number, targetDate: string) => {
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setLoadingPreviewKey({ customerId, targetDate });
    setPreviewErrorState({ message: "" });

    try {
      const nextPreview = await previewCustomer({ customerId, targetDate });
      if (
        previewRequestIdRef.current === requestId
        && selectedCustomerIdRef.current === customerId
        && previewDateRef.current === targetDate
      ) {
        setPreviewResult({ customerId, targetDate, item: nextPreview });
      }
    } catch (error) {
      if (
        previewRequestIdRef.current === requestId
        && selectedCustomerIdRef.current === customerId
        && previewDateRef.current === targetDate
      ) {
        setPreviewResult({ customerId, targetDate });
        setPreviewErrorState({
          customerId,
          targetDate,
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
    const timer = window.setTimeout(() => void loadCustomers({}), 0);
    return () => window.clearTimeout(timer);
    // 初回表示だけで一覧を取得する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCustomerId === undefined) {
      versionForm.reset(defaultVersionValues());
      return;
    }

    const customer = customers.find(
      (item) => item.customerId === selectedCustomerId,
    );
    versionForm.reset(defaultVersionValues(customer));
    const timer = window.setTimeout(() => {
      void loadVersions(selectedCustomerId);
      void loadPreview(selectedCustomerId, previewDate);
    }, 0);
    return () => window.clearTimeout(timer);
    // 選択得意先の変更に合わせて履歴フォームとプレビューを更新する。
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
        isEffectiveToday(created.validFrom)
        && !nextCustomers.some((customer) => customer.customerId === created.customerId)
      ) {
        setCustomers([created, ...nextCustomers]);
        setSelectedCustomer(created.customerId);
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

  const submitVersion = async (values: CustomerVersionFormValues) => {
    if (!selectedCustomer) {
      setFormError("履歴を追加する得意先を一覧から選択してください。");
      return;
    }

    setFormError("");
    setSuccessMessage("");

    try {
      await createCustomerVersion(selectedCustomer.customerId, values);
      const loadResult = await loadCustomers(
        buildSearchParams(customerCode, name),
        { preserveSelectionOnError: true },
      );
      setSuccessMessage(
        loadResult.ok
          ? "得意先履歴を追加し、一覧と履歴を更新しました。"
          : "得意先履歴を追加しました。一覧の再読込に失敗しました。",
      );
      await loadVersions(selectedCustomer.customerId);
      await loadPreview(selectedCustomer.customerId, previewDate);
    } catch (error) {
      setFormError(formatApiError(error));
      applyFieldErrors(error, versionForm);
    }
  };

  const submitPreview = () => {
    if (!selectedCustomer) {
      setPreviewErrorState({
        customerId: undefined,
        targetDate: previewDate,
        message: "プレビューする得意先を一覧から選択してください。",
      });
      return;
    }

    void loadPreview(selectedCustomer.customerId, previewDate);
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
            得意先の現在値と履歴を確認し、名称や連絡先の変更は新しい履歴として追加します。
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
                <p>一覧は本日時点で適用される得意先履歴の内容を表示します。</p>
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
                        <td>{formatDate(customer.validFrom)}</td>
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
              {selectedCustomer ? <Badge tone="success">現在履歴</Badge> : null}
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
                <dd>{formatDate(selectedCustomer.validFrom)}</dd>
                <dt>得意先ID</dt>
                <dd className="font-mono">{selectedCustomer.customerId}</dd>
              </dl>
            ) : (
              <div className="selected-empty">
                <p>未選択</p>
                <span>得意先一覧から行を選択すると現在値を表示します。</span>
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
              <p>得意先本体と初回の得意先履歴を同時に登録します。</p>
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
                <CustomerVersionFields form={customerForm} />
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

          <section className="surface section-pad" aria-labelledby="version-heading">
            <div className="section-heading">
              <h2 id="version-heading">得意先履歴追加</h2>
              <p>
                {selectedCustomer
                  ? `${selectedCustomer.customerCode} に新しい履歴を追加します。`
                  : "得意先一覧から得意先を選択すると履歴を追加できます。"}
              </p>
            </div>
            {selectedCustomer ? (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  void versionForm.handleSubmit(submitVersion)(event);
                }}
              >
                <fieldset
                  className="grid gap-4 sm:grid-cols-2"
                  disabled={!selectedCustomer || versionForm.formState.isSubmitting}
                >
                  <CustomerVersionFields form={versionForm} />
                </fieldset>
                <Button
                  disabled={!selectedCustomer || versionForm.formState.isSubmitting}
                  type="submit"
                >
                  {versionForm.formState.isSubmitting ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Plus aria-hidden="true" className="size-4" />
                  )}
                  履歴追加
                </Button>
              </form>
            ) : (
              <div className="form-empty-state">
                <p>得意先未選択</p>
                <span>一覧で対象得意先を選択してから履歴を追加します。</span>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section className="surface section-pad" aria-labelledby="preview-heading">
            <div className="section-heading">
              <h2 id="preview-heading">指定日プレビュー</h2>
              <p>対象日以前で一番新しい得意先履歴を確認します。</p>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">
                対象日
                <Input
                  type="date"
                  value={previewDate}
                  onChange={(event) => changePreviewDate(event.target.value)}
                />
              </label>
              <Button
                disabled={!selectedCustomer || isLoadingPreview}
                onClick={submitPreview}
                type="button"
                variant="secondary"
              >
                {isLoadingPreview ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Search aria-hidden="true" className="size-4" />
                )}
                プレビュー
              </Button>
              {preview ? (
                <dl className="selected-summary-list">
                  <dt>履歴ID</dt>
                  <dd className="font-mono">{preview.customerVersionId}</dd>
                  <dt>得意先名</dt>
                  <dd>{preview.name}</dd>
                  <dt>住所</dt>
                  <dd>{preview.address}</dd>
                  <dt>電話番号</dt>
                  <dd className="font-mono">{preview.phoneNumber}</dd>
                  <dt>適用開始日</dt>
                  <dd>{formatDate(preview.validFrom)}</dd>
                </dl>
              ) : (
                <div className="selected-empty">
                  <p>プレビューなし</p>
                  <span>得意先と対象日を指定して確認します。</span>
                </div>
              )}
            </div>
          </section>

          <section className="surface section-pad" aria-labelledby="history-heading">
            <div className="section-heading">
              <h2 id="history-heading">得意先履歴</h2>
              <p>
                同じ得意先 ID の履歴を適用開始日の新しい順で表示します。得意先別商品単価は別マスタで管理します。
              </p>
            </div>
            {isLoadingVersions ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                履歴を読み込み中
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="data-table text-left">
                <thead>
                  <tr>
                    <th>履歴ID</th>
                    <th>得意先名</th>
                    <th>住所</th>
                    <th>電話番号</th>
                    <th>適用開始日</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((version) => (
                    <tr key={version.customerVersionId}>
                      <td className="font-mono text-slate-700">
                        {version.customerVersionId}
                      </td>
                      <td className="font-semibold">{version.name}</td>
                      <td>{version.address}</td>
                      <td className="font-mono">{version.phoneNumber}</td>
                      <td>{formatDate(version.validFrom)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLoadingVersions && versions.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-slate-500">
                履歴データなし
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function CustomerVersionFields<T extends CustomerVersionFormValues>({
  form,
}: {
  readonly form: UseFormReturn<T>;
}) {
  const errors = form.formState.errors;
  const namePath = "name" as Path<T>;
  const addressPath = "address" as Path<T>;
  const phoneNumberPath = "phoneNumber" as Path<T>;
  const validFromPath = "validFrom" as Path<T>;

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
          hasError={Boolean(errors.validFrom)}
          type="date"
          {...form.register(validFromPath)}
        />
        <FieldError message={errorMessage(errors.validFrom?.message)} />
      </label>
    </>
  );
}
