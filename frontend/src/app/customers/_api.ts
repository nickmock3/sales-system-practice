import { apiFetch } from "@/lib/api";
import {
  customerListResponseSchema,
  customerResponseSchema,
} from "./_schemas";
import type {
  CustomerFormValues,
  CustomerListItem,
  CustomerPreviewParams,
  CustomerSearchParams,
  CustomerVersion,
  CustomerVersionFormValues,
} from "./_types";

const buildQuery = (params: CustomerSearchParams) => {
  const query = new URLSearchParams();

  if (params.customerCode) {
    query.set("customerCode", params.customerCode);
  }

  if (params.name) {
    query.set("name", params.name);
  }

  const text = query.toString();
  return text.length > 0 ? `?${text}` : "";
};

const toCreateCustomerRequest = (values: CustomerFormValues) => ({
  customerCode: values.customerCode.trim(),
  name: values.name.trim(),
  address: values.address.trim(),
  phoneNumber: values.phoneNumber.trim(),
  validFrom: values.validFrom,
});

const toCreateCustomerVersionRequest = (
  values: CustomerVersionFormValues,
) => ({
  name: values.name.trim(),
  address: values.address.trim(),
  phoneNumber: values.phoneNumber.trim(),
  validFrom: values.validFrom,
});

export const fetchCustomers = async (
  params: CustomerSearchParams,
): Promise<CustomerListItem[]> =>
  customerListResponseSchema.parse(
    await apiFetch<unknown>(`/api/customers${buildQuery(params)}`),
  );

export const fetchCustomerVersions = async (
  customerId: number,
): Promise<CustomerVersion[]> =>
  customerListResponseSchema.parse(
    await apiFetch<unknown>(`/api/customers/${customerId}/versions`),
  );

export const previewCustomer = async ({
  customerId,
  targetDate,
}: CustomerPreviewParams): Promise<CustomerVersion> =>
  customerResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/customers/${customerId}/preview?targetDate=${encodeURIComponent(targetDate)}`,
    ),
  );

export const createCustomer = async (
  values: CustomerFormValues,
): Promise<CustomerListItem> =>
  customerResponseSchema.parse(
    await apiFetch<unknown>("/api/customers", {
      method: "POST",
      body: toCreateCustomerRequest(values),
    }),
  );

export const createCustomerVersion = async (
  customerId: number,
  values: CustomerVersionFormValues,
): Promise<CustomerVersion> =>
  customerResponseSchema.parse(
    await apiFetch<unknown>(`/api/customers/${customerId}/versions`, {
      method: "POST",
      body: toCreateCustomerVersionRequest(values),
    }),
  );
