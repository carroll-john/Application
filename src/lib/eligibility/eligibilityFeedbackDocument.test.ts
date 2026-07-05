import { describe, expect, it } from "vitest";
import {
  buildEligibilityFeedbackDocumentPayload,
  createEligibilityFeedbackFile,
  ELIGIBILITY_FEEDBACK_FILE_NAME,
} from "./eligibilityFeedbackDocument";

describe("eligibilityFeedbackDocument", () => {
  it("builds a JSON file with flagged requirements", async () => {
    const payload = buildEligibilityFeedbackDocumentPayload({
      courseCode: "NUR101",
      courseTitle: "Bachelor of Nursing",
      savedAt: "2026-07-05T10:00:00.000Z",
      flaggedRequirements: [
        {
          heading: "Minimum 4/7 GPA",
          originalStatus: "pass",
          requirementId: "req-gpa",
          requirementSourceText: "Minimum 4/7 GPA",
          note: "My transcript shows 3.8/7.",
        },
      ],
    });

    const file = createEligibilityFeedbackFile(payload);
    const text = await file.text();

    expect(file.name).toBe(ELIGIBILITY_FEEDBACK_FILE_NAME);
    expect(file.type).toBe("application/json");
    expect(JSON.parse(text)).toMatchObject({
      schemaVersion: 1,
      courseCode: "NUR101",
      flaggedRequirements: [
        expect.objectContaining({
          requirementId: "req-gpa",
          note: "My transcript shows 3.8/7.",
        }),
      ],
    });
  });
});
