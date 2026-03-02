import { normalizeParsedEmploymentExperiences } from "./cvParser";

export class CvParserRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CvParserRequestError";
    this.status = status;
  }
}

function parseErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = payload.error;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return null;
}

export async function parseEmploymentExperiencesFromCv(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/parse-cv", {
    body: formData,
    method: "POST",
  });

  let payload: unknown = null;

  try {
    payload = (await response.json()) as unknown;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new CvParserRequestError(
      parseErrorMessage(payload) ?? "We couldn't parse this CV right now.",
      response.status,
    );
  }

  const parserPayload =
    payload && typeof payload === "object" ? payload : { experiences: [] };
  const rawExperiences = Array.isArray(
    (parserPayload as { experiences?: unknown[] }).experiences,
  )
    ? ((parserPayload as { experiences: unknown[] }).experiences ?? [])
    : [];

  return {
    experiences: normalizeParsedEmploymentExperiences(
      rawExperiences.map((experience) => {
        const candidate =
          experience && typeof experience === "object" ? experience : {};

        return {
          company:
            "company" in candidate && typeof candidate.company === "string"
              ? candidate.company
              : "",
          currentRole:
            "currentRole" in candidate && typeof candidate.currentRole === "boolean"
              ? candidate.currentRole
              : false,
          duties:
            "duties" in candidate && typeof candidate.duties === "string"
              ? candidate.duties
              : "",
          endMonth:
            "endMonth" in candidate && typeof candidate.endMonth === "string"
              ? candidate.endMonth
              : "",
          endYear:
            "endYear" in candidate && typeof candidate.endYear === "string"
              ? candidate.endYear
              : "",
          position:
            "position" in candidate && typeof candidate.position === "string"
              ? candidate.position
              : "",
          startMonth:
            "startMonth" in candidate && typeof candidate.startMonth === "string"
              ? candidate.startMonth
              : "",
          startYear:
            "startYear" in candidate && typeof candidate.startYear === "string"
              ? candidate.startYear
              : "",
          type:
            "type" in candidate && typeof candidate.type === "string"
              ? candidate.type
              : "",
        };
      }),
    ),
    model:
      "model" in parserPayload && typeof parserPayload.model === "string"
        ? parserPayload.model
        : undefined,
  };
}

export function getCvParserErrorMessage(error: unknown) {
  if (error instanceof CvParserRequestError) {
    if (error.status === 404) {
      return "AI CV parsing isn't available in this local server. Save the CV and try again in Vercel preview or production.";
    }

    return error.message;
  }

  return "We saved your CV, but couldn't auto-fill employment history right now.";
}
