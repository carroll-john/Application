import { useEffect, useMemo, useRef } from "react";
import type { ApplicationData } from "../../../lib/applicationData";
import { getCourseByCode } from "../../../lib/courseCatalog";
import {
  createWorkExperienceInputFingerprint,
  type WorkExperienceAssessment,
} from "../../../lib/eligibility/workExperience";
import type { RequirementInstance } from "../../../lib/eligibility/requirements";
import {
  WorkExperienceAssessmentRequestError,
  requestWorkExperienceAssessment,
} from "../../../lib/workExperienceAssessmentClient";
import {
  trackWorkExperienceAssessmentCompleted,
  trackWorkExperienceAssessmentFailed,
} from "../../../lib/posthog";

type WorkRequirement = Extract<RequirementInstance, { kind: "work_experience" }>;

function expectedFingerprint(requirement: WorkRequirement, data: ApplicationData) {
  return createWorkExperienceInputFingerprint({
    asOfMonth: new Date().toISOString().slice(0, 7),
    requirement,
    roles: data.employmentExperiences.map((role) => ({
      id: role.id,
      position: role.position,
      duties: role.duties,
      startMonth: role.startMonth,
      startYear: role.startYear,
      endMonth: role.endMonth,
      endYear: role.endYear,
      currentRole: role.currentRole,
    })),
  });
}

export function useWorkExperienceAssessment(options: {
  data: ApplicationData;
  isHydrating: boolean;
  setWorkExperienceAssessments: (
    assessments: Record<string, WorkExperienceAssessment>,
  ) => Promise<void>;
}) {
  const { data, isHydrating, setWorkExperienceAssessments } = options;
  const requestKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const requirements = useMemo(() => {
    const course = getCourseByCode(data.applicationMeta.selectedCourse?.code ?? null);
    const selectedPathwayId = data.tertiaryQualifications
      .map((qualification) => qualification.transcriptEligibility)
      .filter(Boolean)
      .sort((left, right) => right!.checkedAt.localeCompare(left!.checkedAt))[0]
      ?.selectedPathwayId;
    return (course?.requirements ?? []).filter(
      (requirement): requirement is WorkRequirement =>
        requirement.kind === "work_experience" &&
        (!selectedPathwayId ||
          !requirement.pathwayBundleId ||
          requirement.pathwayBundleId === selectedPathwayId),
    );
  }, [data.applicationMeta.selectedCourse?.code, data.tertiaryQualifications]);

  useEffect(() => {
    if (isHydrating || requirements.length === 0 || data.employmentExperiences.length === 0) {
      return;
    }

    const fingerprints = requirements.map((requirement) =>
      expectedFingerprint(requirement, data),
    );
    const requestKey = fingerprints.join("|");
    const isCurrent = requirements.every(
      (requirement, index) =>
        data.workExperienceAssessments[requirement.id]?.inputFingerprint === fingerprints[index],
    );
    if (isCurrent || requestKeyRef.current === requestKey) return;

    requestKeyRef.current = requestKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const startedAt = Date.now();
    void requestWorkExperienceAssessment({
      requirements,
      roles: data.employmentExperiences,
    })
      .then(async (assessments) => {
        if (requestIdRef.current !== requestId) return;
        trackWorkExperienceAssessmentCompleted({
          assessments,
          latencyMs: Date.now() - startedAt,
          roleCount: data.employmentExperiences.length,
        });
        await setWorkExperienceAssessments(
          Object.fromEntries(assessments.map((assessment) => [assessment.requirementId, assessment])),
        );
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return;
        trackWorkExperienceAssessmentFailed({
          errorCode:
            error instanceof WorkExperienceAssessmentRequestError
              ? error.code
              : undefined,
          latencyMs: Date.now() - startedAt,
          roleCount: data.employmentExperiences.length,
        });
        // Assessment is advisory. Existing employment data remains saved and admissions can review it.
      })
      .finally(() => {
        if (requestIdRef.current === requestId) requestKeyRef.current = null;
      });
  }, [data, isHydrating, requirements, setWorkExperienceAssessments]);
}
