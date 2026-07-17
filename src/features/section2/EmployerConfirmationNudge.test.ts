import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  initialApplicationData,
  type EmploymentExperience,
} from "../../lib/applicationData";
import type { CourseCatalogEntry } from "../../lib/courseCatalog";
import { buildWorkExperienceAssessment } from "../../lib/eligibility/workExperience";
import { EmployerConfirmationNudge } from "./EmployerConfirmationNudge";

const requirement = {
  id: "work-1",
  kind: "work_experience" as const,
  params: { minYears: 3 },
  sourceText: "Three years relevant work experience.",
  weight: "mandatory" as const,
};
const course = {
  code: "course-1",
  title: "Course",
  requirements: [requirement],
} as CourseCatalogEntry;
const role: EmploymentExperience = {
  id: "role-1",
  company: "Employer",
  position: "Operations Lead",
  type: "Full-time",
  startMonth: "January",
  startYear: "2021",
  endMonth: "December",
  endYear: "2023",
  currentRole: false,
  duties: "Led operational improvement projects.",
};
const assessment = buildWorkExperienceAssessment({
  requirement,
  roles: [role],
  classifications: [{
    employmentExperienceId: role.id,
    relevanceStatus: "relevant",
    roleCriteriaStatus: "not_required",
    confidence: 0.9,
    explanation: "The duties demonstrate relevant operations work.",
    evidencePhrases: ["operational improvement projects"],
  }],
  checkedAt: "2026-07-16T00:00:00.000Z",
  promptVersion: "test@v1",
});

describe("EmployerConfirmationNudge", () => {
  it("separately prompts applicants to collect non-blocking employer evidence", () => {
    const html = renderToStaticMarkup(
      createElement(EmployerConfirmationNudge, {
        applicationData: {
          ...initialApplicationData,
          employmentExperiences: [role],
          workExperienceAssessments: { [requirement.id]: assessment },
        },
        course,
        onNavigate: () => undefined,
      }),
    );

    expect(html).toContain("Collect employer confirmation");
    expect(html).toContain("Optional for now");
    expect(html).toContain("covering at least 3 years");
    expect(html).toContain("You can submit without these letters");
    expect(html).toContain("Review roles and add letters");
    expect(html).not.toContain("The duties demonstrate relevant operations work");
  });

  it("does not render for courses without assessed work requirements", () => {
    const html = renderToStaticMarkup(
      createElement(EmployerConfirmationNudge, {
        applicationData: initialApplicationData,
        course: { code: "course-2", title: "Course", requirements: [] } as CourseCatalogEntry,
        onNavigate: () => undefined,
      }),
    );

    expect(html).toBe("");
  });
});
