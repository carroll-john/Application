import { describe, expect, it } from "vitest";
import { getUcCourseCardMedia } from "./ucCourseCardMedia";

describe("getUcCourseCardMedia", () => {
  it("selects the official image for the first supported course category", () => {
    expect(
      getUcCourseCardMedia(
        {
          categories: ["Education", "Technology"],
          subjectArea: "Education, STEM and Technology",
        },
        0,
      ),
    ).toEqual({
      alt: "An education student working with a young learner",
      src: "/content/dam/uc/imagery/faculties/education/uc-education-study-online.jpg",
    });
  });

  it("falls back to the UC business image for an unsupported category", () => {
    expect(
      getUcCourseCardMedia({ categories: ["Other"], subjectArea: "Other" }, 0).src,
    ).toContain("/faculties/business/");
  });

  it("uses built-environment media before the broader technology category", () => {
    expect(
      getUcCourseCardMedia(
        {
          categories: ["Technology", "Built Environment"],
          subjectArea: "Built Environment and Technology",
        },
        0,
      ).src,
    ).toContain("/faculties/built-environment/");
  });

  it("keeps business-government courses in the business visual family", () => {
    expect(
      getUcCourseCardMedia(
        {
          categories: ["Business", "Politics & Society"],
          subjectArea: "Business, Government and Public Administration",
        },
        1,
      ).src,
    ).toContain("/faculties/business/");
  });

  it("uses every reviewed business image before repeating the pool", () => {
    const course = {
      categories: ["Business"],
      subjectArea: "Business and Management",
    };
    const firstCycle = [0, 1, 2, 3].map(
      (variantIndex) => getUcCourseCardMedia(course, variantIndex).src,
    );

    expect(new Set(firstCycle).size).toBe(4);
    expect(getUcCourseCardMedia(course, 4).src).toBe(firstCycle[0]);
  });

  it("uses communication imagery for digital-marketing courses", () => {
    expect(
      getUcCourseCardMedia(
        {
          categories: ["Business", "Communication"],
          subjectArea: "Business, Marketing and Digital Communication",
        },
        3,
      ).src,
    ).toContain("/faculties/communication-and-media/");
  });
});
