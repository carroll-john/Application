import generated from "./requirements.generated.json";
import type { RequirementInstance } from "../eligibility/requirements";

interface GeneratedRequirementsFile {
  version: number;
  generatedAt: string | null;
  model: string | null;
  /**
   * Map of course code -> RequirementInstance[]. Empty when the parser script has not been run for
   * a given course.
   */
  courses: Record<string, RequirementInstance[]>;
}

const typedGenerated = generated as GeneratedRequirementsFile;

export function getGeneratedRequirementsForCourse(
  courseCode: string,
): RequirementInstance[] | undefined {
  const entry = typedGenerated.courses[courseCode];
  return Array.isArray(entry) && entry.length > 0 ? entry : undefined;
}

export function getGeneratedRequirementsMetadata() {
  return {
    version: typedGenerated.version,
    generatedAt: typedGenerated.generatedAt,
    model: typedGenerated.model,
    courseCount: Object.keys(typedGenerated.courses).length,
  };
}
