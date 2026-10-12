/** Authorized fee choices for each quote; not a fixed property of the doctor. */
export const quoteMedicalFeeOptions = [
  0,
  ...Array.from({ length: 58 }, (_, index) => 15 + index * 5),
] as const;
