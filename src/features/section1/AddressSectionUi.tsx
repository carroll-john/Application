import { Home, Mailbox } from "lucide-react";
import type { ReactNode } from "react";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "../../components/ui/address-autocomplete";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { StructuredAddress } from "../../lib/address";
import { createAppAddressLookup } from "../../lib/suggestClient";

type AddressKey = "residentialAddress" | "postalAddress";
type AddressLookup = ReturnType<typeof createAppAddressLookup>;

interface AddressSectionCardsProps {
  formData: {
    residentialAddress: StructuredAddress;
    postalDifferent: boolean;
    postalAddress: StructuredAddress;
  };
  onApplyResolvedAddress: (
    key: AddressKey,
    suggestion: AddressSuggestion,
  ) => void;
  onManualAddressChange: (key: AddressKey, formattedAddress: string) => void;
  onPostalDifferentChange: (postalDifferent: boolean) => void;
  onUnitNumberChange: (key: AddressKey, unitNumber: string) => void;
  postalLookup: AddressLookup;
  renderAddressMeta: (address: StructuredAddress) => ReactNode;
  residentialLookup: AddressLookup;
  unavailableLookupMessage: string;
  useAddressSearch: boolean;
}

export function AddressSectionCards({
  formData,
  onApplyResolvedAddress,
  onManualAddressChange,
  onPostalDifferentChange,
  onUnitNumberChange,
  postalLookup,
  renderAddressMeta,
  residentialLookup,
  unavailableLookupMessage,
  useAddressSearch,
}: AddressSectionCardsProps) {
  return (
    <div className="space-y-6">
      <div className="content-block rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <Home className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Residential address</h2>
            <p className="text-sm text-slate-600">
              Use the address where you are currently living.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <div>
            <Label htmlFor="residentialUnitNumber">Unit / apartment</Label>
            <Input
              id="residentialUnitNumber"
              autoComplete="address-line2"
              placeholder="e.g. 12B"
              value={formData.residentialAddress.unitNumber}
              onChange={(event) =>
                onUnitNumberChange("residentialAddress", event.target.value)
              }
            />
          </div>
          <div>
            <Label htmlFor="residentialAddress">Permanent residential address *</Label>
            <AddressAutocomplete
              id="residentialAddress"
              searchSuggestions={
                useAddressSearch ? residentialLookup.searchSuggestions : undefined
              }
              emptyMessage={
                useAddressSearch
                  ? "No matching addresses found. Check the spelling or keep typing."
                  : unavailableLookupMessage
              }
              value={formData.residentialAddress.formattedAddress}
              onSuggestionSelect={(suggestion) =>
                onApplyResolvedAddress("residentialAddress", suggestion)
              }
              onValueChange={(residentialAddress) =>
                onManualAddressChange("residentialAddress", residentialAddress)
              }
              placeholder="Street, suburb, state and postcode"
            />
          </div>
        </div>
        {!useAddressSearch ? (
          <p className="mt-2 text-xs text-slate-500">
            Manual entry mode is active because live address lookup is unavailable.
          </p>
        ) : null}
        {renderAddressMeta(formData.residentialAddress)}
      </div>

      <div className="content-block rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <Mailbox className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />
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
            onChange={(event) => onPostalDifferentChange(event.target.checked)}
          />
          My postal address is different
        </label>
        {formData.postalDifferent ? (
          <div className="mt-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <div>
                <Label htmlFor="postalUnitNumber">Unit / apartment</Label>
                <Input
                  id="postalUnitNumber"
                  autoComplete="address-line2"
                  placeholder="e.g. 5"
                  value={formData.postalAddress.unitNumber}
                  onChange={(event) =>
                    onUnitNumberChange("postalAddress", event.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="postalAddress">Postal address</Label>
                <AddressAutocomplete
                  id="postalAddress"
                  searchSuggestions={
                    useAddressSearch ? postalLookup.searchSuggestions : undefined
                  }
                  emptyMessage={
                    useAddressSearch
                      ? "No matching addresses found. Check the spelling or keep typing."
                      : unavailableLookupMessage
                  }
                  value={formData.postalAddress.formattedAddress}
                  onSuggestionSelect={(suggestion) =>
                    onApplyResolvedAddress("postalAddress", suggestion)
                  }
                  onValueChange={(postalAddress) =>
                    onManualAddressChange("postalAddress", postalAddress)
                  }
                  placeholder="Postal address"
                />
              </div>
            </div>
            {!useAddressSearch ? (
              <p className="mt-2 text-xs text-slate-500">
                Manual entry mode is active because live address lookup has not been configured.
              </p>
            ) : null}
            {renderAddressMeta(formData.postalAddress)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
