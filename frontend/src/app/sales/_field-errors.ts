export const toSaleFormFieldName = (apiField: string): string => {
  const linesMatch = /^Lines\[(\d+)\]\.(.+)$/.exec(apiField);
  if (linesMatch) {
    const index = linesMatch[1];
    const field = linesMatch[2];
    const camelField =
      field.length > 0 ? field[0].toLowerCase() + field.slice(1) : field;
    return `lines.${index}.${camelField}`;
  }

  if (apiField.length === 0) {
    return apiField;
  }

  return apiField[0].toLowerCase() + apiField.slice(1);
};
