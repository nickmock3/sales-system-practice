export const toCustomerProductPriceFormFieldName = (
  apiField: string,
): string => {
  if (apiField.length === 0) {
    return apiField;
  }

  return apiField[0].toLowerCase() + apiField.slice(1);
};
