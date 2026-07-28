import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  CvRecognitionDraft,
  UcOscaExperienceSummary,
} from "../../lib/ucRplAssessment";
import {
  ShortlistProgressHighlight,
  UcCourseMatchSummaryRail,
} from "./UcRplCourseMatcher";
import { ExperienceSummaryRow } from "./UcRplExperienceReview";

const expectedSummaryLabels = [
  "7 roles from CV",
  "25.1 years experience",
  "Senior or highly specialised roles",
  "May be eligible for direct entry",
  "Edit",
];

function expectLabelsInOrder(html: string) {
  expectedSummaryLabels.slice(1).forEach((label, index) => {
    expect(html.indexOf(expectedSummaryLabels[index]!)).toBeLessThan(
      html.indexOf(label),
    );
  });
}

describe("UC course-match experience summary", () => {
  it("orders the role count, duration, role level, entry guidance and edit action", () => {
    const html = renderToStaticMarkup(
      createElement(UcCourseMatchSummaryRail, {
        experienceMonths: 301,
        includedRoleCount: 7,
        onEdit: vi.fn(),
        skillLevel: 1,
      }),
    );

    expectLabelsInOrder(html);
  });

  it("gives entry guidance and the edit action distinct prominence", () => {
    const html = renderToStaticMarkup(
      createElement(UcCourseMatchSummaryRail, {
        experienceMonths: 301,
        includedRoleCount: 7,
        onEdit: vi.fn(),
        skillLevel: 1,
      }),
    );

    expect(html).toContain("border-[var(--sn-mint)]/40");
    expect(html).toContain("bg-[var(--sn-mint)]");
    expect(html).toContain("text-[var(--sn-navy)]");
    expect(html).toContain("rounded-full");
    expect(html).toContain("bg-white");
    expect(html).not.toContain("Review my experience");
  });

  it("uses the StudyNext yellow accent for shortlist progress", () => {
    const html = renderToStaticMarkup(
      createElement(ShortlistProgressHighlight, { shortlistedCount: 2 }),
    );

    expect(html).toContain("2 of 3 courses shortlisted");
    expect(html).toContain("border-[var(--sn-yellow)]/45");
    expect(html).toContain("bg-[var(--sn-yellow)]");
    expect(html).not.toContain("border-amber");
    expect(html).not.toContain("background-soft-yellow");
  });

  it("uses the same ordered, prominent rail on the experience-review screen", () => {
    const summary = {
      experienceMonths: 301,
      experienceYears: 25.1,
      includedRoleCount: 7,
      key: "level-1",
      roles: Array.from({ length: 7 }, (_, index) => ({ id: `role-${index}` })),
      skillLevel: 1,
    } as UcOscaExperienceSummary;
    const html = renderToStaticMarkup(
      createElement(ExperienceSummaryRow, {
        draft: {} as CvRecognitionDraft,
        isEditing: false,
        onChange: vi.fn(),
        onEdit: vi.fn(),
        summary,
      }),
    );

    expectLabelsInOrder(html);
    expect(html).toContain("bg-[var(--info-bg)]");
    expect(html).toContain("bg-[var(--cta-secondary)]");
  });
});
