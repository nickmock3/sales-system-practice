import { apiFetch } from "@/lib/api";
import {
  customerChangesResponseSchema,
  customerListResponseSchema,
  customerResponseSchema,
} from "./_schemas";
import type {
  CustomerChange,
  CustomerChangeFormValues,
  CustomerFormValues,
  CustomerSearchParams,
  CustomerSummary,
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
  effectiveFrom: values.effectiveFrom,
});

const toChangeCustomerRequest = (values: CustomerChangeFormValues) => ({
  name: values.name.trim(),
  address: values.address.trim(),
  phoneNumber: values.phoneNumber.trim(),
  effectiveFrom: values.effectiveFrom,
});

export const fetchCustomers = async (
  params: CustomerSearchParams,
): Promise<CustomerSummary[]> =>
  customerListResponseSchema.parse(
    await apiFetch<unknown>(`/api/customers${buildQuery(params)}`),
  );

export const fetchCustomerChanges = async (
  customerId: number,
): Promise<CustomerChange[]> =>
  customerChangesResponseSchema.parse(
    await apiFetch<unknown>(`/api/customers/${customerId}/changes`),
  );

export const fetchCustomerAsOf = async (
  customerId: number,
  asOf: string,
): Promise<CustomerSummary> =>
  customerResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/customers/${customerId}?asOf=${encodeURIComponent(asOf)}`,
    ),
  );

export const createCustomer = async (
  values: CustomerFormValues,
): Promise<CustomerSummary> =>
  customerResponseSchema.parse(
    await apiFetch<unknown>("/api/customers", {
      method: "POST",
      body: toCreateCustomerRequest(values),
    }),
  );

export const changeCustomer = async (
  customerId: number,
  values: CustomerChangeFormValues,
): Promise<CustomerSummary> =>
  customerResponseSchema.parse(
    await apiFetch<unknown>(`/api/customers/${customerId}/changes`, {
      method: "POST",
      body: toChangeCustomerRequest(values),
    }),
  );
