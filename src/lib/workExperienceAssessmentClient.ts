import type { EmploymentExperience } from "./applicationData";
import type { RequirementInstance } from "./eligibility/requirements";
import type { WorkExperienceAssessment } from "./eligibility/workExperience";
import { supabase } from "./supabase";

type WorkRequirement = Extract<RequirementInstance, { kind: "work_experience" }>;

export class WorkExperienceAssessmentRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "WorkExperienceAssessmentRequestError";
    this.status = status;
    this.code = code;
  }
}

async function getAccessToken() {
  const session = await supabase?.auth.getSession();
  return session?.data.session?.access_token ?? null;
}

function parseError(payload: unknown) {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.error === "string" ? record.error : undefined,
  };
}

function isLocalhostRuntime() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

const localAssessmentUrl =
  import.meta.env.VITE_LOCAL_WORK_EXPERIENCE_ASSESSMENT_URL?.trim() ||
  "http://127.0.0.1:4190/api/evaluate-work-experience";

export async function requestWorkExperienceAssessment(options: {
  requirements: WorkRequirement[];
  roles: EmploymentExperience[];
}): Promise<WorkExperienceAssessment[]> {
  if (options.requirements.length === 0) return [];

  const accessToken = await getAccessToken();
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      requirements: options.requirements,
      roles: options.roles.map((role) => ({
        id: role.id,
        position: role.position,
        duties: role.duties,
        startMonth: role.startMonth,
        startYear: role.startYear,
        endMonth: role.endMonth,
        endYear: role.endYear,
        currentRole: role.currentRole,
      })),
    }),
  };
  const primaryResponse = await fetch("/api/evaluate-work-experience", requestInit);
  const response = primaryResponse.status === 404 && isLocalhostRuntime()
    ? await fetch(localAssessmentUrl, requestInit)
    : primaryResponse;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // The typed error below supplies a safe fallback message.
  }

  if (!response.ok) {
    const error = parseError(payload);
    throw new WorkExperienceAssessmentRequestError(
      error.message ?? "We couldn't assess work experience right now.",
      response.status,
      error.code,
    );
  }

  const assessments = payload && typeof payload === "object"
    ? (payload as { assessments?: unknown }).assessments
    : undefined;
  return Array.isArray(assessments) ? assessments as WorkExperienceAssessment[] : [];
}
