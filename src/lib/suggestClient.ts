import {
  createAddressLookupFromClient,
  createEmptyStructuredAddress,
  createInstitutionLookupFromClient,
  createSuggestClient,
  type AddressSuggestion,
  type InstitutionSuggestion,
} from "@keypath/suggest-core";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  const value = env?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getSuggestProxyBaseUrl() {
  if (typeof window !== "undefined") {
    return "/api/suggest";
  }

  const host = readEnv("SUGGEST_PROXY_HOST") || "127.0.0.1";
  const port = readEnv("SUGGEST_PROXY_PORT") || "4193";
  return `http://${host}:${port}/api/suggest`;
}

function createProxyEndpoint(pathname: string) {
  const baseUrl = trimTrailingSlash(getSuggestProxyBaseUrl());
  const path = `${baseUrl}/${pathname.replace(/^\//, "")}`;

  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin);
  }

  return new URL(path);
}
function createProxySuggestClient() {
  return {
    async suggestInstitutions(params: {
      query: string;
      country?: string;
      limit?: number;
    }): Promise<InstitutionSuggestion[]> {
      const url = createProxyEndpoint("institutions");
      url.searchParams.set("q", params.query);
      if (params.country?.trim()) {
        url.searchParams.set("country", params.country.trim());
      }
      if (params.limit) {
        url.searchParams.set("limit", String(params.limit));
      }

      const response = await fetch(url.toString(), {
        headers: { accept: "application/json" },
      });

      if (response.status === 404) {
        throw new Error("Suggest service is not configured.");
      }

      if (!response.ok) {
        throw new Error(`Institution suggest failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { suggestions?: InstitutionSuggestion[] };
      return payload.suggestions ?? [];
    },

    async suggestAddresses(params: {
      query: string;
      regionCodes?: string[];
    }): Promise<AddressSuggestion[]> {
      const url = createProxyEndpoint("addresses");
      url.searchParams.set("q", params.query);
      if (params.regionCodes?.length) {
        url.searchParams.set("regionCodes", params.regionCodes.join(","));
      }

      const response = await fetch(url.toString(), {
        headers: { accept: "application/json" },
      });

      if (response.status === 404) {
        throw new Error("Suggest service is not configured.");
      }

      if (!response.ok) {
        throw new Error(`Address suggest failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { suggestions?: AddressSuggestion[] };
      return payload.suggestions ?? [];
    },

    async resolveAddress(placeId: string) {
      const url = createProxyEndpoint("addresses");
      url.searchParams.set("resolve", "1");
      url.searchParams.set("placeId", placeId);

      const response = await fetch(url.toString(), {
        headers: { accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Address resolve failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        address?: ReturnType<typeof createEmptyStructuredAddress>;
      };

      return payload.address ?? null;
    },
  };
}

export function hasSuggestServiceConfigured() {
  return Boolean(readEnv("SUGGEST_SERVICE_URL"));
}

export function createAppInstitutionLookup(country?: string) {
  const client = createProxySuggestClient();
  const remoteLookup = createInstitutionLookupFromClient(
    {
      suggestInstitutions: (params) => client.suggestInstitutions(params),
      suggestAddresses: () => Promise.resolve([]),
      resolveAddress: () => Promise.resolve(null),
    },
    country,
  );

  return remoteLookup;
}

export function createAppAddressLookup(regionCodes: string[] = ["au"]) {
  const client = createProxySuggestClient();

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

export function createDirectSuggestClient() {
  const baseUrl = readEnv("SUGGEST_SERVICE_URL");

  if (!baseUrl) {
    return null;
  }

  return createSuggestClient({
    baseUrl,
    token: readEnv("SUGGEST_SERVICE_TOKEN"),
  });
}
