import type { CourseCatalogEntry } from "../courseCatalog";
import { getCourseEligibilityQuestions } from "../courseEligibility";
import {
  flattenCourseRequirementsV2,
  isCourseRequirementsV2,
  type CourseRequirementsV2,
} from "./courseRequirementsV2";
import {
  formatAcademicThreshold,
  formatFieldOfStudyAreas,
  formatQualificationLevel,
  requirementKindLabel,
  type RequirementInstance,
} from "./requirements";
import {
  formatRequirementDetailText,
  shouldOmitPairedQualificationCompleted,
} from "./requirementPresentation";

export interface RequirementPlainSummary {
  id: string;
  kindLabel: string;
  summary: string;
  sourceText: string;
  weight: string;
  orGroup?: string;
}

function summarizeRequirement(
  requirement: RequirementInstance,
  siblings: readonly RequirementInstance[],
): RequirementPlainSummary {
  let summary = requirementKindLabel(requirement.kind);

  switch (requirement.kind) {
    case "qualification_level":
      summary = formatQualificationLevel(requirement.params.level);
      break;
    case "academic_threshold":
      summary = `Minimum ${formatAcademicThreshold(requirement.params)}`;
      break;
    case "work_experience":
      summary = `At least ${requirement.params.minYears} year(s) relevant experience${
        requirement.params.relevantTo ? ` (${requirement.params.relevantTo})` : ""
      }`;
      break;
    case "field_of_study":
      summary = `Study in: ${formatFieldOfStudyAreas(requirement.params)}`;
      break;
    case "english_proficiency": {
      const parts = requirement.params.acceptedPathways.map((pathway) => {
        if (pathway.type === "english_test") {
          const band = pathway.minBand != null ? `, each band ≥ ${pathway.minBand}` : "";
          return `${pathway.test} overall ≥ ${pathway.minOverall}${band}`;
        }
        return `Completed qualification in ${pathway.countries.join(", ")}`;
      });
      summary = parts.join(" OR ");
      break;
    }
    case "qualification_completed":
      summary = "Must have completed the required prior qualification";
      break;
    default: {
      const neverKind: never = requirement.kind;
      summary = String(neverKind);
    }
  }

  return {
    id: requirement.id,
    kindLabel: requirementKindLabel(requirement.kind),
    summary,
    sourceText: formatRequirementDetailText(requirement, siblings),
    weight: requirement.weight,
    orGroup: requirement.alternativeGroupId,
  };
}

function summarizeVisibleRequirements(
  requirements: readonly RequirementInstance[],
): RequirementPlainSummary[] {
  return requirements
    .filter((requirement) => !shouldOmitPairedQualificationCompleted(requirements, requirement))
    .map((requirement) => summarizeRequirement(requirement, requirements));
}

export interface PathwayPlainSummary {
  id: string;
  label: string;
  requirements: RequirementPlainSummary[];
}

export interface CourseRequirementsPlainReview {
  courseCode: string;
  title: string;
  provider: string;
  entryRequirementsText: string;
  engine: "automated matcher" | "legacy fallback (limited)";
  pathwayLogic: string;
  globalRequirements: RequirementPlainSummary[];
  pathways: PathwayPlainSummary[];
  eligibilityQuestions: Array<{ label: string; options: string[] }>;
  checklistForApplicant: string[];
}

function buildChecklist(
  global: RequirementPlainSummary[],
  pathways: PathwayPlainSummary[],
): string[] {
  const items: string[] = [];

  if (pathways.length > 1) {
    items.push(
      `Applicant needs to meet ONE of ${pathways.length} entry pathways, plus any requirements that apply to all pathways.`,
    );
    for (const pathway of pathways) {
      const mustHaves = pathway.requirements.filter((requirement) => requirement.weight === "mandatory");
      items.push(
        `Pathway “${pathway.label}”: all of ${mustHaves.map((requirement) => requirement.summary).join("; ") || "see details"}.`,
      );
    }
  } else if (pathways.length === 1) {
    items.push("Single entry pathway — applicant must meet all listed requirements.");
  }

  if (global.length > 0) {
    items.push(
      `Also required for every pathway: ${global.map((requirement) => requirement.summary).join("; ")}.`,
    );
  }

  return items;
}

export function buildCourseRequirementsPlainReview(
  course: CourseCatalogEntry,
  options?: { usesMatcher?: boolean; rawRequirements?: unknown },
): CourseRequirementsPlainReview {
  const raw = options?.rawRequirements ?? course.requirements ?? [];
  let globalRequirements: RequirementPlainSummary[] = [];
  let pathways: PathwayPlainSummary[] = [];

  if (isCourseRequirementsV2(raw as unknown as CourseRequirementsV2)) {
    const v2 = raw as unknown as CourseRequirementsV2;
    globalRequirements = summarizeVisibleRequirements(v2.global);
    pathways = v2.pathways.map((pathway) => ({
      id: pathway.id,
      label: pathway.label ?? pathway.id,
      requirements: summarizeVisibleRequirements(pathway.requirements),
    }));
  } else {
    const flat = raw as RequirementInstance[];
    const byPathway = new Map<string, RequirementInstance[]>();
    const globalFlat: RequirementInstance[] = [];

    for (const requirement of flat) {
      if (requirement.pathwayBundleId) {
        const bucket = byPathway.get(requirement.pathwayBundleId) ?? [];
        bucket.push(requirement);
        byPathway.set(requirement.pathwayBundleId, bucket);
      } else {
        globalFlat.push(requirement);
      }
    }

    globalRequirements = summarizeVisibleRequirements(globalFlat);
    pathways = [...byPathway.entries()].map(([id, requirements]) => ({
      id,
      label: id,
      requirements: summarizeVisibleRequirements(requirements),
    }));

    if (pathways.length === 0 && flat.length > 0) {
      pathways = [
        {
          id: "default",
          label: "Entry requirements",
          requirements: summarizeVisibleRequirements(flat),
        },
      ];
    }
  }

  const pathwayLogic =
    pathways.length > 1
      ? `Meet ANY ONE pathway (${pathways.length} options)${globalRequirements.length > 0 ? ", AND all global requirements" : ""}.`
      : pathways.length === 1
        ? "Meet ALL requirements in the single pathway."
        : "No structured requirements — site uses simplified legacy rules only.";

  const questions = getCourseEligibilityQuestions(course).map((question) => ({
    label: question.label,
    options: question.options.map((option) => option.label),
  }));

  return {
    courseCode: course.code,
    title: course.title,
    provider: course.provider,
    entryRequirementsText: course.entryRequirements ?? "(No entry requirements text in catalog)",
    engine: options?.usesMatcher === false ? "legacy fallback (limited)" : "automated matcher",
    pathwayLogic,
    globalRequirements,
    pathways,
    eligibilityQuestions: questions,
    checklistForApplicant: buildChecklist(globalRequirements, pathways),
  };
}

export function flattenCourseRequirementsForReview(
  course: CourseCatalogEntry,
): RequirementInstance[] {
  const raw = course.requirements;
  if (!raw) {
    return [];
  }
  if (isCourseRequirementsV2(raw as unknown as CourseRequirementsV2)) {
    return flattenCourseRequirementsV2(raw as unknown as CourseRequirementsV2);
  }
  return raw as RequirementInstance[];
}
