import { formatStructuredAddress, type StructuredAddress } from "./address";

export const REVIEW_VALIDATION_FLAG = "review:auto-validate";

export function getAddressReviewItems(
  label: string,
  address: StructuredAddress,
): [string, string][] {
  return [[label, formatStructuredAddress(address) || "Not provided"]];
}

export function setReviewValidationFlag() {
  window.sessionStorage.setItem(REVIEW_VALIDATION_FLAG, "1");
}

export function consumeReviewValidationFlag() {
  const shouldValidate =
    window.sessionStorage.getItem(REVIEW_VALIDATION_FLAG) === "1";
  if (shouldValidate) {
    window.sessionStorage.removeItem(REVIEW_VALIDATION_FLAG);
  }
  return shouldValidate;
}
