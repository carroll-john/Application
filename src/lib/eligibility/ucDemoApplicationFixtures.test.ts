import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type ApplicationData,
} from "../applicationData";
import type { CourseCatalogEntry } from "../courseCatalog";
import { buildUcDemoWorkEntryEvidenceRow } from "./ucDemoApplicationFixtures";

function mayaApplication(overrides: Partial<ApplicationData> = {}): ApplicationData {
  return {
    ...initialApplicationData,
    cvFileName: "Maya-Patel-CV.pdf",
    cvUploaded: true,
    employmentExperiences: [
      {
        id: "maya-lead-role",
        company: "BrightPath Learning",
        currentRole: true,
        duties: "Leads national learning programs and capability strategy.",
        endMonth: "",
        endYear: "",
        position: "Learning and Development Lead",
        startMonth: "November",
        startYear: "2022",
        type: "Full-time",
      },
    ],
    tertiaryQualifications: [
      {
        id: "maya-rmit-study",
        completed: false,
        country: "Australia",
        courseName: "Bachelor of Business (Management)",
        endMonth: "August",
        endYear: "2025",
        institution: "RMIT University",
        level: "Bachelor",
        startMonth: "February",
        startYear: "2024",
      },
    ],
    ...overrides,
  };
}

const mba = {
  code: "master-of-business-administration",
  officialCourseCode: "MGM104",
  title: "Master of Business Administration",
} as CourseCatalogEntry;

describe("UC demo application evidence fixtures", () => {
  it("restores Maya's reviewed work-experience entry pathway", () => {
    expect(
      buildUcDemoWorkEntryEvidenceRow({
        applicationData: mayaApplication(),
        course: mba,
      }),
    ).toMatchObject({
      heading: "Work experience entry pathway",
      isBlocking: false,
      isEntryPathway: true,
      status: "provisionally_met",
      statusLabel: "Appears to meet",
    });
  });

  it("does not infer the pathway for other applications or courses", () => {
    expect(
      buildUcDemoWorkEntryEvidenceRow({
        applicationData: mayaApplication({ cvFileName: "another-applicant.pdf" }),
        course: mba,
      }),
    ).toBeNull();
    expect(
      buildUcDemoWorkEntryEvidenceRow({
        applicationData: mayaApplication(),
        course: { ...mba, officialCourseCode: "MGC103" },
      }),
    ).toBeNull();
  });
});
