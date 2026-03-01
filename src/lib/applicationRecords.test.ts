import { describe, expect, it } from "vitest";
import { createApplicationDraft, summarizeApplication } from "./applicationRecords";

describe("application records", () => {
  it("creates a draft seeded from the selected course and reusable profile", () => {
    const draft = createApplicationDraft(
      {
        code: "mba-online",
        intake: "12 May 2025",
        provider: "Southern Cross University",
        title: "Master of Business Administration (MBA) online",
      },
      "profile-1",
      {
        email: "john.carroll@keypathedu.com.au",
        firstName: "John",
        id: "profile-1",
        lastName: "Carroll",
        phone: "0400000000",
        preferredName: "Johnny",
      },
    );

    expect(draft.applicationMeta).toMatchObject({
      applicantProfileId: "profile-1",
      selectedCourse: {
        code: "mba-online",
        intake: "12 May 2025",
      },
      status: "draft",
    });
    expect(draft.personalDetails).toMatchObject({
      email: "john.carroll@keypathedu.com.au",
      firstName: "John",
      lastName: "Carroll",
      phone: "0400000000",
      preferredName: "Johnny",
    });
  });

  it("summarizes applications with a selected course", () => {
    const summary = summarizeApplication(
      createApplicationDraft({
        code: "bachelor-business",
        intake: "21 July 2025",
        provider: "University of Canberra",
        title: "Bachelor of Business online",
      }),
    );

    expect(summary).toMatchObject({
      course: {
        code: "bachelor-business",
        title: "Bachelor of Business online",
      },
      status: "draft",
    });
  });
});
