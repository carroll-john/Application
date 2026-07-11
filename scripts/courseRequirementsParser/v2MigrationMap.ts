import type { CourseRequirementsV2 } from "../../src/lib/eligibility/courseRequirementsV2";
import type { RequirementInstance } from "../../src/lib/eligibility/requirements";

type RequirementMap = Record<string, RequirementInstance>;

function pick(map: RequirementMap, ids: string[]): RequirementInstance[] {
  return ids.map((id) => {
    const requirement = map[id];
    if (!requirement) {
      throw new Error(`Missing requirement id "${id}"`);
    }
    return { ...requirement, pathwayBundleId: undefined, alternativeGroupId: requirement.alternativeGroupId };
  });
}

function indexById(requirements: RequirementInstance[]): RequirementMap {
  return Object.fromEntries(requirements.map((requirement) => [requirement.id, requirement]));
}

function stripPathwayBundle(requirement: RequirementInstance): RequirementInstance {
  const { pathwayBundleId: _pathwayBundleId, ...rest } = requirement;
  return rest;
}

/** Hand-curated v2 pathway splits for multi-pathway fallback courses. */
export function convertFlatToV2(
  courseCode: string,
  flat: RequirementInstance[],
): CourseRequirementsV2 | null {
  const byId = indexById(flat);

  switch (courseCode) {
    case "master-of-health-management":
      return {
        version: 2,
        global: pick(byId, ["english-proficiency"]),
        pathways: [
          {
            id: "pathway-12cp",
            label: "1.5 years full-time (12 credit points)",
            requirements: pick(byId, [
              "completed-bachelor",
              "field-related-discipline",
              "work-experience-2-years",
            ]),
          },
          {
            id: "pathway-16cp",
            label: "2 years full-time (16 credit points)",
            requirements: pick(byId, ["completed-bachelor-any-discipline"]),
          },
        ],
      };

    case "master-of-business-administration-digital":
      return {
        version: 2,
        global: [],
        pathways: [
          {
            id: "mba-level-1",
            label: "Entry Level 1",
            requirements: flat
              .filter((requirement) => requirement.pathwayBundleId === "mba-level-1")
              .map(stripPathwayBundle),
          },
          {
            id: "mba-level-2",
            label: "Entry Level 2",
            requirements: flat
              .filter((requirement) => requirement.pathwayBundleId === "mba-level-2")
              .map(stripPathwayBundle),
          },
        ],
      };

    case "deakin-university-master-of-data-science":
      return {
        version: 2,
        global: [],
        pathways: [
          {
            id: "entry-16cp",
            label: "16-credit point entry",
            requirements: pick(byId, ["completed-bachelor", "qualification-level-bachelor"]),
          },
          {
            id: "entry-12cp",
            label: "12-credit point entry",
            requirements: flat.filter(
              (requirement) => requirement.alternativeGroupId === "entry-12-credit",
            ),
          },
          {
            id: "entry-8cp",
            label: "8-credit point entry",
            requirements: flat.filter(
              (requirement) => requirement.alternativeGroupId === "entry-8-credit",
            ),
          },
        ],
      };

    case "deakin-university-master-of-cyber-security": {
      const alt12 = flat.filter((r) => r.alternativeGroupId === "alt-12-credit-requirement");
      const alt8a = flat.filter((r) => r.alternativeGroupId === "alt-8-credit-entry-1");
      const alt8b = flat.filter((r) => r.alternativeGroupId === "alt-8-credit-entry-2");
      const entry16 = flat.filter(
        (r) =>
          !r.alternativeGroupId &&
          r.weight === "mandatory" &&
          r.sourceText.toLowerCase().includes("16-credit"),
      );
      return {
        version: 2,
        global: [],
        pathways: [
          { id: "entry-16cp", label: "16-credit point entry", requirements: entry16 },
          { id: "entry-12cp", label: "12-credit point entry", requirements: alt12 },
          {
            id: "entry-8cp-a",
            label: "8-credit point entry (graduate qualification)",
            requirements: alt8a,
          },
          {
            id: "entry-8cp-b",
            label: "8-credit point entry (honours)",
            requirements: alt8b,
          },
        ],
      };
    }

    case "monash-online-monash-university-master-of-human-resource-management":
      return {
        version: 2,
        global: pick(byId, ["english-proficiency"]),
        pathways: [
          {
            id: "entry-level-1",
            label: "Entry level 1 (72 points)",
            requirements: pick(byId, [
              "qualification_completed",
              "qualification_level-bachelor",
              "academic_threshold-wam-60",
              "work_experience-2",
            ]),
          },
          {
            id: "entry-level-2",
            label: "Entry level 2",
            requirements: pick(byId, [
              "qualification_completed-graduate-certificate-hrm",
              "academic_threshold-wam-60-graduate-certificate",
            ]),
          },
        ],
      };

    case "master-of-business-management-with-discipline-studies-in-project-management": {
      const global = pick(byId, ["english-proficiency-monash-req"]);
      const mandatory = pick(byId, [
        "completed-bachelor",
        "qualification-level-bachelor",
        "field-of-study-business-commerce-management",
        "academic-threshold-credit-60",
      ]);
      const altGroups = ["alt-group-1", "alt-group-2", "alt-group-3"] as const;
      const pathways = [
        {
          id: "entry-level-1",
          label: "Entry level 1 (72 points)",
          requirements: mandatory,
        },
        ...altGroups.map((groupId, index) => ({
          id: groupId,
          label: `Alternative entry pathway ${index + 1}`,
          requirements: flat.filter((requirement) => requirement.alternativeGroupId === groupId),
        })),
      ];
      return { version: 2, global, pathways };
    }

    case "unsw-online-university-of-new-south-wales-master-of-data-science": {
      const grp1 = flat.filter((r) => r.alternativeGroupId === "grp-1");
      const grp2 = flat.filter((r) => r.alternativeGroupId === "grp-2");
      const global = flat.filter((r) => !r.alternativeGroupId && r.kind === "english_proficiency");
      return {
        version: 2,
        global,
        pathways: [
          { id: "pathway-grad-dip", label: "Graduate Diploma pathway", requirements: grp1 },
          { id: "pathway-undergrad", label: "Undergraduate degree pathway", requirements: grp2 },
        ],
      };
    }

    case "uts-online-university-of-technology-sydney-master-of-business-administration-mba": {
      const groups = ["alt-group-1", "alt-group-2", "alt-group-3", "alt-group-4"] as const;
      const pathways = groups
        .map((groupId, index) => ({
          id: groupId,
          label: `Entry pathway ${index + 1}`,
          requirements: flat.filter((r) => r.alternativeGroupId === groupId),
        }))
        .filter((pathway) => pathway.requirements.length > 0);
      const global = flat.filter((r) => !r.alternativeGroupId);
      return { version: 2, global, pathways };
    }

    case "university-of-melbourne-master-of-public-health": {
      const workOrHealthcare = flat.filter(
        (r) => r.alternativeGroupId === "work-experience-or-healthcare",
      );
      const mastersOrPhd = flat.filter(
        (r) => r.alternativeGroupId === "masters-or-phd-health",
      );
      const global = flat.filter(
        (r) =>
          !r.alternativeGroupId &&
          (r.kind === "english_proficiency" || r.kind === "academic_threshold"),
      );
      const undergradPathway = flat.filter(
        (r) =>
          !r.alternativeGroupId &&
          r.kind !== "english_proficiency" &&
          !workOrHealthcare.includes(r) &&
          !mastersOrPhd.includes(r),
      );
      return {
        version: 2,
        global,
        pathways: [
          {
            id: "undergrad-public-health",
            label: "Undergraduate public health or equivalent",
            requirements: undergradPathway,
          },
          {
            id: "work-or-healthcare",
            label: "Degree plus work experience or healthcare qualification",
            requirements: workOrHealthcare,
          },
          {
            id: "masters-or-phd",
            label: "Masters or PhD in health",
            requirements: mastersOrPhd,
          },
        ].filter((pathway) => pathway.requirements.length > 0),
      };
    }

    case "master-of-business-marketing": {
      const bySource = new Map<string, RequirementInstance[]>();
      for (const requirement of flat) {
        if (requirement.kind === "english_proficiency") {
          continue;
        }
        const key = requirement.sourceText.trim().toLowerCase();
        const bucket = bySource.get(key) ?? [];
        bucket.push(requirement);
        bySource.set(key, bucket);
      }

      const pathways = [...bySource.entries()].map(([sourceText, requirements], index) => {
        const normalized = requirements.map((requirement) => {
          if (sourceText.includes("graduate certificate or graduate diploma")) {
            const isGradQual =
              requirement.kind === "qualification_completed" &&
              (requirement.id.includes("graduate-certificate") ||
                requirement.id.includes("graduate-diploma"));
            if (isGradQual) {
              return {
                ...requirement,
                weight: "alternative" as const,
                alternativeGroupId: "grad-qual-or",
              };
            }
          }
          return requirement;
        });
        return {
          id: `pathway-${index + 1}`,
          label: requirements[0]?.sourceText.slice(0, 80) ?? `Pathway ${index + 1}`,
          requirements: normalized,
        };
      });

      return {
        version: 2,
        global: flat.filter((requirement) => requirement.kind === "english_proficiency"),
        pathways,
      };
    }

    default:
      return null;
  }
}
