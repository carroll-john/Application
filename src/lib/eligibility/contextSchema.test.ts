import { describe, expect, it } from "vitest";
import { buildTranscriptEligibilityContext } from "../../features/section2/tertiaryTranscriptParsePolicy";
import { parseTranscriptEligibilityContext } from "./contextSchema";
import type { ApplicationData } from "../applicationData";

describe("transcript eligibility context schema", () => {
  it("round-trips fields built by the Section 2 client through the proxy parser", () => {
    const applicationData = {
      applicationMeta: {
        selectedCourse: { code: "MDA900", intake: "2026", title: "Master of Data Analytics" },
      },
      cvUploaded: true,
      employmentExperiences: [{ id: "e1" }],
      languageTests: [{ id: "lt1" }],
      professionalAccreditations: [{ id: "a1", name: "AHPRA", status: "Active" }],
    } as unknown as ApplicationData;

    const built = buildTranscriptEligibilityContext(applicationData, {
      completed: true,
      country: "Australia",
      institution: "Monash University",
      level: "Bachelor",
    });

    const parsed = parseTranscriptEligibilityContext(JSON.stringify(built));

    expect(parsed.courseCode).toBe("MDA900");
    expect(parsed.courseTitle).toBe("Master of Data Analytics");
    expect(parsed.completed).toBe(true);
    expect(parsed.country).toBe("Australia");
    expect(parsed.institution).toBe("Monash University");
    expect(parsed.level).toBe("Bachelor");
    expect(parsed.cvUploaded).toBe(true);
    expect(parsed.employmentCount).toBe(1);
    expect(parsed.languageTestsCount).toBe(1);
    expect(parsed.hasAhpraRegistration).toBe(false);
    expect(parsed.requirements).toEqual(built.requirements);
  });
});
