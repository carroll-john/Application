const LIST_DELIMITER_PATTERN = /\r?\n+|;|\||•|\u2022|\s\/\s/g;
const LIST_WITH_COMMA_DELIMITER_PATTERN =
  /\r?\n+|;|\||•|\u2022|\s\/\s|,\s+(?=(?:[A-Za-z]{3,}|(?:19|20)\d{2}|Present|Current|Now))/g;
const CURRENT_ROLE_PATTERN = /\b(present|current|now)\b/i;
const POSITION_SEGMENT_WITH_DATES_PATTERN =
  /([^;\n|]+?)\s*\(([^()]*?(?:19|20)\d{2}[^()]*)\)/g;
const DATE_RANGE_DELIMITER_PATTERN = /\s+(?:-|–|—|to|->|→)\s+/i;
const MONTH_TOKEN_PATTERN =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|0?[1-9]|1[0-2])\b/i;
const YEAR_TOKEN_PATTERN = /\b(19|20)\d{2}\b/;

export interface NormalizedExperienceEntry {
  company: string;
  currentRole: boolean;
  duties: string;
  endMonth: string;
  endYear: string;
  position: string;
  startMonth: string;
  startYear: string;
  type: string;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toBooleanValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export function normalizeExperienceEntry(entry: unknown): NormalizedExperienceEntry {
  const source = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};

  return {
    company: toStringValue(source.company ?? source.employer ?? source.organization),
    currentRole: toBooleanValue(
      source.currentRole ?? source.current_role ?? source.isCurrent ?? source.is_current,
    ),
    duties: toStringValue(
      source.duties ?? source.responsibilities ?? source.summary ?? source.description,
    ),
    endMonth: toStringValue(source.endMonth ?? source.end_month ?? source.toMonth),
    endYear: toStringValue(source.endYear ?? source.end_year ?? source.toYear),
    position: toStringValue(source.position ?? source.title ?? source.role),
    startMonth: toStringValue(
      source.startMonth ?? source.start_month ?? source.fromMonth,
    ),
    startYear: toStringValue(source.startYear ?? source.start_year ?? source.fromYear),
    type: toStringValue(source.type ?? source.employmentType ?? source.employment_type),
  };
}

function normalizeRequiredWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeWhitespace(value: string) {
  return normalizeRequiredWhitespace(value);
}

function splitListSegments(value: string, allowComma = false) {
  const trimmed = value.trim();

  if (!trimmed) {
    return [] as string[];
  }

  const segments = trimmed
    .split(allowComma ? LIST_WITH_COMMA_DELIMITER_PATTERN : LIST_DELIMITER_PATTERN)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);

  return segments.length > 0 ? segments : [trimmed];
}

function includesCurrentRoleMarker(value: string) {
  return CURRENT_ROLE_PATTERN.test(value);
}

function pickSegmentValue(segments: string[], index: number, fallback: string) {
  if (segments.length === 0) {
    return fallback;
  }

  if (segments.length === 1) {
    return segments[0];
  }

  if (index < segments.length) {
    return segments[index];
  }

  return segments[segments.length - 1];
}

function parseDatePart(value: string) {
  const normalized = normalizeWhitespace(value);
  const month = normalized.match(MONTH_TOKEN_PATTERN)?.[0] ?? "";
  const year = normalized.match(YEAR_TOKEN_PATTERN)?.[0] ?? "";

  return {
    currentRole: includesCurrentRoleMarker(normalized),
    month,
    year,
  };
}

function parseDateRange(value: string) {
  const normalized = normalizeWhitespace(value);
  const parts = normalized
    .split(DATE_RANGE_DELIMITER_PATTERN)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (parts.length < 2) {
    const parsed = parseDatePart(normalized);

    return {
      currentRole: parsed.currentRole,
      endMonth: "",
      endYear: "",
      startMonth: parsed.month,
      startYear: parsed.year,
    };
  }

  const start = parseDatePart(parts[0]);
  const end = parseDatePart(parts.slice(1).join(" "));
  const currentRole = end.currentRole || includesCurrentRoleMarker(parts.slice(1).join(" "));

  return {
    currentRole,
    endMonth: currentRole ? "" : end.month,
    endYear: currentRole ? "" : end.year,
    startMonth: start.month,
    startYear: start.year,
  };
}

function expandPositionDateSegments(entry: NormalizedExperienceEntry) {
  const segments: Array<{ dateRange: string; position: string }> = [];

  for (const match of entry.position.matchAll(POSITION_SEGMENT_WITH_DATES_PATTERN)) {
    const position = normalizeWhitespace(match[1] ?? "");
    const dateRange = normalizeWhitespace(match[2] ?? "");

    if (!position || !dateRange) {
      continue;
    }

    segments.push({ dateRange, position });
  }

  if (segments.length < 2) {
    return null;
  }

  return segments.map((segment, index) => {
    const parsedRange = parseDateRange(segment.dateRange);
    const currentRole = parsedRange.currentRole || (entry.currentRole && index === 0);
    const startMonth = parsedRange.startMonth || entry.startMonth;
    const startYear = parsedRange.startYear || entry.startYear;
    const endMonth = currentRole ? "" : parsedRange.endMonth || entry.endMonth;
    const endYear = currentRole ? "" : parsedRange.endYear || entry.endYear;

    return {
      ...entry,
      currentRole,
      endMonth,
      endYear,
      position: segment.position,
      startMonth,
      startYear,
    };
  });
}

function expandDelimitedRoleLists(entry: NormalizedExperienceEntry) {
  const positionSegments = splitListSegments(entry.position);

  if (positionSegments.length < 2) {
    return null;
  }

  const startMonthSegments = splitListSegments(entry.startMonth, true);
  const startYearSegments = splitListSegments(entry.startYear, true);
  const endMonthSegments = splitListSegments(entry.endMonth, true);
  const endYearSegments = splitListSegments(entry.endYear, true);
  const dutiesSegments = splitListSegments(entry.duties);

  const supportingLists = [
    startMonthSegments,
    startYearSegments,
    endMonthSegments,
    endYearSegments,
    dutiesSegments,
  ].filter((segments) => segments.length > 1);

  const hasAlignedSupport = supportingLists.some(
    (segments) => segments.length === positionSegments.length,
  );

  if (!hasAlignedSupport) {
    return null;
  }

  return positionSegments.map((position, index) => {
    const startMonth = pickSegmentValue(startMonthSegments, index, entry.startMonth);
    const startYear = pickSegmentValue(startYearSegments, index, entry.startYear);
    const endMonthCandidate = pickSegmentValue(endMonthSegments, index, entry.endMonth);
    const endYearCandidate = pickSegmentValue(endYearSegments, index, entry.endYear);
    const duties = pickSegmentValue(dutiesSegments, index, entry.duties);

    const inferredCurrentRole =
      includesCurrentRoleMarker(endMonthCandidate) ||
      includesCurrentRoleMarker(endYearCandidate);
    const currentRole = inferredCurrentRole || (entry.currentRole && index === 0);

    return {
      ...entry,
      currentRole,
      duties,
      endMonth: currentRole ? "" : endMonthCandidate,
      endYear: currentRole ? "" : endYearCandidate,
      position,
      startMonth,
      startYear,
    };
  });
}

function createExperienceSignature(entry: NormalizedExperienceEntry) {
  return [
    entry.company,
    entry.position,
    entry.type,
    entry.startMonth,
    entry.startYear,
    entry.endMonth,
    entry.endYear,
    entry.currentRole ? "current" : "ended",
    entry.duties,
  ]
    .map((value) => value.trim().toLowerCase())
    .join("|");
}

export function expandCollapsedRoles(entries: NormalizedExperienceEntry[]) {
  const expanded = entries.flatMap((entry) => {
    const fromPositionDates = expandPositionDateSegments(entry);

    if (fromPositionDates) {
      return fromPositionDates;
    }

    const fromDelimitedLists = expandDelimitedRoleLists(entry);

    if (fromDelimitedLists) {
      return fromDelimitedLists;
    }

    return [entry];
  });

  const seen = new Set<string>();

  return expanded.filter((entry) => {
    const signature = createExperienceSignature(entry);

    if (seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
}

function isLikelyExperienceArray(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  return value.some((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const candidate = item as Record<string, unknown>;

    return Boolean(
      candidate.company ??
        candidate.employer ??
        candidate.organization ??
        candidate.position ??
        candidate.title ??
        candidate.role,
    );
  });
}

export function findExperienceArray(source: unknown): unknown[] | null {
  if (isLikelyExperienceArray(source)) {
    return source as unknown[];
  }

  if (!source || typeof source !== "object") {
    return null;
  }

  const record = source as Record<string, unknown>;
  const preferredKeys = [
    "experiences",
    "employmentExperiences",
    "employment_experiences",
    "employmentHistory",
    "employment_history",
    "workExperience",
    "work_experience",
    "jobs",
    "roles",
  ];

  for (const key of preferredKeys) {
    if (isLikelyExperienceArray(record[key])) {
      return record[key] as unknown[];
    }
  }

  for (const value of Object.values(record)) {
    if (isLikelyExperienceArray(value)) {
      return value as unknown[];
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = findExperienceArray(value);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}
