import { createEmptyStructuredAddress, type StructuredAddress } from "./address";
import type {
  AddressSuggestion,
  InstitutionSuggestion,
  SuggestClientOptions,
} from "./types";

export const SUGGEST_CONTRACT_VERSION = "v1" as const;

export const SUGGEST_INSTITUTION_SUGGEST_PATH = "/v1/institutions/suggest" as const;
export const SUGGEST_ADDRESS_SUGGEST_PATH = "/v1/addresses/suggest" as const;
export const SUGGEST_ADDRESS_RESOLVE_PATH = "/v1/addresses/resolve" as const;

export const SUGGEST_INSTITUTION_RESPONSE_FIELDS = ["suggestions"] as const;
export const SUGGEST_ADDRESS_SUGGEST_RESPONSE_FIELDS = ["suggestions"] as const;
export const SUGGEST_ADDRESS_RESOLVE_RESPONSE_FIELDS = ["address"] as const;

export const SUGGEST_INSTITUTION_SUGGESTION_FIELDS = [
  "id",
  "label",
  "value",
  "countryCode",
] as const;

export const SUGGEST_ADDRESS_SUGGESTION_FIELDS = ["id", "label", "value", "placeId"] as const;

export const SUGGEST_STRUCTURED_ADDRESS_FIELDS = [
  "formattedAddress",
  "unitNumber",
  "streetAddress",
  "suburb",
  "state",
  "postcode",
  "country",
] as const;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function buildHeaders(token?: string) {
  const headers = new Headers({
    accept: "application/json",
  });

  if (token?.trim()) {
    headers.set("authorization", `Bearer ${token.trim()}`);
  }

  return headers;
}

async function fetchJson<T>(
  options: SuggestClientOptions,
  path: string,
  query: Record<string, string | undefined>,
): Promise<T | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = trimTrailingSlash(options.baseUrl.trim());

  if (!baseUrl) {
    return null;
  }

  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value?.trim()) {
      url.searchParams.set(key, value.trim());
    }
  }

  const response = await fetchImpl(url.toString(), {
    headers: buildHeaders(options.token),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Suggest request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function createSuggestClient(options: SuggestClientOptions) {
  return {
    async suggestInstitutions(params: {
      query: string;
      country?: string;
      limit?: number;
    }): Promise<InstitutionSuggestion[]> {
      const payload = await fetchJson<{ suggestions?: InstitutionSuggestion[] }>(
        options,
        SUGGEST_INSTITUTION_SUGGEST_PATH,
        {
          q: params.query,
          country: params.country,
          limit: params.limit ? String(params.limit) : undefined,
        },
      );

      return payload?.suggestions ?? [];
    },

    async suggestAddresses(params: {
      query: string;
      regionCodes?: string[];
    }): Promise<AddressSuggestion[]> {
      const payload = await fetchJson<{ suggestions?: AddressSuggestion[] }>(
        options,
        SUGGEST_ADDRESS_SUGGEST_PATH,
        {
          q: params.query,
          regionCodes: params.regionCodes?.join(","),
        },
      );

      return payload?.suggestions ?? [];
    },

    async resolveAddress(placeId: string): Promise<StructuredAddress | null> {
      const payload = await fetchJson<{ address?: StructuredAddress }>(
        options,
        SUGGEST_ADDRESS_RESOLVE_PATH,
        { placeId },
      );

      return payload?.address ?? null;
    },
  };
}

export function createAddressLookupFromClient(
  client: ReturnType<typeof createSuggestClient>,
  regionCodes: string[] = ["au"],
) {
  return {
    async searchSuggestions(query: string): Promise<AddressSuggestion[]> {
      const suggestions = await client.suggestAddresses({ query, regionCodes });

      return suggestions.map((suggestion) => ({
        ...suggestion,
        resolveAddress: async () => {
          if (!suggestion.placeId) {
            return {
              ...createEmptyStructuredAddress(),
              formattedAddress: suggestion.value,
            };
          }

          return client.resolveAddress(suggestion.placeId);
        },
      }));
    },
  };
}

export function createInstitutionLookupFromClient(
  client: ReturnType<typeof createSuggestClient>,
  country?: string,
) {
  return {
    async searchSuggestions(query: string): Promise<InstitutionSuggestion[]> {
      return client.suggestInstitutions({ query, country });
    },
  };
}

export function isStructuredAddress(value: unknown): value is StructuredAddress {
  if (!value || typeof value !== "object") {
    return false;
  }

  return SUGGEST_STRUCTURED_ADDRESS_FIELDS.every(
    (field) => typeof (value as Record<string, unknown>)[field] === "string",
  );
}
