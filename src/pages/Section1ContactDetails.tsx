import { Home, Mailbox } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApplicationShell } from "../components/ApplicationShell";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "../components/ui/address-autocomplete";
import { Label } from "../components/ui/label";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import {
  createEmptyStructuredAddress,
  hasStructuredAddressParts,
  type StructuredAddress,
} from "../lib/address";
import {
  createGoogleAddressLookup,
  hasGooglePlacesApiKey,
} from "../lib/googlePlaces";

export default function Section1ContactDetails() {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();
  const { data, updateContactDetails } = useApplication();
  const [formData, setFormData] = useState({
    residentialAddress: data.contactDetails.residentialAddress,
    postalDifferent: data.contactDetails.postalDifferent,
    postalAddress: data.contactDetails.postalAddress,
  });
  const useGoogleAddressSearch = hasGooglePlacesApiKey();
  const residentialLookup = useMemo(() => createGoogleAddressLookup(), []);
  const postalLookup = useMemo(() => createGoogleAddressLookup(), []);
  const unavailableLookupMessage =
    "Live address lookup is not configured in this environment. Keep typing to enter the address manually.";

  const persist = () => updateContactDetails(formData);

  const updateManualAddress = (
    key: "residentialAddress" | "postalAddress",
    formattedAddress: string,
  ) => {
    setFormData((previous) => ({
      ...previous,
      [key]: {
        ...createEmptyStructuredAddress(),
        formattedAddress,
      },
    }));
  };

  const applyResolvedAddress = async (
    key: "residentialAddress" | "postalAddress",
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
        [key]: resolvedAddress,
      };
    });
  };

  const renderStructuredAddressMeta = (address: StructuredAddress) => {
    if (!hasStructuredAddressParts(address)) {
      return null;
    }

    const meta = [
      address.suburb && `Suburb: ${address.suburb}`,
      address.state && `State: ${address.state}`,
      address.postcode && `Postcode: ${address.postcode}`,
    ]
      .filter(Boolean)
      .join("  ");

    return meta ? (
      <p className="mt-2 text-xs text-slate-500">{meta}</p>
    ) : null;
  };

  return (
    <ApplicationShell
      sectionLabel="Section 1 of 3"
      progress={56}
      title="Address details"
      description="Tell us where you live and whether your postal address is different."
      onPrevious={() => {
        persist();
        navigate(returnPath("/section1/contact-info"));
      }}
      onSaveAndExit={
        fromReview
          ? undefined
          : () => {
              persist();
              navigate("/dashboard");
            }
      }
      onContinue={() => {
        persist();
        navigate(returnPath("/section1/cultural-background"));
      }}
      previousLabel={previousLabel}
      continueLabel={fromReview ? "Save & Return to Review" : "Continue"}
    >
      <div className="space-y-6">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Home className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Residential address
              </h2>
              <p className="text-sm text-slate-600">
                Use the address where you are currently living.
              </p>
            </div>
          </div>
          <Label htmlFor="residentialAddress">Permanent residential address *</Label>
          <AddressAutocomplete
            id="residentialAddress"
            searchSuggestions={
              useGoogleAddressSearch
                ? residentialLookup.searchSuggestions
                : undefined
            }
            emptyMessage={
              useGoogleAddressSearch
                ? "No matching addresses found. Check the spelling or keep typing."
                : unavailableLookupMessage
            }
            value={formData.residentialAddress.formattedAddress}
            onSuggestionSelect={(suggestion) =>
              applyResolvedAddress("residentialAddress", suggestion)
            }
            onValueChange={(residentialAddress) =>
              updateManualAddress("residentialAddress", residentialAddress)
            }
            placeholder="Street, suburb, state and postcode"
          />
          {!useGoogleAddressSearch ? (
            <p className="mt-2 text-xs text-slate-500">
              Manual entry mode is active because live address lookup is unavailable.
            </p>
          ) : null}
          {renderStructuredAddressMeta(formData.residentialAddress)}
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Mailbox className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Postal address</h2>
              <p className="text-sm text-slate-600">
                Only complete this if your postal address differs from your
                residential address.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              checked={formData.postalDifferent}
              type="checkbox"
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  postalDifferent: event.target.checked,
                }))
              }
            />
            My postal address is different
          </label>
          {formData.postalDifferent ? (
            <div className="mt-4">
              <Label htmlFor="postalAddress">Postal address</Label>
              <AddressAutocomplete
                id="postalAddress"
                searchSuggestions={
                  useGoogleAddressSearch ? postalLookup.searchSuggestions : undefined
                }
                emptyMessage={
                  useGoogleAddressSearch
                    ? "No matching addresses found. Check the spelling or keep typing."
                    : unavailableLookupMessage
                }
                value={formData.postalAddress.formattedAddress}
                onSuggestionSelect={(suggestion) =>
                  applyResolvedAddress("postalAddress", suggestion)
                }
                onValueChange={(postalAddress) =>
                  updateManualAddress("postalAddress", postalAddress)
                }
                placeholder="Postal address"
              />
              {!useGoogleAddressSearch ? (
                <p className="mt-2 text-xs text-slate-500">
                  Manual entry mode is active because live address lookup has not been configured.
                </p>
              ) : null}
              {renderStructuredAddressMeta(formData.postalAddress)}
            </div>
          ) : null}
        </div>
      </div>
    </ApplicationShell>
  );
}
