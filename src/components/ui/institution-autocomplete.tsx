import { Building2 } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import {
  commonTertiaryInstitutionSuggestions,
  type TertiaryInstitutionSuggestion,
} from "../../lib/tertiaryInstitutions";
import { AutocompleteInput } from "./autocomplete-input";

type InstitutionAutocompleteProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions?: TertiaryInstitutionSuggestion[];
};

export function InstitutionAutocomplete({
  value,
  onValueChange,
  suggestions = commonTertiaryInstitutionSuggestions,
  ...props
}: InstitutionAutocompleteProps) {
  return (
    <AutocompleteInput<TertiaryInstitutionSuggestion>
      {...props}
      emptyMessage="No matching institutions found. Keep typing to enter it manually."
      suggestionIcon={<Building2 className="h-4 w-4" />}
      suggestions={suggestions}
      value={value}
      onValueChange={onValueChange}
    />
  );
}
