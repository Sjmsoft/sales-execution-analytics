export const UNIT_TYPE_VALUES = {
  bottles: 1,
  cases: 2,
} as const;

export const PAYMENT_METHOD_VALUES = {
  cash: 1,
  bank_transfer: 2,
  pos: 3,
} as const;

export const PAYMENT_STATUS_VALUES = {
  unpaid: 0,
  partially_paid: 1,
  paid: 2,
} as const;