import { useMemo, useState } from "react";
import type { AddressSuggestion } from "../../components/ui/address-autocomplete";
import type { ContactDetails } from "../../lib/applicationData";
import {
  createEmptyStructuredAddress,
  hasStructuredAddressParts,
  type StructuredAddress,
} from "../../lib/address";
import { createAppAddressLookup } from "../../lib/suggestClient";

type AddressKey = "residentialAddress" | "postalAddress";

export function useSection1AddressForm(contactDetails: ContactDetails) {
  const [formData, setFormData] = useState({
    residentialAddress: contactDetails.residentialAddress,
    postalDifferent: contactDetails.postalDifferent,
    postalAddress: contactDetails.postalAddress,
  });
  const residentialLookup = useMemo(() => createAppAddressLookup(["au"]), []);
  const postalLookup = useMemo(() => createAppAddressLookup(["au"]), []);
  const unavailableLookupMessage =
    "Live address lookup is not configured in this environment. Keep typing to enter the address manually.";

  const updateManualAddress = (key: AddressKey, formattedAddress: string) => {
    setFormData((previous) => ({
      ...previous,
      [key]: {
        ...createEmptyStructuredAddress(),
        unitNumber: previous[key].unitNumber,
        formattedAddress,
      },
    }));
  };

  const updateUnitNumber = (key: AddressKey, unitNumber: string) => {
    setFormData((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        unitNumber,
      },
    }));
  };

  const applyResolvedAddress = async (
    key: AddressKey,
    suggestion: AddressSuggestion,
  ) => {
    const resolvedAddress = await suggestion.resolveAddress?.();

    if (!resolvedAddress) {
      return;
    }

    setFormData((previous) => {
      if (previous[key].formattedAddress !== suggestion.value) {
        return previous;
      }

      return {
        ...previous,
        [key]: {
          ...resolvedAddress,
          unitNumber: resolvedAddress.unitNumber || previous[key].unitNumber,
        },
      };
    });
  };

  const setPostalDifferent = (postalDifferent: boolean) => {
    setFormData((previous) => ({
      ...previous,
      postalDifferent,
    }));
  };

  return {
    applyResolvedAddress,
    formData,
    postalLookup,
    residentialLookup,
    setPostalDifferent,
    unavailableLookupMessage,
    updateManualAddress,
    updateUnitNumber,
    useAddressSearch: true,
  };
}

export function renderStructuredAddressMeta(address: StructuredAddress) {
  if (!hasStructuredAddressParts(address)) {
    return null;
  }

  const meta = [
    address.unitNumber && `Unit/apartment: ${address.unitNumber}`,
    address.suburb && `Suburb: ${address.suburb}`,
    address.state && `State: ${address.state}`,
    address.postcode && `Postcode: ${address.postcode}`,
  ]
    .filter(Boolean)
    .join("  ");

  return meta;
}
