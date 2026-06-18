import type { StructuredAddress } from "./address";

export interface AutocompleteSuggestion {
  id: string;
  label: string;
  value: string;
  detail?: string;
  matchText?: string;
}

export interface InstitutionSuggestion extends AutocompleteSuggestion {
  countryCode?: string;
}

export interface AddressSuggestion extends AutocompleteSuggestion {
  placeId?: string;
  resolveAddress?: () => Promise<StructuredAddress | null>;
}

export interface InstitutionRecord {
  id: string;
  name: string;
  countryCode: string;
  aliases: string[];
  source: "ror" | "cricos" | "manual";
}

export interface SuggestClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}
