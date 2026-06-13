import { apiFetch } from "@/lib/api";
import {
  saleListResponseSchema,
  saleResponseSchema,
  salesLinePreviewResponseSchema,
} from "./_schemas";
import type {
  CreateSaleRequest,
  SaleListItem,
  SaleResponse,
  SaleSearchParams,
  SalesLinePreview,
} from "./_types";

const buildSalesQuery = (params: SaleSearchParams) => {
  const query = new URLSearchParams();

  if (params.salesDateFrom) {
    query.set("salesDateFrom", params.salesDateFrom);
  }

  if (params.salesDateTo) {
    query.set("salesDateTo", params.salesDateTo);
  }

  if (params.customerId !== undefined) {
    query.set("customerId", String(params.customerId));
  }

  if (params.customerCode) {
    query.set("customerCode", params.customerCode);
  }

  if (params.includeCanceled === true) {
    query.set("includeCanceled", "true");
  }

  if (params.includeCorrections === true) {
    query.set("includeCorrections", "true");
  }

  const text = query.toString();
  return text.length > 0 ? `?${text}` : "";
};

export const fetchSales = async (
  params: SaleSearchParams = {},
): Promise<SaleListItem[]> =>
  saleListResponseSchema.parse(
    await apiFetch<unknown>(`/api/sales${buildSalesQuery(params)}`),
  );

export const fetchSale = async (saleId: number): Promise<SaleResponse> =>
  saleResponseSchema.parse(
    await apiFetch<unknown>(`/api/sales/${saleId}`),
  );

export const fetchSalesLinePreview = async (
  salesDate: string,
  customerId: number,
  productId: number,
): Promise<SalesLinePreview> =>
  salesLinePreviewResponseSchema.parse(
    await apiFetch<unknown>(
      `/api/sales/line-preview?salesDate=${encodeURIComponent(salesDate)}&customerId=${customerId}&productId=${productId}`,
    ),
  );

export const createSale = async (
  request: CreateSaleRequest,
): Promise<SaleResponse> =>
  saleResponseSchema.parse(
    await apiFetch<unknown>("/api/sales", {
      method: "POST",
      body: request,
    }),
  );
