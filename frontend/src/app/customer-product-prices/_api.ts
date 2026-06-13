import { apiFetch } from "@/lib/api";
import { fetchProductAsOf } from "@/app/products/_api";
import {
  customerProductPriceChangesResponseSchema,
  customerProductPriceListResponseSchema,
  customerProductPricePreviewResponseSchema,
  customerProductPriceResponseSchema,
} from "./_schemas";
import type {
  CustomerProductPriceChange,
  CustomerProductPriceChangeFormValues,
  CustomerProductPriceFormValues,
  CustomerProductPricePreviewComposed,
  CustomerProductPriceSearchParams,
  CustomerProductPriceSummary,
} from "./_types";

const buildQuery = (params: CustomerProductPriceSearchParams) => {
  const query = new URLSearchParams();

  if (params.customerId !== undefined) {
    query.set("customerId", String(params.customerId));
  }

  if (params.productId !== undefined) {
    query.set("productId", String(params.productId));
  }

  if (params.customerCode) {
    query.set("customerCode", params.customerCode);
  }

  if (params.productCode) {
    query.set("productCode", params.productCode);
  }

  if (params.asOf) {
    query.set("asOf", params.asOf);
  }

  const text = query.toString();
  return text.length > 0 ? `?${text}` : "";
};

const toCreateRequest = (values: CustomerProductPriceFormValues) => ({
  customerId: Number(values.customerId),
  productId: Number(values.productId),
  unitPrice: Number(values.unitPrice),
  effectiveFrom: values.effectiveFrom,
});

const toChangeRequest = (values: CustomerProductPriceChangeFormValues) => ({
  unitPrice: Number(values.unitPrice),
  effectiveFrom: values.effectiveFrom,
});

export const fetchCustomerProductPrices = async (
  params: CustomerProductPriceSearchParams = {},
): Promise<CustomerProductPriceSummary[]> =>
  customerProductPriceListResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/customer-product-prices${buildQuery(params)}`,
    ),
  );

export const fetchCustomerProductPriceChanges = async (
  customerId: number,
  productId: number,
): Promise<CustomerProductPriceChange[]> =>
  customerProductPriceChangesResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/customer-product-prices/${customerId}/${productId}/changes`,
    ),
  );

export const fetchCustomerProductPriceAsOf = async (
  customerId: number,
  productId: number,
  asOf: string,
): Promise<CustomerProductPriceSummary> =>
  customerProductPriceResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/customer-product-prices/${customerId}/${productId}?asOf=${encodeURIComponent(asOf)}`,
    ),
  );

export const createCustomerProductPrice = async (
  values: CustomerProductPriceFormValues,
): Promise<CustomerProductPriceSummary> =>
  customerProductPriceResponseSchema.parse(
    await apiFetch<unknown>("/api/customer-product-prices", {
      method: "POST",
      body: toCreateRequest(values),
    }),
  );

export const changeCustomerProductPrice = async (
  customerId: number,
  productId: number,
  values: CustomerProductPriceChangeFormValues,
): Promise<CustomerProductPriceSummary> =>
  customerProductPriceResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/customer-product-prices/${customerId}/${productId}/changes`,
      {
        method: "POST",
        body: toChangeRequest(values),
      },
    ),
  );

export const fetchCustomerProductPricePreviewComposed = async (
  customerId: number,
  productId: number,
  asOf: string,
): Promise<CustomerProductPricePreviewComposed> => {
  const preview = customerProductPricePreviewResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/customer-product-prices/preview?customerId=${customerId}&productId=${productId}&asOf=${encodeURIComponent(asOf)}`,
    ),
  );

  const product = await fetchProductAsOf(productId, asOf);

  let customerProductPriceEffectiveFrom: string | null = null;
  if (preview.unitPriceSource === "CUSTOMER_PRODUCT_PRICE") {
    const priceDetail = await fetchCustomerProductPriceAsOf(
      customerId,
      productId,
      asOf,
    );
    customerProductPriceEffectiveFrom = priceDetail.effectiveFrom;
  }

  return {
    ...preview,
    customerProductPriceEffectiveFrom,
    productEffectiveFrom: product.effectiveFrom,
  };
};
