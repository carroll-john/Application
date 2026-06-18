import { useMemo } from "react";
import {
  createAddressLookupFromClient,
  createInstitutionLookupFromClient,
  createSuggestClient,
  fallbackInstitutionSuggestions,
  getMatchingSuggestions,
  type AddressSuggestion,
  type InstitutionSuggestion,
  type SuggestClientOptions,
} from "@keypath/suggest-core";

export function useSuggestClient(options: SuggestClientOptions) {
  return useMemo(() => createSuggestClient(options), [options.baseUrl, options.token]);
}

export function useInstitutionSuggest(options: {
  baseUrl?: string;
  token?: string;
  country?: string;
  fallbackSuggestions?: InstitutionSuggestion[];
}) {
  const fallbackSuggestions = options.fallbackSuggestions ?? fallbackInstitutionSuggestions;

  return useMemo(() => {
    const baseUrl = options.baseUrl?.trim();

    if (!baseUrl) {
      return {
        hasRemoteLookup: false,
        searchSuggestions: undefined,
        fallbackSuggestions,
      };
    }

    const client = createSuggestClient({
      baseUrl,
      token: options.token,
    });
    const lookup = createInstitutionLookupFromClient(client, options.country);

    return {
      hasRemoteLookup: true,
      fallbackSuggestions,
      searchSuggestions: async (query: string) => {
        try {
          const remote = await lookup.searchSuggestions(query);
          if (remote.length > 0) {
            return remote;
          }
        } catch {
          return getMatchingSuggestions(query, fallbackSuggestions);
        }

        return getMatchingSuggestions(query, fallbackSuggestions);
      },
    };
  }, [fallbackSuggestions, options.baseUrl, options.country, options.token]);
}

export function useAddressSuggest(options: {
  baseUrl?: string;
  token?: string;
  regionCodes?: string[];
}) {
  return useMemo(() => {
    const baseUrl = options.baseUrl?.trim();

    if (!baseUrl) {
      return {
        hasRemoteLookup: false,
        searchSuggestions: undefined as
          | ((query: string) => Promise<AddressSuggestion[]>)
          | undefined,
      };
    }

    const client = createSuggestClient({
      baseUrl,
      token: options.token,
    });
    const lookup = createAddressLookupFromClient(client, options.regionCodes ?? ["au"]);

    return {
      hasRemoteLookup: true,
      searchSuggestions: lookup.searchSuggestions,
    };
  }, [options.baseUrl, options.regionCodes, options.token]);
}
