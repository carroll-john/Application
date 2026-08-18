import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TertiaryQualification } from "../../lib/applicationData";
import type { CvRecognitionDraft } from "../../lib/ucRplAssessment";
import {
  formatUcExtractedQualificationDetail,
  UcRplExperienceReview,
} from "./UcRplExperienceReview";

function qualification(
  overrides: Partial<TertiaryQualification> = {},
): TertiaryQualification {
  return {
    id: "qualification-1",
    completed: false,
    country: "Australia",
    courseName: "Bachelor of Business (Management)",
    endMonth: "August",
    endYear: "2025",
    institution: "RMIT University",
    level: "Bachelor Degree",
    startMonth: "February",
    startYear: "2024",
    ...overrides,
  };
}

function recognitionDraft(
  overrides: Partial<CvRecognitionDraft> = {},
): CvRecognitionDraft {
  return {
    experiences: [
      {
        id: "role-1",
        company: "BrightPath Learning",
        currentRole: true,
        duties: "Leads workplace learning and capability programs.",
        endMonth: "",
        endYear: "",
        includeInAssessment: true,
        oscaConfidence: "high",
        oscaOccupationCode: "222431",
        oscaOccupationTitle: "Training and Development Professional",
        oscaRationale: "The duties align with workplace learning and development.",
        oscaSkillLevel: 1,
        position: "Learning and Development Lead",
        startMonth: "January",
        startYear: "2023",
        type: "Full-time",
      },
    ],
    professionalAccreditations: [],
    profile: {
      firstName: "Maya",
      lastName: "Patel",
      middleName: "",
      phone: "0400 555 019",
      title: "",
    },
    secondaryQualifications: [],
    tertiaryQualifications: [],
    ...overrides,
  };
}

function renderReview(draft: CvRecognitionDraft) {
  return renderToStaticMarkup(
    createElement(UcRplExperienceReview, {
      draft,
      fileName: "Maya-Patel-CV.pdf",
      onChange: () => undefined,
      onContinue: () => undefined,
      onStartOver: () => undefined,
    }),
  );
}

describe("formatUcExtractedQualificationDetail", () => {
  it("does not describe an incomplete qualification as completed", () => {
    expect(formatUcExtractedQualificationDetail(qualification())).toBe(
      "Bachelor Degree · RMIT University · Incomplete (ended 2025)",
    );
  });

  it("keeps the completion year for a completed qualification", () => {
    expect(
      formatUcExtractedQualificationDetail(
        qualification({ completed: true }),
      ),
    ).toBe(
      "Bachelor Degree · RMIT University · Completed 2025",
    );
  });
});

describe("UcRplExperienceReview qualifications", () => {
  it("omits the qualifications section and empty-state copy when none were found", () => {
    const html = renderReview(recognitionDraft());

    expect(html).toContain("We found the roles below in your CV");
    expect(html).toContain("Indicative guidance");
    expect(html).toContain("Your experience may support direct entry");
    expect(html).toContain("Experience counted");
    expect(html).toContain("Review roles");
    expect(html).not.toContain("Entry guidance");
    expect(html).not.toContain(
      "Senior or highly specialised experience can support UC’s work-experience pathway.",
    );
    expect(html).not.toContain(
      "Given your experience in senior and highly specialised roles",
    );
    expect(html).not.toContain("Qualifications found in your CV");
    expect(html).not.toContain("0 found");
    expect(html).not.toContain("No qualifications were listed in this CV");
  });

  it("shows the qualifications section when the CV contains a qualification", () => {
    const html = renderReview(
      recognitionDraft({ tertiaryQualifications: [qualification()] }),
    );

    expect(html).toContain("We found the roles and qualifications below in your CV");
    expect(html).toContain("Qualifications found in your CV");
    expect(html).toContain("1 found");
    expect(html).toContain("Bachelor of Business (Management)");
  });
});
