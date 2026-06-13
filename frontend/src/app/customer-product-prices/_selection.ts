export type CombinationKey = `${number}:${number}`;

export const toCombinationKey = (
  customerId: number,
  productId: number,
): CombinationKey => `${customerId}:${productId}`;

export const parseCombinationKey = (
  key: string,
): { readonly customerId: number; readonly productId: number } | undefined => {
  const [customerPart, productPart] = key.split(":");
  const customerId = Number(customerPart);
  const productId = Number(productPart);

  if (
    !Number.isInteger(customerId)
    || customerId <= 0
    || !Number.isInteger(productId)
    || productId <= 0
  ) {
    return undefined;
  }

  return { customerId, productId };
};

export const parsePositiveIntParam = (
  value: string | null,
): number | undefined => {
  if (value === null || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};
