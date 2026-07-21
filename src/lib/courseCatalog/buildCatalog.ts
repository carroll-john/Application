import rawCourseData from "../../data/courses.raw.json";
import rawUcCourseData from "../../data/courses.uc.raw.json";
import { createCourseTransformer } from "./normalize";
import { getGeneratedRequirementsForCourse } from "./requirementsLoader";
import { slugify } from "./slugify";
import type { CourseCatalogEntry, RawCourseCatalogData } from "./types";
import type { CatalogId } from "../brand";
import { activeBrand } from "../brand";

function buildCatalog(rawData: RawCourseCatalogData, catalogId: CatalogId) {
  const courseEntries = rawData.courses;

  const baseCodeCounts = courseEntries.reduce<Record<string, number>>((counts, course) => {
    const baseCode = slugify(course.course_name);
    counts[baseCode] = (counts[baseCode] ?? 0) + 1;
    return counts;
  }, {});

  const transformCourse = createCourseTransformer(baseCodeCounts);
  return courseEntries.map((course): CourseCatalogEntry => {
    const entry = transformCourse(course);
    const generatedRequirements = getGeneratedRequirementsForCourse(entry.code, catalogId);
    if (generatedRequirements) {
      entry.requirements = generatedRequirements;
    }
    return entry;
  });
}

const catalogs: Record<CatalogId, CourseCatalogEntry[]> = {
  default: buildCatalog(rawCourseData as RawCourseCatalogData, "default"),
  uc: buildCatalog(rawUcCourseData as RawCourseCatalogData, "uc"),
};

export function getCourseCatalogFor(catalogId: CatalogId) {
  return catalogs[catalogId];
}

export function getCourseCatalog() {
  return getCourseCatalogFor(activeBrand.catalogId);
}

export function getCourseByCode(code?: string | null) {
  if (!code) {
    return null;
  }

  return getCourseCatalog().find((course) => course.code === code) ?? null;
}

export function getDefaultCourse() {
  return getCourseCatalog()[0];
}
