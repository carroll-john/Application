import { describe, expect, it } from "vitest";
import {
  type GoogleAddressComponent,
  getAddressComponent,
  joinStreetAddress,
  mapPlaceToStructuredAddress,
} from "./googlePlacesAddress";

const baseComponents: GoogleAddressComponent[] = [
  { longText: "10", shortText: "10", types: ["street_number"] },
  { longText: "Bourke Street", shortText: "Bourke St", types: ["route"] },
  { longText: "Melbourne", shortText: "Melbourne", types: ["locality"] },
  {
    longText: "Victoria",
    shortText: "VIC",
    types: ["administrative_area_level_1"],
  },
  { longText: "3000", shortText: "3000", types: ["postal_code"] },
  { longText: "Australia", shortText: "AU", types: ["country"] },
];

describe("getAddressComponent", () => {
  it("returns the first component matching any of the requested types", () => {
    expect(getAddressComponent(baseComponents, ["route"])?.longText).toBe(
      "Bourke Street",
    );
  });

  it("falls through type alternatives until it finds a match", () => {
    expect(
      getAddressComponent(baseComponents, ["postal_town", "locality"])?.longText,
    ).toBe("Melbourne");
  });

  it("returns undefined when no component matches", () => {
    expect(getAddressComponent(baseComponents, ["sublocality"])).toBeUndefined();
  });
});

describe("joinStreetAddress", () => {
  it("combines street number and route", () => {
    expect(joinStreetAddress(baseComponents)).toBe("10 Bourke Street");
  });

  it("joins subpremise to street number with a slash", () => {
    expect(
      joinStreetAddress([
        ...baseComponents,
        { longText: "12", shortText: "12", types: ["subpremise"] },
      ]),
    ).toBe("12/10 Bourke Street");
  });

  it("uses subpremise alone when no street number is present", () => {
    expect(
      joinStreetAddress([
        { longText: "Apt 4", shortText: "Apt 4", types: ["subpremise"] },
        { longText: "Bourke Street", shortText: "Bourke St", types: ["route"] },
      ]),
    ).toBe("Apt 4 Bourke Street");
  });

  it("falls back to premise when no street number / route exist", () => {
    expect(
      joinStreetAddress([
        { longText: "Eureka Tower", shortText: "Eureka", types: ["premise"] },
      ]),
    ).toBe("Eureka Tower");
  });

  it("returns an empty string when no usable components are present", () => {
    expect(joinStreetAddress([])).toBe("");
  });
});

describe("mapPlaceToStructuredAddress", () => {
  it("maps a fully-populated Google place to a structured address", () => {
    const result = mapPlaceToStructuredAddress(
      {
        formattedAddress: "10 Bourke Street, Melbourne VIC 3000, Australia",
        addressComponents: baseComponents,
      },
      "fallback",
    );

    expect(result).toMatchObject({
      formattedAddress: "10 Bourke Street, Melbourne VIC 3000, Australia",
      streetAddress: "10 Bourke Street",
      suburb: "Melbourne",
      state: "VIC",
      postcode: "3000",
      country: "Australia",
    });
  });

  it("uses the fallback label when formattedAddress is blank", () => {
    const result = mapPlaceToStructuredAddress(
      { addressComponents: baseComponents },
      "Search query",
    );

    expect(result.formattedAddress).toBe("Search query");
    expect(result.streetAddress).toBe("10 Bourke Street");
  });

  it("prefers the short state name (e.g. VIC over Victoria)", () => {
    const components: GoogleAddressComponent[] = [
      { longText: "10", shortText: "10", types: ["street_number"] },
      { longText: "Bourke Street", shortText: "Bourke St", types: ["route"] },
      { longText: "Melbourne", shortText: "Melbourne", types: ["locality"] },
      {
        longText: "New South Wales",
        shortText: "NSW",
        types: ["administrative_area_level_1"],
      },
      { longText: "2000", shortText: "2000", types: ["postal_code"] },
      { longText: "Australia", shortText: "AU", types: ["country"] },
    ];

    expect(mapPlaceToStructuredAddress({ addressComponents: components }, "x").state)
      .toBe("NSW");
  });

  it("falls through locality fallbacks when locality is missing", () => {
    const components: GoogleAddressComponent[] = [
      { longText: "Camberwell", shortText: "Camberwell", types: ["postal_town"] },
      {
        longText: "Victoria",
        shortText: "VIC",
        types: ["administrative_area_level_1"],
      },
    ];

    expect(mapPlaceToStructuredAddress({ addressComponents: components }, "x").suburb)
      .toBe("Camberwell");
  });

  it("returns empty fields when addressComponents is missing", () => {
    const result = mapPlaceToStructuredAddress(
      { formattedAddress: "Just a label" },
      "fallback",
    );

    expect(result.formattedAddress).toBe("Just a label");
    expect(result.streetAddress).toBe("");
    expect(result.suburb).toBe("");
    expect(result.state).toBe("");
  });
});
