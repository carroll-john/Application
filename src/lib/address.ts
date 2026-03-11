export interface StructuredAddress {
  formattedAddress: string;
  unitNumber: string;
  streetAddress: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
}

export function createEmptyStructuredAddress(): StructuredAddress {
  return {
    formattedAddress: "",
    unitNumber: "",
    streetAddress: "",
    suburb: "",
    state: "",
    postcode: "",
    country: "",
  };
}

function formatUnitNumber(unitNumber: string) {
  const trimmedUnitNumber = unitNumber.trim();

  if (!trimmedUnitNumber) {
    return "";
  }

  if (/^(unit|apt|apartment|suite|room|level)\b/i.test(trimmedUnitNumber)) {
    return trimmedUnitNumber;
  }

  return `Unit ${trimmedUnitNumber}`;
}

function joinUnitAndAddress(unitNumber: string, addressLine: string) {
  const trimmedAddressLine = addressLine.trim();
  const formattedUnitNumber = formatUnitNumber(unitNumber);

  if (!formattedUnitNumber) {
    return trimmedAddressLine;
  }

  if (!trimmedAddressLine) {
    return formattedUnitNumber;
  }

  const normalizedAddressLine = trimmedAddressLine.toLowerCase();
  const normalizedUnitNumber = unitNumber.trim().toLowerCase();

  if (
    trimmedAddressLine.startsWith(`${unitNumber.trim()}/`) ||
    normalizedAddressLine.startsWith(`unit ${normalizedUnitNumber}`) ||
    normalizedAddressLine.startsWith(`apt ${normalizedUnitNumber}`) ||
    normalizedAddressLine.startsWith(`apartment ${normalizedUnitNumber}`) ||
    normalizedAddressLine.startsWith(`suite ${normalizedUnitNumber}`) ||
    normalizedAddressLine.startsWith(`room ${normalizedUnitNumber}`) ||
    normalizedAddressLine.startsWith(`level ${normalizedUnitNumber}`)
  ) {
    return trimmedAddressLine;
  }

  return `${formattedUnitNumber}, ${trimmedAddressLine}`;
}

export function formatStructuredAddress(address: StructuredAddress) {
  const localityLine = [address.suburb, address.state, address.postcode]
    .filter(Boolean)
    .join(" ");
  const streetLine = joinUnitAndAddress(address.unitNumber, address.streetAddress);
  const formattedAddress = joinUnitAndAddress(
    address.unitNumber,
    address.formattedAddress,
  );

  if (address.streetAddress || localityLine || address.country) {
    return [streetLine, localityLine, address.country].filter(Boolean).join(", ").trim();
  }

  return formattedAddress.trim();
}

export function hasStructuredAddressParts(address: StructuredAddress) {
  return Boolean(
    address.unitNumber ||
    address.streetAddress ||
      address.suburb ||
      address.state ||
      address.postcode ||
      address.country,
  );
}
