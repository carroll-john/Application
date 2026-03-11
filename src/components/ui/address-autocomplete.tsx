import { useMemo, type InputHTMLAttributes } from "react";
import { MapPin } from "lucide-react";
import {
  AutocompleteInput,
  type AutocompleteSuggestion,
} from "./autocomplete-input";
import type { StructuredAddress } from "../../lib/address";

export interface AddressSuggestion extends AutocompleteSuggestion {
  resolveAddress?: () => Promise<StructuredAddress | null>;
}

type AddressAutocompleteProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions?: string[];
  searchSuggestions?: (query: string) => Promise<AddressSuggestion[]>;
  minimumQueryLength?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  onSuggestionSelect?: (suggestion: AddressSuggestion) => void | Promise<void>;
};

export function AddressAutocomplete({
  value,
  onValueChange,
  suggestions = [],
  searchSuggestions,
  minimumQueryLength = 3,
  emptyMessage = "No addresses found. Keep typing to enter manually.",
  loadingMessage = "Searching addresses...",
  onSuggestionSelect,
  className,
  id,
  onBlur,
  onFocus,
  onKeyDown,
  ...props
}: AddressAutocompleteProps) {
  const localSuggestions = useMemo<AddressSuggestion[]>(
    () =>
      suggestions.map((suggestion) => ({
        id: suggestion,
        label: suggestion,
        value: suggestion,
      })),
    [suggestions],
  );

  return (
    <AutocompleteInput<AddressSuggestion>
      {...props}
      autoComplete="street-address"
      className={className}
      emptyMessage={emptyMessage}
      id={id}
      loadingMessage={loadingMessage}
      minimumQueryLength={minimumQueryLength}
      searchSuggestions={searchSuggestions}
      suggestionIcon={<MapPin className="h-4 w-4" />}
      suggestions={localSuggestions}
      value={value}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onSuggestionSelect={onSuggestionSelect}
      onValueChange={onValueChange}
    />
  );
}
