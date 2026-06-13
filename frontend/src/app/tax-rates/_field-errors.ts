export const toTaxRateFormFieldName = (apiField: string): string => {
  const normalized =
    apiField.length > 0
      ? apiField[0].toLowerCase() + apiField.slice(1)
      : apiField;

  if (normalized === "rate") {
    return "ratePercent";
  }

  return normalized;
};
