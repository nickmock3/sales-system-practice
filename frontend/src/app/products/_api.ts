import { apiFetch } from "@/lib/api";
import {
  productChangesResponseSchema,
  productListResponseSchema,
  productResponseSchema,
} from "./_schemas";
import type {
  ProductChange,
  ProductChangeFormValues,
  ProductFormValues,
  ProductSearchParams,
  ProductSummary,
} from "./_types";

const buildQuery = (params: ProductSearchParams) => {
  const query = new URLSearchParams();

  if (params.productCode) {
    query.set("productCode", params.productCode);
  }

  if (params.name) {
    query.set("name", params.name);
  }

  if (params.isDiscontinued !== undefined) {
    query.set("isDiscontinued", String(params.isDiscontinued));
  }

  const text = query.toString();
  return text.length > 0 ? `?${text}` : "";
};

const toCreateProductRequest = (values: ProductFormValues) => ({
  productCode: values.productCode.trim(),
  name: values.name.trim(),
  unit: values.unit.trim(),
  standardUnitPrice: Number(values.standardUnitPrice),
  taxCategory: values.taxCategory,
  isDiscontinued: values.isDiscontinued,
  effectiveFrom: values.effectiveFrom,
});

const toChangeProductRequest = (values: ProductChangeFormValues) => ({
  name: values.name.trim(),
  unit: values.unit.trim(),
  standardUnitPrice: Number(values.standardUnitPrice),
  taxCategory: values.taxCategory,
  isDiscontinued: values.isDiscontinued,
  effectiveFrom: values.effectiveFrom,
});

export const fetchProducts = async (
  params: ProductSearchParams,
): Promise<ProductSummary[]> =>
  productListResponseSchema.parse(
    await apiFetch<unknown>(`/api/products${buildQuery(params)}`),
  );

export const fetchProductChanges = async (
  productId: number,
): Promise<ProductChange[]> =>
  productChangesResponseSchema.parse(
    await apiFetch<unknown>(`/api/products/${productId}/changes`),
  );

export const fetchProductAsOf = async (
  productId: number,
  asOf: string,
): Promise<ProductSummary> =>
  productResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/products/${productId}?asOf=${encodeURIComponent(asOf)}`,
    ),
  );

export const createProduct = async (
  values: ProductFormValues,
): Promise<ProductSummary> =>
  productResponseSchema.parse(
    await apiFetch<unknown>("/api/products", {
      method: "POST",
      body: toCreateProductRequest(values),
    }),
  );

export const changeProduct = async (
  productId: number,
  values: ProductChangeFormValues,
): Promise<ProductSummary> =>
  productResponseSchema.parse(
    await apiFetch<unknown>(`/api/products/${productId}/changes`, {
      method: "POST",
      body: toChangeProductRequest(values),
    }),
  );
