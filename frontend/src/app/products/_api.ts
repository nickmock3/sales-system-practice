import { apiFetch } from "@/lib/api";
import {
  productListResponseSchema,
  productResponseSchema,
} from "./_schemas";
import type {
  ProductFormValues,
  ProductListItem,
  ProductSearchParams,
  ProductVersion,
  ProductVersionFormValues,
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
  validFrom: values.validFrom,
});

const toCreateProductVersionRequest = (values: ProductVersionFormValues) => ({
  name: values.name.trim(),
  unit: values.unit.trim(),
  standardUnitPrice: Number(values.standardUnitPrice),
  taxCategory: values.taxCategory,
  isDiscontinued: values.isDiscontinued,
  validFrom: values.validFrom,
});

export const fetchProducts = async (
  params: ProductSearchParams,
): Promise<ProductListItem[]> =>
  productListResponseSchema.parse(
    await apiFetch<unknown>(`/api/products${buildQuery(params)}`),
  );

export const fetchProductVersions = async (
  productId: number,
): Promise<ProductVersion[]> =>
  productListResponseSchema.parse(
    await apiFetch<unknown>(`/api/products/${productId}/versions`),
  );

export const createProduct = async (
  values: ProductFormValues,
): Promise<ProductListItem> =>
  productResponseSchema.parse(
    await apiFetch<unknown>("/api/products", {
      method: "POST",
      body: toCreateProductRequest(values),
    }),
  );

export const createProductVersion = async (
  productId: number,
  values: ProductVersionFormValues,
): Promise<ProductVersion> =>
  productResponseSchema.parse(
    await apiFetch<unknown>(`/api/products/${productId}/versions`, {
      method: "POST",
      body: toCreateProductVersionRequest(values),
    }),
  );
