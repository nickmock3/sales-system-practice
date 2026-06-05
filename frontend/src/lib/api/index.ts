import { apiBaseUrl } from "@/lib/config";

export type ApiError = {
  readonly status: number;
  readonly message: string;
  readonly fieldErrors: Record<string, readonly string[]>;
};

export type DummyAuthMode = "user" | "admin" | "logout";

type ApiFetchOptions = Omit<RequestInit, "body" | "headers"> & {
  readonly body?: unknown;
  readonly headers?: HeadersInit;
};

const dummyAuthStorageKey = "sales-system-practice.dummy-auth";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const getDummyAuthMode = (): DummyAuthMode => {
  if (typeof window === "undefined") {
    return "admin";
  }

  const value = window.localStorage.getItem(dummyAuthStorageKey);
  return value === "user" || value === "admin" || value === "logout"
    ? value
    : "admin";
};

export const setDummyAuthMode = (mode: DummyAuthMode) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(dummyAuthStorageKey, mode);
  }
};

export const isApiError = (error: unknown): error is ApiError =>
  isRecord(error)
  && typeof error.status === "number"
  && typeof error.message === "string"
  && isRecord(error.fieldErrors);

export const formatApiError = (error: unknown): string => {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof TypeError) {
    return "バックエンド API と通信できません。API が起動しているか確認してください。";
  }

  return "予期しないエラーが発生しました。";
};

const buildDummyAuthHeaders = (): HeadersInit => {
  const mode = getDummyAuthMode();

  if (mode === "logout") {
    return {};
  }

  if (mode === "admin") {
    return {
      "X-Dummy-User": "admin1",
      "X-Dummy-Roles": "MasterMaintainer",
    };
  }

  return {
    "X-Dummy-User": "user1",
  };
};

const readErrorPayload = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
};

const readMessage = (payload: unknown, status: number): string => {
  if (isRecord(payload) && typeof payload.message === "string") {
    return payload.message;
  }

  if (status === 401) {
    return "ログアウト状態です。認証が必要です。";
  }

  if (status === 403) {
    return "現在のユーザーでは権限不足です。";
  }

  return "API エラーが発生しました。";
};

const readFieldErrors = (
  payload: unknown,
): Record<string, readonly string[]> => {
  if (!isRecord(payload) || !isRecord(payload.errors)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload.errors).flatMap(([key, value]) =>
      Array.isArray(value)
        ? [[key, value.filter((item): item is string => typeof item === "string")]]
        : [],
    ),
  );
};

export const apiFetch = async <T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> => {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...buildDummyAuthHeaders(),
    ...options.headers,
  });

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    throw {
      status: response.status,
      message: readMessage(payload, response.status),
      fieldErrors: readFieldErrors(payload),
    } satisfies ApiError;
  }

  return response.json() as Promise<T>;
};
