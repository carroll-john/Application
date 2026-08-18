import { describe, expect, it } from "vitest";
import { getCourseCatalogFor } from "./buildCatalog";

describe("University of Canberra catalogue", () => {
  const catalogue = getCourseCatalogFor("uc");

  it("contains exactly 33 unique postgraduate online offerings", () => {
    expect(catalogue).toHaveLength(33);
    expect(new Set(catalogue.map((course) => course.title)).size).toBe(33);
    expect(catalogue.every((course) => course.studyLevel === "Postgraduate")).toBe(true);
  });

  it("keeps provider, provenance, delivery and eligibility safety explicit", () => {
    for (const course of catalogue) {
      expect(course.provider).toBe("University of Canberra");
      expect(course.sourceUrl).toMatch(
        /^https:\/\/(?:www\.|studyonline\.)canberra\.edu\.au\//,
      );
      expect(course.sourceVerifiedAt).toBe("2026-08-18");
      expect(["online", "online_plus"]).toContain(course.deliveryMode);
      expect(["assess", "manual_review"]).toContain(course.eligibilityPolicy);
    }
  });

  it("publishes sourced eligibility requirements instead of placeholder copy", () => {
    for (const course of catalogue) {
      expect(course.entryRequirements?.length).toBeGreaterThan(40);
      expect(course.entryRequirementItems.length).toBeGreaterThan(1);
      expect(course.entryRequirements).not.toMatch(
        /reviewed (?:manually )?against the current University of Canberra course rules/i,
      );
    }
  });

  it("preserves alternate, professional and placement pathways where UC publishes them", () => {
    const graduateBusiness = catalogue.find(
      (course) => course.title === "Graduate Certificate in Business",
    );
    const educationLeadership = catalogue.find(
      (course) => course.title === "Master of Education (Leadership)",
    );
    const masterOfTeaching = catalogue.find(
      (course) => course.title === "Master of Teaching (Primary or Secondary)",
    );

    expect(graduateBusiness?.entryRequirementItems.join(" ")).toContain(
      "three years of relevant work experience",
    );
    expect(educationLeadership?.entryRequirementItems.join(" ")).toContain(
      "current teacher registration",
    );
    expect(masterOfTeaching?.entryRequirementItems.join(" ")).toContain("CASPI");
    expect(masterOfTeaching?.entryRequirementItems.join(" ")).toContain(
      "60 days of supervised school placement",
    );
  });

  it("uses only the reviewed MBA Government rules for automated assessment", () => {
    const assessed = catalogue.filter((course) => course.eligibilityPolicy === "assess");
    expect(assessed.map((course) => course.code)).toEqual([
      "master-of-business-administration-government",
    ]);
    expect(assessed[0]?.requirements?.length).toBeGreaterThan(0);
    expect(
      catalogue
        .filter((course) => course.eligibilityPolicy === "manual_review")
        .every((course) => course.requirements === undefined),
    ).toBe(true);
  });

  it("includes Online Plus offerings", () => {
    expect(catalogue.filter((course) => course.deliveryMode === "online_plus").length).toBeGreaterThan(0);
  });

  it("preserves current published duration, tuition and RPL limits for the education comparison", () => {
    const educationLeadership = catalogue.find(
      (course) => course.title === "Master of Education (Leadership)",
    );

    expect(educationLeadership).toMatchObject({
      duration: "1.3 years part-time",
      sourceVerifiedAt: "2026-08-18",
      tuitionFees: "$2,956.25 per unit; $23,650 total (2026 indicative fees)",
    });
    expect(educationLeadership?.recognitionOfPriorLearning).toContain(
      "up to 12 credit points",
    );
  });
});
