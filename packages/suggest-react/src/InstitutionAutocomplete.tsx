import { Building2 } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import {
  fallbackInstitutionSuggestions,
  type InstitutionSuggestion,
} from "@keypath/suggest-core";
import { AutocompleteInput } from "./AutocompleteInput";

type InstitutionAutocompleteProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions?: InstitutionSuggestion[];
  searchSuggestions?: (query: string) => Promise<InstitutionSuggestion[]>;
  minimumQueryLength?: number;
};

export function InstitutionAutocomplete({
  value,
  onValueChange,
  suggestions = fallbackInstitutionSuggestions,
  searchSuggestions,
  minimumQueryLength = 2,
  ...props
}: InstitutionAutocompleteProps) {
  return (
    <AutocompleteInput<InstitutionSuggestion>
      {...props}
      emptyMessage="No matching institutions found. Keep typing to enter it manually."
      minimumQueryLength={minimumQueryLength}
      searchSuggestions={searchSuggestions}
      suggestionIcon={<Building2 className="h-4 w-4" />}
      suggestions={searchSuggestions ? [] : suggestions}
      value={value}
      onValueChange={onValueChange}
    />
  );
}

export type { InstitutionSuggestion };
