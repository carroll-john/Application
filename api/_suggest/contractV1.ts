/**
 * Suggest — Contract v1 (machine-checkable mirror).
 *
 * Prose contract: docs/contracts/suggest.v1.md
 * Conformance test: api/_suggest/contractV1.test.ts
 */

export const SUGGEST_CONTRACT_VERSION = "v1" as const;

export const SUGGEST_AUTH_SCHEME = "Bearer" as const;

export const SUGGEST_INSTITUTION_SUGGEST_PATH = "/v1/institutions/suggest" as const;
export const SUGGEST_ADDRESS_SUGGEST_PATH = "/v1/addresses/suggest" as const;
export const SUGGEST_ADDRESS_RESOLVE_PATH = "/v1/addresses/resolve" as const;

export const SUGGEST_INSTITUTION_RESPONSE_FIELDS_V1 = ["suggestions"] as const;
export const SUGGEST_ADDRESS_SUGGEST_RESPONSE_FIELDS_V1 = ["suggestions"] as const;
export const SUGGEST_ADDRESS_RESOLVE_RESPONSE_FIELDS_V1 = ["address"] as const;

export const SUGGEST_INSTITUTION_SUGGESTION_FIELDS_V1 = [
  "id",
  "label",
  "value",
  "countryCode",
] as const;

export const SUGGEST_ADDRESS_SUGGESTION_FIELDS_V1 = [
  "id",
  "label",
  "value",
  "placeId",
] as const;

export const SUGGEST_STRUCTURED_ADDRESS_FIELDS_V1 = [
  "formattedAddress",
  "unitNumber",
  "streetAddress",
  "suburb",
  "state",
  "postcode",
  "country",
] as const;

export interface StructuredAddressV1 {
  formattedAddress: string;
  unitNumber: string;
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
}

export interface InstitutionSuggestionV1 {
  id: string;
  label: string;
  value: string;
  countryCode?: string;
  detail?: string;
}

export interface AddressSuggestionV1 {
  id: string;
  label: string;
  value: string;
  placeId?: string;
}

export function isStructuredAddressV1(value: unknown): value is StructuredAddressV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  return SUGGEST_STRUCTURED_ADDRESS_FIELDS_V1.every(
    (field) => typeof (value as Record<string, unknown>)[field] === "string",
  );
}

export function isInstitutionSuggestionV1(value: unknown): value is InstitutionSuggestionV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.value === "string" &&
    (record.countryCode === undefined || typeof record.countryCode === "string")
  );
}

export function isAddressSuggestionV1(value: unknown): value is AddressSuggestionV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.value === "string" &&
    (record.placeId === undefined || typeof record.placeId === "string")
  );
}

export function hasInstitutionSuggestResponseV1(
  value: unknown,
): value is { suggestions: InstitutionSuggestionV1[] } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const suggestions = (value as { suggestions?: unknown }).suggestions;
  return Array.isArray(suggestions) && suggestions.every(isInstitutionSuggestionV1);
}

export function hasAddressSuggestResponseV1(
  value: unknown,
): value is { suggestions: AddressSuggestionV1[] } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const suggestions = (value as { suggestions?: unknown }).suggestions;
  return Array.isArray(suggestions) && suggestions.every(isAddressSuggestionV1);
}

export function hasAddressResolveResponseV1(
  value: unknown,
): value is { address: StructuredAddressV1 } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const address = (value as { address?: unknown }).address;
  return isStructuredAddressV1(address);
}
