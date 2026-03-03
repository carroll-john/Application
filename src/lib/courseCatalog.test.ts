import { describe, expect, it } from "vitest";
import { getCourseByCode, getCourseCatalog, getDefaultCourse } from "./courseCatalog";

describe("course catalog", () => {
  it("returns the transformed course range from the raw extract", () => {
    const courses = getCourseCatalog();

    expect(courses.length).toBe(34);
    expect(courses.map((course) => course.code)).toContain("mba-online");
  });

  it("preserves the core academic fields from the source extract", () => {
    const mbaOnline = getCourseByCode("mba-online");
    const healthTechCourse = getCourseCatalog().find(
      (course) => course.subjectArea === "Health and Information Technology",
    );

    expect(mbaOnline?.title).toBe("Master of Business Administration - (MBA) online");
    expect(mbaOnline?.subjectArea).toBe("Business and Management");
    expect(mbaOnline?.categories).toEqual(["Business"]);
    expect(healthTechCourse?.categories).toEqual(["Technology", "Health"]);
    expect(mbaOnline?.intakeLabel).toBe("January");
    expect(mbaOnline?.recognitionOfPriorLearning).toContain("advanced standing");
    expect(mbaOnline?.coreSubjects.length).toBeGreaterThan(10);
    expect(mbaOnline?.coreSubjects[0]).toContain("MGMT5003");
  });

  it("normalizes duration into a consistent year-based format where possible", () => {
    const mbaOnline = getCourseByCode("mba-online");
    const utsMba = getCourseCatalog().find(
      (course) =>
        course.provider.includes("UTS Online") &&
        course.title === "Master of Business Administration (MBA)",
    );
    const cquIt = getCourseCatalog().find(
      (course) =>
        course.provider === "CQUniversity Australia" &&
        course.title === "Master of Information Technology",
    );

    expect(mbaOnline?.duration).toBe("2.7 years part-time");
    expect(utsMba?.duration).toBe("2 years part-time");
    expect(cquIt?.duration).toBe("2 years full-time or part-time equivalent");
  });

  it("simplifies fee language into plain summaries and support labels", () => {
    const unisqMba = getCourseByCode(
      "university-of-southern-queensland-unisq-master-of-business-administration-mba",
    );
    const monashDigitalMba = getCourseCatalog().find((course) =>
      course.title.includes("Business Administration (Digital)"),
    );
    const scuIt = getCourseCatalog().find(
      (course) =>
        course.provider === "Southern Cross University" &&
        course.title === "Master of Information Technology",
    );

    expect(unisqMba?.feeSummary).toBe("Approx. $17,392 per year");
    expect(unisqMba?.supportSummary).toBe("CSP · FEE-HELP · HECS-HELP");
    expect(unisqMba?.supportOptions).toEqual(["CSP", "FEE-HELP", "HECS-HELP"]);
    expect(unisqMba?.feeNotes).toContain("Student services fees may apply.");

    expect(monashDigitalMba?.feeSummary).toBe("Approx. $44,200 per year");
    expect(monashDigitalMba?.feeNotes).toContain(
      "Based on a full-time load of 8 units per year.",
    );
    expect(monashDigitalMba?.supportSummary).toBe("FEE-HELP");
    expect(monashDigitalMba?.feeNotes).toContain("Approx. $66,300 total for the full course.");
    expect(monashDigitalMba?.feeNotes).toContain("Scholarships or discounts may be available.");
    expect(scuIt?.feeSummary).toBe("Approx. $26,000 per year");
    expect(scuIt?.feeSummary).not.toContain("$208,000");
  });

  it("returns the first seeded course as the default", () => {
    expect(getDefaultCourse().code).toBe(getCourseCatalog()[0]?.code);
  });
});
