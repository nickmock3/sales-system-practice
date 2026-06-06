export type CustomerListItem = {
  readonly customerId: number;
  readonly customerCode: string;
  readonly customerVersionId: number;
  readonly name: string;
  readonly address: string;
  readonly phoneNumber: string;
  readonly validFrom: string;
};

export type CustomerVersion = CustomerListItem;

export type CustomerSearchParams = {
  readonly customerCode?: string;
  readonly name?: string;
};

export type CustomerPreviewParams = {
  readonly customerId: number;
  readonly targetDate: string;
};

export type CustomerFormValues = {
  readonly customerCode: string;
  readonly name: string;
  readonly address: string;
  readonly phoneNumber: string;
  readonly validFrom: string;
};

export type CustomerVersionFormValues = Omit<CustomerFormValues, "customerCode">;
