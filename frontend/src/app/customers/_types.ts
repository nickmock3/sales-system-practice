export type CustomerSummary = {
  readonly customerId: number;
  readonly customerCode: string;
  readonly name: string;
  readonly address: string;
  readonly phoneNumber: string;
  readonly effectiveFrom: string;
};

export type CustomerChange = {
  readonly effectiveFrom: string;
  readonly name: string;
  readonly address: string;
  readonly phoneNumber: string;
};

export type CustomerSearchParams = {
  readonly customerCode?: string;
  readonly name?: string;
};

export type CustomerFormValues = {
  readonly customerCode: string;
  readonly name: string;
  readonly address: string;
  readonly phoneNumber: string;
  readonly effectiveFrom: string;
};

export type CustomerChangeFormValues = Omit<CustomerFormValues, "customerCode">;
