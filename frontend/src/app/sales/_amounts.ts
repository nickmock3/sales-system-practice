export type SaleLineAmountInput = {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRate: number;
};

export type SaleLineAmounts = {
  readonly amount: number;
  readonly taxAmount: number;
  readonly totalWithTax: number;
};

export type SaleTotals = {
  readonly amountTotal: number;
  readonly taxAmountTotal: number;
  readonly totalAmount: number;
};

export const roundHalfAwayFromZero = (
  value: number,
  decimalPlaces: number,
): number => {
  if (!Number.isFinite(value)) {
    return value;
  }

  const factor = 10 ** decimalPlaces;
  const scaled = value * factor;
  const rounded =
    scaled >= 0
      ? Math.floor(scaled + 0.5 + Number.EPSILON)
      : Math.ceil(scaled - 0.5 - Number.EPSILON);

  return rounded / factor;
};

export const calculateLineAmount = (
  quantity: number,
  unitPrice: number,
): number => roundHalfAwayFromZero(quantity * unitPrice, 2);

export const calculateLineTaxAmount = (
  amount: number,
  taxRate: number,
): number => Math.floor(amount * taxRate + Number.EPSILON);

export const calculateLineTotalWithTax = (
  amount: number,
  taxAmount: number,
): number => roundHalfAwayFromZero(amount + taxAmount, 2);

export const calculateSaleLineAmounts = (
  input: SaleLineAmountInput,
): SaleLineAmounts => {
  const amount = calculateLineAmount(input.quantity, input.unitPrice);
  const taxAmount = calculateLineTaxAmount(amount, input.taxRate);
  const totalWithTax = calculateLineTotalWithTax(amount, taxAmount);

  return { amount, taxAmount, totalWithTax };
};

export const calculateSaleTotals = (
  lines: readonly SaleLineAmountInput[],
): SaleTotals => {
  const calculated = lines.map((line) => calculateSaleLineAmounts(line));

  return {
    amountTotal: roundHalfAwayFromZero(
      calculated.reduce((sum, line) => sum + line.amount, 0),
      2,
    ),
    taxAmountTotal: roundHalfAwayFromZero(
      calculated.reduce((sum, line) => sum + line.taxAmount, 0),
      2,
    ),
    totalAmount: roundHalfAwayFromZero(
      calculated.reduce((sum, line) => sum + line.totalWithTax, 0),
      2,
    ),
  };
};
