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

const LOCAL_PARSER_FALLBACK_URL =
  import.meta.env.VITE_LOCAL_CV_PARSER_URL?.trim() ||
  "http://127.0.0.1:4190/api/parse-cv";

function isLocalhostRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

async function requestParseCv(formData: FormData) {
  const requestInit: RequestInit = {
    body: formData,
    method: "POST",
  };

  const primaryResponse = await fetch("/api/parse-cv", requestInit);

  if (primaryResponse.status !== 404 || !isLocalhostRuntime()) {
    return primaryResponse;
  }

  return fetch(LOCAL_PARSER_FALLBACK_URL, requestInit);
}

export async function parseEmploymentExperiencesFromCv(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await requestParseCv(formData);

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
      return "AI CV parsing isn't available on this local server. Start the local parser API (`npm run dev:cv-parser-api`) and try again.";
    }

    return error.message;
  }

  return "We saved your CV, but couldn't auto-fill employment history right now.";
}
