// Pure helpers for translating Google Places `addressComponents[]` into the
// app's StructuredAddress shape. Lives in its own module so the parsing
// rules can be unit-tested without spinning up Google Maps.

import {
  createEmptyStructuredAddress,
  formatStructuredAddress,
  type StructuredAddress,
} from "./address";

export interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface GooglePlacePayload {
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
}

export function getAddressComponent(
  components: GoogleAddressComponent[],
  types: string[],
): GoogleAddressComponent | undefined {
  return components.find((component) =>
    types.some((type) => component.types?.includes(type)),
  );
}

export function joinStreetAddress(components: GoogleAddressComponent[]) {
  const subpremise = getAddressComponent(components, ["subpremise"])?.longText ?? "";
  const streetNumber = getAddressComponent(components, ["street_number"])?.longText ?? "";
  const route = getAddressComponent(components, ["route"])?.longText ?? "";
  const premise = getAddressComponent(components, ["premise"])?.longText ?? "";
  const buildingNumber =
    subpremise && streetNumber
      ? `${subpremise}/${streetNumber}`
      : streetNumber || subpremise || premise;

  return [buildingNumber, route].filter(Boolean).join(" ").trim() || premise.trim();
}

export function mapPlaceToStructuredAddress(
  place: GooglePlacePayload,
  fallbackLabel: string,
): StructuredAddress {
  const components = place.addressComponents ?? [];
  const suburb =
    getAddressComponent(components, [
      "locality",
      "postal_town",
      "sublocality_level_1",
      "sublocality",
      "administrative_area_level_2",
    ])?.longText ?? "";
  const state =
    getAddressComponent(components, ["administrative_area_level_1"])?.shortText ??
    getAddressComponent(components, ["administrative_area_level_1"])?.longText ??
    "";
  const postcode = getAddressComponent(components, ["postal_code"])?.longText ?? "";
  const country = getAddressComponent(components, ["country"])?.longText ?? "";
  const unitNumber = getAddressComponent(components, ["subpremise"])?.longText ?? "";
  const streetAddress = joinStreetAddress(components);

  const structuredAddress: StructuredAddress = {
    ...createEmptyStructuredAddress(),
    formattedAddress: place.formattedAddress?.trim() || fallbackLabel,
    unitNumber,
    streetAddress,
    suburb,
    state,
    postcode,
    country,
  };

  return {
    ...structuredAddress,
    formattedAddress:
      structuredAddress.formattedAddress || formatStructuredAddress(structuredAddress),
  };
}
