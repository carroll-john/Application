import type { AddressSuggestion } from "../components/ui/address-autocomplete";
import { createEmptyStructuredAddress } from "./address";
import {
  type GooglePlacePayload,
  mapPlaceToStructuredAddress,
} from "./googlePlacesAddress";

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      importLibrary?: (name: string) => Promise<unknown>;
    };
  };
  __codexGoogleMapsInit?: () => void;
};

type GoogleMapsGlobal = NonNullable<GoogleMapsWindow["google"]>;

interface GoogleAutocompleteSessionToken {}

interface GooglePlace extends GooglePlacePayload {
  fetchFields?: (options: { fields: string[] }) => Promise<void>;
}

interface GooglePlacePrediction {
  placeId?: string;
  text?: { toString: () => string };
  toPlace?: () => GooglePlace;
}

interface GoogleAutocompleteSuggestionResult {
  placePrediction?: GooglePlacePrediction;
}

interface GooglePlacesLibrary {
  AutocompleteSessionToken?: new () => GoogleAutocompleteSessionToken;
  AutocompleteSuggestion?: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      includedRegionCodes: string[];
      language: string;
      region: string;
      sessionToken?: GoogleAutocompleteSessionToken;
    }) => Promise<{
      suggestions?: GoogleAutocompleteSuggestionResult[];
    }>;
  };
}

const GOOGLE_MAPS_CALLBACK = "__codexGoogleMapsInit";
const GOOGLE_MAPS_SCRIPT_ID = "codex-google-maps-script";
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

let googleMapsPromise: Promise<GoogleMapsGlobal> | null = null;

function getGoogleMapsWindow() {
  return window as GoogleMapsWindow;
}

export function hasGooglePlacesApiKey() {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

async function loadGoogleMaps(): Promise<GoogleMapsGlobal> {
  const googleWindow = getGoogleMapsWindow();

  if (googleWindow.google?.maps?.importLibrary) {
    return googleWindow.google;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing Google Maps API key");
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise<GoogleMapsGlobal>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (googleWindow.google) {
        resolve(googleWindow.google);
        return;
      }

      reject(new Error("Google Maps loaded without a global google object"));
    };

    const handleError = () => reject(new Error("Google Maps failed to load"));

    googleWindow[GOOGLE_MAPS_CALLBACK] = handleLoad;

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    const query = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      libraries: "places",
      loading: "async",
      callback: GOOGLE_MAPS_CALLBACK,
    });

    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${query.toString()}`;
    script.addEventListener("error", handleError, { once: true });

    document.head.appendChild(script);
  }).finally(() => {
    delete googleWindow[GOOGLE_MAPS_CALLBACK];
  });

  return googleMapsPromise;
}

export function createGoogleAddressLookup() {
  let sessionToken: GoogleAutocompleteSessionToken | null = null;

  return {
    async searchSuggestions(query: string): Promise<AddressSuggestion[]> {
      if (!GOOGLE_MAPS_API_KEY || query.trim().length < 3) {
        return [];
      }

      const google = await loadGoogleMaps();
      const placesLibrary = (await google.maps?.importLibrary?.(
        "places",
      )) as GooglePlacesLibrary | null;

      if (!placesLibrary?.AutocompleteSuggestion) {
        return [];
      }

      if (!sessionToken && placesLibrary.AutocompleteSessionToken) {
        sessionToken = new placesLibrary.AutocompleteSessionToken();
      }

      const result =
        await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ["au"],
          language: "en-AU",
          region: "au",
          sessionToken: sessionToken ?? undefined,
        });

      const suggestions: AddressSuggestion[] = [];

      (result.suggestions ?? []).forEach((suggestion, index) => {
        const prediction = suggestion.placePrediction;
        const label = prediction?.text?.toString?.().trim();

        if (!label) {
          return;
        }

        suggestions.push({
          id: prediction?.placeId ?? `${label}-${index}`,
          label,
          value: label,
          resolveAddress: async () => {
            const place = prediction?.toPlace?.();

            if (!place?.fetchFields) {
              sessionToken = null;
              return {
                ...createEmptyStructuredAddress(),
                formattedAddress: label,
              };
            }

            await place.fetchFields({
              fields: ["formattedAddress", "addressComponents"],
            });
            sessionToken = null;

            return mapPlaceToStructuredAddress(place, label);
          },
        });
      });

      return suggestions;
    },
  };
}
