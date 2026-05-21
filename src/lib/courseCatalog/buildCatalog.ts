import rawCourseData from "../../data/courses.raw.json";
import { createCourseTransformer } from "./normalize";
import { slugify } from "./slugify";
import type { CourseCatalogEntry, RawCourseCatalogData } from "./types";

const courseEntries = (rawCourseData as RawCourseCatalogData).courses;

const baseCodeCounts = courseEntries.reduce<Record<string, number>>((counts, course) => {
  const baseCode = slugify(course.course_name);
  counts[baseCode] = (counts[baseCode] ?? 0) + 1;
  return counts;
}, {});

const transformCourse = createCourseTransformer(baseCodeCounts);
const courseCatalog: CourseCatalogEntry[] = courseEntries.map((course) => transformCourse(course));

export function getCourseCatalog() {
  return courseCatalog;
}

export function getCourseByCode(code?: string | null) {
  if (!code) {
    return null;
  }

  return courseCatalog.find((course) => course.code === code) ?? null;
}

export function getDefaultCourse() {
  return courseCatalog[0];
}
