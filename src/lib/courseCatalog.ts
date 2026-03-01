import rawCourseData from "../data/courses.raw.json";
import type {
  CourseEducationLevel,
  CourseEligibilityConfig,
  CourseExperienceLevel,
} from "./courseEligibility";

interface RawValueItem {
  value?: string | null;
}

interface RawCourseEntry {
  core_subjects_modules?: RawValueItem[] | null;
  course_description?: string | null;
  course_duration?: string | null;
  course_name: string;
  entry_requirements?: string | null;
  fee_help_eligibility?: string | null;
  intake_start_dates?: RawValueItem[] | null;
  outcomes?: string | null;
  provider_name: string;
  recognition_of_prior_learning?: string | null;
  subject_area?: string | null;
  tuition_fees?: string | null;
}

interface RawCourseCatalogData {
  courses: RawCourseEntry[];
}

export interface CourseCatalogEntry {
  code: string;
  title: string;
  provider: string;
  providerCode?: string;
  categories: string[];
  delivery: string;
  duration?: string;
  price?: string;
  studyLevel?: string;
  courseType?: string;
  intakeLabel: string;
  summary?: string;
  description?: string;
  subjectArea?: string;
  entryRequirements?: string;
  recognitionOfPriorLearning?: string;
  coreSubjects: string[];
  intakeDates: string[];
  tuitionFees?: string;
  feeHelpEligibility?: string;
  feeSummary?: string;
  supportSummary?: string;
  supportOptions: string[];
  feeNotes: string[];
  outcomes?: string;
  eligibility: CourseEligibilityConfig;
}

const DEFAULT_GOALS: readonly string[] = [
  "Career advancement",
  "Career change",
  "Expand knowledge",
];

const UNDERGRADUATE_GOALS: readonly string[] = [
  "Start a new qualification",
  "Career change",
  "Expand knowledge",
];

const DEFAULT_EDUCATION_OPTIONS: readonly CourseEducationLevel[] = [
  "High school",
  "Diploma",
  "Bachelor degree",
  "Masters degree",
  "Doctorate",
];

const DEFAULT_EXPERIENCE_OPTIONS: readonly CourseExperienceLevel[] = [
  "Less than 2 years",
  "2-5 years",
  "5+ years",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizeText(value?: string | null) {
  return value?.trim() || "";
}

function inferCategories(subjectArea: string) {
  const normalized = subjectArea.toLowerCase();
  const categories: string[] = [];

  if (
    /\b(business|management|commerce|economics|marketing|leadership|human resource|project management)\b/i.test(
      normalized,
    )
  ) {
    categories.push("Business");
  }

  if (
    /\b(technology|information technology|information and communication technology|ict|data|analytics|artificial intelligence|machine learning|cyber|digital|engineering|cloud)\b/i.test(
      normalized,
    )
  ) {
    categories.push("Technology");
  }

  if (
    /\b(health|healthcare|public health|nursing|clinical|human services)\b/i.test(
      normalized,
    )
  ) {
    categories.push("Health");
  }

  return Array.from(new Set(categories));
}

function getFirstSentence(value: string, maxLength = 200) {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const sentenceMatch = normalized.match(/^.*?[.!?](?=\s|$)/);
  const candidate = sentenceMatch?.[0]?.trim() || normalized;

  if (candidate.length <= maxLength) {
    return candidate;
  }

  return `${candidate.slice(0, maxLength - 1).trim()}…`;
}

function normalizeMoneyDisplay(value: string) {
  return value
    .replace(/\b(?:AUD|AU\$)\s*/gi, "$")
    .replace(/\s*[–-]\s*/g, "–")
    .replace(/(\d)\.00\b/g, "$1")
    .trim();
}

function extractMoneyValue(value: string) {
  const match = value.match(
    /(?:AUD|AU\$|\$)\s*\d[\d,]*(?:\.\d+)?(?:\s*[–-]\s*(?:AUD|AU\$|\$)?\s*\d[\d,]*(?:\.\d+)?)?/i,
  );

  return match ? normalizeMoneyDisplay(match[0]) : "";
}

function parseMoneyAmount(value: string) {
  const normalized = extractMoneyValue(value);

  if (!normalized) {
    return null;
  }

  const numeric = normalized.match(/\$([\d,]+(?:\.\d+)?)/);

  if (!numeric?.[1]) {
    return null;
  }

  return Number.parseFloat(numeric[1].replace(/,/g, ""));
}

const SUPPORT_OPTION_ORDER = ["CSP", "FEE-HELP", "HECS-HELP"] as const;

function formatCurrencyAmount(value: number) {
  return new Intl.NumberFormat("en-AU", {
    currency: "AUD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function findSentence(value: string, pattern: RegExp) {
  if (!value) {
    return "";
  }

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.find((sentence) => pattern.test(sentence)) ?? "";
}

function toValueList(items?: RawValueItem[] | null) {
  return (items ?? [])
    .map((item) => sanitizeText(item.value))
    .filter(Boolean);
}

const MONTH_PATTERNS: Array<{ month: string; pattern: RegExp }> = [
  { month: "January", pattern: /\b(january|jan)\b/i },
  { month: "February", pattern: /\b(february|feb)\b/i },
  { month: "March", pattern: /\b(march|mar)\b/i },
  { month: "April", pattern: /\b(april|apr)\b/i },
  { month: "May", pattern: /\bmay\b/i },
  { month: "June", pattern: /\b(june|jun)\b/i },
  { month: "July", pattern: /\b(july|jul)\b/i },
  { month: "August", pattern: /\b(august|aug)\b/i },
  { month: "September", pattern: /\b(september|sep)\b/i },
  { month: "October", pattern: /\b(october|oct)\b/i },
  { month: "November", pattern: /\b(november|nov)\b/i },
  { month: "December", pattern: /\b(december|dec)\b/i },
];

const TERM_MONTH_FALLBACKS: Array<{ month: string; pattern: RegExp }> = [
  { month: "January", pattern: /\bsummer\b/i },
  { month: "March", pattern: /\b(term|session|semester)\s*1\b/i },
  { month: "May", pattern: /\bterm\s*2\b/i },
  { month: "July", pattern: /\b(term|session|semester)\s*2\b|\bterm\s*3\b/i },
  { month: "September", pattern: /\bterm\s*4\b/i },
  { month: "November", pattern: /\bterm\s*5\b|\bsummer\b/i },
];

const courseEntries = (rawCourseData as RawCourseCatalogData).courses;

const baseCodeCounts = courseEntries.reduce<Record<string, number>>((counts, course) => {
  const baseCode = slugify(course.course_name);
  counts[baseCode] = (counts[baseCode] ?? 0) + 1;
  return counts;
}, {});

function normalizeIntakeLabel(intakeDates: string[]) {
  for (const intake of intakeDates) {
    for (const { month, pattern } of MONTH_PATTERNS) {
      if (pattern.test(intake)) {
        const yearMatch = intake.match(/\b(20\d{2})\b/);
        return yearMatch ? `${month} ${yearMatch[1]}` : month;
      }
    }
  }

  for (const intake of intakeDates) {
    for (const { month, pattern } of TERM_MONTH_FALLBACKS) {
      if (pattern.test(intake)) {
        return month;
      }
    }
  }

  return intakeDates[0] || "Upcoming intake";
}

function formatYearsValue(value: number) {
  return Number.isInteger(value) ? `${value}` : `${value}`;
}

function monthsToYears(months: number) {
  return Number.parseFloat((months / 12).toFixed(1));
}

function normalizeDurationLabel(rawDuration?: string | null) {
  const duration = sanitizeText(rawDuration);

  if (!duration) {
    return undefined;
  }

  const fullTimeEquivalentRangeMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*(?:to|[–-])\s*(\d+(?:\.\d+)?)\s*years?\s*full-time.*part-time equivalent/i,
  );
  if (fullTimeEquivalentRangeMatch?.[1] && fullTimeEquivalentRangeMatch?.[2]) {
    return `${fullTimeEquivalentRangeMatch[1]}-${fullTimeEquivalentRangeMatch[2]} years full-time or part-time equivalent`;
  }

  const fullTimeOrEquivalentMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*years?\s*(?:full-time.*part-time equivalent|(?:or|and)\s*part-time equivalent|full-time or equivalent part-time)/i,
  );
  if (fullTimeOrEquivalentMatch?.[1]) {
    const years = Number.parseFloat(fullTimeOrEquivalentMatch[1]);
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const fullTimeAndPartTimeYearsMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*years?\s*full-time(?:[^\d]+(?:up to\s*)?)?(\d+(?:\.\d+)?)\s*years?\s*part-time/i,
  );
  if (fullTimeAndPartTimeYearsMatch?.[1]) {
    const years = Number.parseFloat(fullTimeAndPartTimeYearsMatch[1]);
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const fullTimeAndPartTimeMonthsMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*months?\s*full-time(?:[^\d]+(?:up to\s*)?)?(\d+(?:\.\d+)?)\s*months?\s*part-time/i,
  );
  if (fullTimeAndPartTimeMonthsMatch?.[1]) {
    const years = monthsToYears(Number.parseFloat(fullTimeAndPartTimeMonthsMatch[1]));
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const fullTimeOnlyMonthsMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*months?\s*(?:\(?)(?:standard|full-time|full time)(?:\)?)/i,
  );
  if (fullTimeOnlyMonthsMatch?.[1] && /part[- ]time equivalent/i.test(duration)) {
    const years = monthsToYears(Number.parseFloat(fullTimeOnlyMonthsMatch[1]));
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const yearsOrPartTimeEquivalentMatch = duration.match(
    /(\d+(?:\.\d+)?)\s*years?\s*\(?(?:or\s*)?part-time equivalent\)?/i,
  );
  if (yearsOrPartTimeEquivalentMatch?.[1]) {
    const years = Number.parseFloat(yearsOrPartTimeEquivalentMatch[1]);
    return `${formatYearsValue(years)} years full-time or part-time equivalent`;
  }

  const partTimeMonthsMatch = duration.match(/(\d+(?:\.\d+)?)\s*months?.*part[- ]time/i);
  if (partTimeMonthsMatch?.[1]) {
    const years = monthsToYears(Number.parseFloat(partTimeMonthsMatch[1]));
    return `${formatYearsValue(years)} years part-time`;
  }

  const partTimeYearsMatch = duration.match(/(\d+(?:\.\d+)?)\s*years?.*part[- ]time/i);
  if (partTimeYearsMatch?.[1]) {
    const years = Number.parseFloat(partTimeYearsMatch[1]);
    return `${formatYearsValue(years)} years part-time`;
  }

  const fullTimeMonthsMatch = duration.match(/(\d+(?:\.\d+)?)\s*months?.*full[- ]time/i);
  if (fullTimeMonthsMatch?.[1]) {
    const years = monthsToYears(Number.parseFloat(fullTimeMonthsMatch[1]));
    return `${formatYearsValue(years)} years full-time`;
  }

  const fullTimeYearsMatch = duration.match(/(\d+(?:\.\d+)?)\s*years?.*full[- ]time/i);
  if (fullTimeYearsMatch?.[1]) {
    const years = Number.parseFloat(fullTimeYearsMatch[1]);
    return `${formatYearsValue(years)} years full-time`;
  }

  const monthRangeMatch = duration.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*months?/i);
  if (monthRangeMatch?.[1] && monthRangeMatch?.[2]) {
    const start = monthsToYears(Number.parseFloat(monthRangeMatch[1]));
    const end = monthsToYears(Number.parseFloat(monthRangeMatch[2]));
    return `${formatYearsValue(start)}-${formatYearsValue(end)} years`;
  }

  const monthsMatch = duration.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (monthsMatch?.[1]) {
    const years = monthsToYears(Number.parseFloat(monthsMatch[1]));
    return `${formatYearsValue(years)} years`;
  }

  const minimumMaximumMatch = duration.match(
    /minimum time\s*[-:]\s*(\d+(?:\.\d+)?)\s*year.*maximum time\s*[-:]\s*(\d+(?:\.\d+)?)\s*year/i,
  );
  if (minimumMaximumMatch?.[1] && minimumMaximumMatch?.[2]) {
    return `${minimumMaximumMatch[1]}-${minimumMaximumMatch[2]} years depending on study load`;
  }

  const multipleYearOptions = [...duration.matchAll(/(\d+(?:\.\d+)?)\s*years?/gi)].map((match) =>
    Number.parseFloat(match[1] ?? "0"),
  );
  if (multipleYearOptions.length > 1) {
    const minimum = Math.min(...multipleYearOptions);
    const maximum = Math.max(...multipleYearOptions);
    if (minimum !== maximum) {
      return `${formatYearsValue(minimum)}-${formatYearsValue(maximum)} years`;
    }
  }

  return duration
    .replace(/\bPart-time\b/g, "part-time")
    .replace(/\bFull-time\b/g, "full-time");
}

function inferCourseType(title: string) {
  if (/^bachelor/i.test(title)) {
    return {
      courseType: "Bachelor's",
      studyLevel: "Undergraduate",
    };
  }

  if (/^graduate certificate/i.test(title)) {
    return {
      courseType: "Graduate Certificate",
      studyLevel: "Postgraduate",
    };
  }

  if (/^master/i.test(title)) {
    return {
      courseType: "Master's",
      studyLevel: "Postgraduate",
    };
  }

  return {
    courseType: "Course",
    studyLevel: "Postgraduate",
  };
}

function inferDelivery(course: RawCourseEntry) {
  const haystack = `${course.course_name} ${course.course_description ?? ""} ${course.provider_name}`;

  if (/100%\s*online|fully online|online/i.test(haystack)) {
    return "100% Online";
  }

  return "Flexible study";
}

function inferEducationMinimum(course: RawCourseEntry, studyLevel: string): CourseEducationLevel {
  const requirements = sanitizeText(course.entry_requirements).toLowerCase();

  if (/doctorate|phd/.test(requirements)) {
    return "Doctorate";
  }

  if (/master'?s|masters degree|master degree/.test(requirements)) {
    return "Masters degree";
  }

  if (/bachelor/.test(requirements) || studyLevel === "Postgraduate") {
    return "Bachelor degree";
  }

  if (/diploma|advanced diploma|graduate certificate/.test(requirements)) {
    return "Diploma";
  }

  if (/year 12|high school|secondary/.test(requirements)) {
    return "High school";
  }

  return studyLevel === "Undergraduate" ? "High school" : "Bachelor degree";
}

function inferExperienceMinimum(course: RawCourseEntry) {
  const requirements = sanitizeText(course.entry_requirements).toLowerCase();
  const years = [...requirements.matchAll(/(\d+)\s*\+?\s*years?/g)].map((match) =>
    Number.parseInt(match[1] ?? "0", 10),
  );
  const maximumYears = Math.max(0, ...years);

  if (maximumYears >= 5) {
    return 5;
  }

  if (maximumYears >= 2) {
    return 2;
  }

  return 0;
}

function formatExperienceMinimum(minimumYears: number) {
  if (minimumYears >= 5) {
    return "five or more years";
  }

  if (minimumYears >= 2) {
    return "two or more years";
  }

  return "relevant experience";
}

function buildIneligibleCopy(
  title: string,
  minimumEducation: CourseEducationLevel,
  minimumExperienceYears: number,
) {
  if (minimumExperienceYears <= 0) {
    return `${title} expects ${minimumEducation.toLowerCase()} completion.`;
  }

  return `${title} expects either ${minimumEducation.toLowerCase()} study or ${formatExperienceMinimum(
    minimumExperienceYears,
  )} of relevant experience.`;
}

function buildCourseCode(course: RawCourseEntry) {
  if (
    /southern cross university/i.test(course.provider_name) &&
    /master of business administration/i.test(course.course_name) &&
    /online/i.test(course.course_name)
  ) {
    return "mba-online";
  }

  const baseCode = slugify(course.course_name);

  if ((baseCodeCounts[baseCode] ?? 0) === 1) {
    return baseCode;
  }

  return `${slugify(course.provider_name)}-${baseCode}`;
}

function buildFeeSummary(course: RawCourseEntry) {
  const tuition = sanitizeText(course.tuition_fees);
  const feeHelp = sanitizeText(course.fee_help_eligibility);

  if (!tuition && !feeHelp) {
    return {
      feeSummary: undefined,
      supportSummary: undefined,
      supportOptions: [] as string[],
      feeNotes: [] as string[],
    };
  }

  const perUnitAmount = extractMoneyValue(findSentence(tuition, /\bper unit\b/i));
  const perSubjectAmount = extractMoneyValue(findSentence(tuition, /\bper subject\b/i));
  const perUnitValue = parseMoneyAmount(findSentence(tuition, /\bper unit\b/i));
  const perSubjectValue = parseMoneyAmount(findSentence(tuition, /\bper subject\b/i));
  const totalAmount = extractMoneyValue(
    findSentence(
      tuition,
      /\b(total (?:course |program )?(?:cost|fees?)|approximate total|estimated total|total tuition fees)\b/i,
    ),
  );
  const rangeAmount = extractMoneyValue(findSentence(tuition, /\b(range|ranges?)\b/i));
  const cspAmount = extractMoneyValue(
    findSentence(tuition, /\b(commonwealth supported|student contribution|csp)\b/i),
  );
  const annualAmount = extractMoneyValue(
    findSentence(
      tuition,
      /\b(annual fee|annual indicative fees|1 yr full-time|first-year fee|first year|per 120 credit points|per year)\b/i,
    ),
  );
  const anyAmount = extractMoneyValue(tuition);

  let feeSummary = "";
  const feeNotes: string[] = [];
  const supportOptions: string[] = [];
  const hasCommonwealthSupport = /\b(commonwealth supported|csp)\b/i.test(tuition);

  if (perUnitAmount) {
    feeSummary = perUnitValue
      ? `Approx. ${formatCurrencyAmount(perUnitValue * 8)} per year`
      : `Approx. ${perUnitAmount} per unit`;
    feeNotes.push("Based on a full-time load of 8 units per year.");
    if (totalAmount) {
      feeNotes.push(`Approx. ${totalAmount} total for the full course.`);
    }
  } else if (perSubjectAmount) {
    feeSummary = perSubjectValue
      ? `Approx. ${formatCurrencyAmount(perSubjectValue * 8)} per year`
      : `Approx. ${perSubjectAmount} per subject`;
    feeNotes.push("Based on a full-time load of 8 subjects per year.");
    if (rangeAmount) {
      feeNotes.push(`Approx. ${rangeAmount} total, depending on subject count.`);
    } else if (totalAmount) {
      feeNotes.push(`Approx. ${totalAmount} total for the full course.`);
    }
  } else if (cspAmount && annualAmount && cspAmount !== annualAmount) {
    feeSummary = `Approx. ${annualAmount} per year`;
  } else if (cspAmount) {
    feeSummary = `Approx. ${cspAmount} per year`;
  } else if (totalAmount) {
    feeSummary = `Approx. ${totalAmount} total`;
  } else if (rangeAmount) {
    feeSummary = `Approx. ${rangeAmount} total`;
  } else if (annualAmount) {
    feeSummary = `Approx. ${annualAmount} per year`;
  } else if (anyAmount) {
    feeSummary = `Approx. ${anyAmount}`;
  } else if (feeHelp) {
    feeSummary = "Contact provider for current fees";
  }

  const supportSignals = new Set<string>();

  if (hasCommonwealthSupport) {
    supportSignals.add("CSP");
  }

  if (/\bfee-help\b/i.test(`${tuition} ${feeHelp}`)) {
    supportSignals.add("FEE-HELP");
  }

  if (/\bhecs-help\b/i.test(`${tuition} ${feeHelp}`)) {
    supportSignals.add("HECS-HELP");
  }

  supportOptions.push(
    ...SUPPORT_OPTION_ORDER.filter((option) => supportSignals.has(option)),
  );

  const supportSummary = supportOptions.join(" · ");

  if (/ssaf|student services and amenities fee/i.test(tuition)) {
    feeNotes.push("Student services fees may apply.");
  }

  if (/additional costs|study tours|travel|accommodation/i.test(tuition)) {
    feeNotes.push("Additional study or travel costs may apply.");
  }

  if (/scholarship|discount|rebate|alumni/i.test(tuition)) {
    feeNotes.push("Scholarships or discounts may be available.");
  }

  return {
    feeSummary: feeSummary || undefined,
    supportSummary: supportSummary || undefined,
    supportOptions,
    feeNotes,
  };
}

function transformCourse(course: RawCourseEntry): CourseCatalogEntry {
  const title = sanitizeText(course.course_name);
  const provider = sanitizeText(course.provider_name);
  const description = sanitizeText(course.course_description);
  const subjectArea = sanitizeText(course.subject_area);
  const intakeDates = toValueList(course.intake_start_dates);
  const intakeLabel = normalizeIntakeLabel(intakeDates);
  const { courseType, studyLevel } = inferCourseType(title);
  const minimumEducation = inferEducationMinimum(course, studyLevel);
  const minimumExperienceYears = inferExperienceMinimum(course);
  const { feeSummary, supportSummary, supportOptions, feeNotes } = buildFeeSummary(course);

  return {
    code: buildCourseCode(course),
    title,
    provider,
    providerCode: slugify(provider),
    categories: inferCategories(subjectArea),
    delivery: inferDelivery(course),
    duration: normalizeDurationLabel(course.course_duration),
    price: feeSummary,
    studyLevel,
    courseType,
    intakeLabel,
    summary: getFirstSentence(description, 190) || undefined,
    description: description || undefined,
    subjectArea: subjectArea || undefined,
    entryRequirements: sanitizeText(course.entry_requirements) || undefined,
    recognitionOfPriorLearning:
      sanitizeText(course.recognition_of_prior_learning) || undefined,
    coreSubjects: toValueList(course.core_subjects_modules),
    intakeDates,
    tuitionFees: sanitizeText(course.tuition_fees) || undefined,
    feeHelpEligibility: sanitizeText(course.fee_help_eligibility) || undefined,
    feeSummary,
    supportSummary,
    supportOptions,
    feeNotes,
    outcomes: sanitizeText(course.outcomes) || undefined,
    eligibility: {
      goalsOptions:
        studyLevel === "Undergraduate" ? [...UNDERGRADUATE_GOALS] : [...DEFAULT_GOALS],
      educationOptions: [...DEFAULT_EDUCATION_OPTIONS],
      experienceOptions: [...DEFAULT_EXPERIENCE_OPTIONS],
      rules: [
        {
          type: "min_education_or_experience",
          minEducation: minimumEducation,
          minExperienceYears: minimumExperienceYears,
        },
      ],
      successCopy: `You meet the entry criteria for ${title}.`,
      ineligibleCopy: buildIneligibleCopy(title, minimumEducation, minimumExperienceYears),
    },
  };
}

const courseCatalog = courseEntries.map((course) => transformCourse(course));

export function getCourseCatalog() {
  return courseCatalog;
}

export function getCourseByCode(code?: string | null) {
  if (!code) {
    return null;
  }

  return courseCatalog.find((course) => course.code === code) ?? null;
}

export function getDefaultCourse() {
  return courseCatalog[0];
}
