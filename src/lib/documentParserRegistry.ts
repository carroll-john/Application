import type { EmploymentExperience } from "./applicationData";
import {
  normalizeParsedEmploymentExperiences,
  type ParsedCvEmploymentExperience,
} from "./documentParsers/cv";

export type ParseableDocumentKind = "cv";

export interface CvParserDraft {
  experiences: EmploymentExperience[];
  model?: string;
}

export interface DocumentParserConfig<TDraft> {
  apiPath: string;
  errorFallbackMessage: string;
  kind: ParseableDocumentKind;
  localFallbackUrl?: string;
  normalizeResponse: (payload: unknown) => TDraft;
}

function mapRawCvExperiences(rawExperiences: unknown[]): ParsedCvEmploymentExperience[] {
  return rawExperiences.map((experience) => {
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
  });
}

export const documentParserRegistry = {
  cv: {
    apiPath: "/api/parse-cv",
    errorFallbackMessage: "We couldn't parse this CV right now.",
    kind: "cv",
    localFallbackUrl:
      import.meta.env.VITE_LOCAL_CV_PARSER_URL?.trim() ||
      "http://127.0.0.1:4190/api/parse-cv",
    normalizeResponse: (payload: unknown): CvParserDraft => {
      const parserPayload =
        payload && typeof payload === "object" ? payload : { experiences: [] };
      const rawExperiences = Array.isArray(
        (parserPayload as { experiences?: unknown[] }).experiences,
      )
        ? ((parserPayload as { experiences: unknown[] }).experiences ?? [])
        : [];

      return {
        experiences: normalizeParsedEmploymentExperiences(
          mapRawCvExperiences(rawExperiences),
        ),
        model:
          "model" in parserPayload && typeof parserPayload.model === "string"
            ? parserPayload.model
            : undefined,
      };
    },
  },
} satisfies Record<ParseableDocumentKind, DocumentParserConfig<CvParserDraft>>;

export function getDocumentParserConfig(kind: string) {
  return documentParserRegistry[kind as ParseableDocumentKind];
}
