export interface StructuredAddress {
  formattedAddress: string;
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
}

export function createEmptyStructuredAddress(): StructuredAddress {
  return {
    formattedAddress: "",
    streetAddress: "",
    suburb: "",
    state: "",
    postcode: "",
    country: "",
  };
}

export function formatStructuredAddress(address: StructuredAddress) {
  if (address.formattedAddress.trim()) {
    return address.formattedAddress.trim();
  }

  const localityLine = [address.suburb, address.state, address.postcode]
    .filter(Boolean)
    .join(" ");

  return [address.streetAddress, localityLine, address.country]
    .filter(Boolean)
    .join(", ")
    .trim();
}

export function hasStructuredAddressParts(address: StructuredAddress) {
  return Boolean(
    address.streetAddress ||
      address.suburb ||
      address.state ||
      address.postcode ||
      address.country,
  );
}
