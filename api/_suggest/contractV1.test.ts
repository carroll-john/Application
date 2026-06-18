import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  hasAddressResolveResponseV1,
  hasAddressSuggestResponseV1,
  hasInstitutionSuggestResponseV1,
  isAddressSuggestionV1,
  isInstitutionSuggestionV1,
  isStructuredAddressV1,
  SUGGEST_ADDRESS_RESOLVE_PATH,
  SUGGEST_ADDRESS_SUGGEST_PATH,
  SUGGEST_CONTRACT_VERSION,
  SUGGEST_INSTITUTION_SUGGEST_PATH,
} from "./contractV1.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceContractPath = path.resolve(
  __dirname,
  "../../../suggest-service/docs/contracts/suggest.v1.md",
);

describe("suggest contract v1 mirror", () => {
  it("pins endpoint paths and version", () => {
    expect(SUGGEST_CONTRACT_VERSION).toBe("v1");
    expect(SUGGEST_INSTITUTION_SUGGEST_PATH).toBe("/v1/institutions/suggest");
    expect(SUGGEST_ADDRESS_SUGGEST_PATH).toBe("/v1/addresses/suggest");
    expect(SUGGEST_ADDRESS_RESOLVE_PATH).toBe("/v1/addresses/resolve");
  });

  it("validates institution suggest fixtures", () => {
    const payload = {
      suggestions: [
        {
          id: "monash",
          label: "Monash University",
          value: "Monash University",
          countryCode: "AU",
        },
      ],
    };

    expect(hasInstitutionSuggestResponseV1(payload)).toBe(true);
    expect(isInstitutionSuggestionV1(payload.suggestions[0])).toBe(true);
  });

  it("validates address suggest and resolve fixtures", () => {
    const suggestPayload = {
      suggestions: [
        {
          id: "place-1",
          label: "123 Example St, Melbourne VIC, Australia",
          value: "123 Example St, Melbourne VIC, Australia",
          placeId: "ChIJ123",
        },
      ],
    };

    const resolvePayload = {
      address: {
        formattedAddress: "123 Example St, Melbourne VIC 3000, Australia",
        unitNumber: "",
        streetAddress: "123 Example St",
        suburb: "Melbourne",
        state: "VIC",
        postcode: "3000",
        country: "Australia",
      },
    };

    expect(hasAddressSuggestResponseV1(suggestPayload)).toBe(true);
    expect(isAddressSuggestionV1(suggestPayload.suggestions[0])).toBe(true);
    expect(hasAddressResolveResponseV1(resolvePayload)).toBe(true);
    expect(isStructuredAddressV1(resolvePayload.address)).toBe(true);
  });

  it("keeps prose contract doc present alongside service copy", () => {
    const prose = readFileSync(serviceContractPath, "utf8");
    assert.match(prose, /GET \/v1\/institutions\/suggest/);
    assert.match(prose, /GET \/v1\/addresses\/resolve/);
  });
});
