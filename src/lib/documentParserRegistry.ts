import type {
  ProfessionalAccreditation,
  SecondaryQualification,
  TertiaryQualification,
} from "./applicationData";
import {
  normalizeMonth,
  normalizeParsedEmploymentExperience,
  normalizeYear,
  type ParsedCvEmploymentExperience,
} from "./documentParsers/cv";
import { normalizeWhitespace } from "./cvEmployment/text";
import type {
  CvRecognitionDraft,
  CvRecognitionExperience,
  CvRecognitionProfile,
  OscaConfidence,
  OscaSkillLevel,
} from "./ucRplAssessment";

export type ParseableDocumentKind = "cv";

export type CvParserDraft = CvRecognitionDraft;

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: unknown, key: string) {
  const record = asRecord(value);
  return typeof record[key] === "string" ? normalizeWhitespace(record[key]) : "";
}

function arrayField(value: unknown, key: string) {
  const record = asRecord(value);
  return Array.isArray(record[key]) ? record[key] : [];
}

function normalizeOscaSkillLevel(value: unknown): OscaSkillLevel | null {
  return typeof value === "number" && [1, 2, 3, 4, 5].includes(value)
    ? (value as OscaSkillLevel)
    : null;
}

function normalizeOscaConfidence(value: unknown): OscaConfidence {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : "low";
}

function normalizeQualificationLevel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("associate")) return "Associate Degree";
  if (normalized.includes("advanced diploma")) return "Advanced Diploma";
  if (normalized.includes("graduate certificate")) return "Graduate Certificate";
  if (normalized.includes("graduate diploma")) return "Graduate Diploma";
  if (normalized.includes("honour")) return "Honours";
  if (normalized.includes("bachelor")) return "Bachelor";
  if (normalized.includes("master")) return "Masters";
  if (normalized.includes("phd") || normalized.includes("doctor")) return "PhD";
  if (normalized.includes("diploma")) return "Diploma";
  return "";
}

function normalizeRecognitionExperiences(rawExperiences: unknown[]) {
  const mapped = mapRawCvExperiences(rawExperiences);

  return mapped.reduce<CvRecognitionExperience[]>((experiences, raw, index) => {
    const normalized = normalizeParsedEmploymentExperience(raw);
    if (!normalized) return experiences;
    const source = asRecord(rawExperiences[index]);

    experiences.push({
      ...normalized,
      includeInAssessment: true,
      oscaConfidence: normalizeOscaConfidence(source.oscaConfidence),
      oscaOccupationCode: stringField(source, "oscaOccupationCode"),
      oscaOccupationTitle: stringField(source, "oscaOccupationTitle"),
      oscaRationale: stringField(source, "oscaRationale"),
      oscaSkillLevel: normalizeOscaSkillLevel(source.oscaSkillLevel),
    });
    return experiences;
  }, []);
}

function normalizeProfile(value: unknown): CvRecognitionProfile {
  return {
    firstName: stringField(value, "firstName"),
    lastName: stringField(value, "lastName"),
    middleName: stringField(value, "middleName"),
    phone: stringField(value, "phone"),
    title: stringField(value, "title"),
  };
}

function normalizeTertiaryQualifications(value: unknown): TertiaryQualification[] {
  return arrayField(value, "tertiaryQualifications").map((item) => ({
    id: crypto.randomUUID(),
    completed: asRecord(item).completed === true,
    country: stringField(item, "country"),
    courseName: stringField(item, "courseName"),
    endMonth: normalizeMonth(stringField(item, "endMonth")),
    endYear: normalizeYear(stringField(item, "endYear")),
    institution: stringField(item, "institution"),
    level: normalizeQualificationLevel(stringField(item, "level")),
    startMonth: normalizeMonth(stringField(item, "startMonth")),
    startYear: normalizeYear(stringField(item, "startYear")),
  }));
}

function normalizeSecondaryQualifications(value: unknown): SecondaryQualification[] {
  return arrayField(value, "secondaryQualifications").map((item) => ({
    id: crypto.randomUUID(),
    country: stringField(item, "country"),
    qualification: stringField(item, "qualification"),
    school: stringField(item, "school"),
    state: stringField(item, "state"),
    type: stringField(item, "type"),
    year: normalizeYear(stringField(item, "year")),
  }));
}

function normalizeProfessionalAccreditations(
  value: unknown,
): ProfessionalAccreditation[] {
  return arrayField(value, "professionalAccreditations").map((item) => ({
    id: crypto.randomUUID(),
    name: stringField(item, "name"),
    status: stringField(item, "status"),
  }));
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
        experiences: normalizeRecognitionExperiences(rawExperiences),
        model:
          "model" in parserPayload && typeof parserPayload.model === "string"
            ? parserPayload.model
            : undefined,
        professionalAccreditations:
          normalizeProfessionalAccreditations(parserPayload),
        profile: normalizeProfile(
          "applicant" in parserPayload ? parserPayload.applicant : undefined,
        ),
        secondaryQualifications: normalizeSecondaryQualifications(parserPayload),
        tertiaryQualifications: normalizeTertiaryQualifications(parserPayload),
      };
    },
  },
} satisfies Record<ParseableDocumentKind, DocumentParserConfig<CvParserDraft>>;

export function getDocumentParserConfig(kind: string) {
  return documentParserRegistry[kind as ParseableDocumentKind];
}
