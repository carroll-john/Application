import { describe, expect, it } from "vitest";
import { getUcCourseCardMedia } from "./ucCourseCardMedia";

describe("getUcCourseCardMedia", () => {
  it("selects the official image for the first supported course category", () => {
    expect(
      getUcCourseCardMedia({
        categories: ["Education", "Technology"],
        subjectArea: "Education, STEM and Technology",
      }),
    ).toEqual({
      alt: "An education student studying online",
      src: "/content/dam/uc/imagery/faculties/education/uc-education-study-online.jpg",
    });
  });

  it("falls back to the UC business image for an unsupported category", () => {
    expect(
      getUcCourseCardMedia({ categories: ["Other"], subjectArea: "Other" }).src,
    ).toContain("/faculties/business/");
  });

  it("uses built-environment media before the broader technology category", () => {
    expect(
      getUcCourseCardMedia({
        categories: ["Technology", "Built Environment"],
        subjectArea: "Built Environment and Technology",
      }).src,
    ).toContain("/faculties/built-environment/");
  });

  it("keeps business-government courses in the business visual family", () => {
    expect(
      getUcCourseCardMedia({
        categories: ["Business", "Politics & Society"],
        subjectArea: "Business, Government and Public Administration",
      }).src,
    ).toContain("/faculties/business/");
  });
});
