/** Course codes in the golden parser-eval corpus. */
export const GOLDEN_COURSE_CODES = [
  "cquniversity-australia-master-of-information-technology",
  "uts-online-university-of-technology-sydney-master-of-business-administration-mba",
  "master-of-health-management",
  "unsw-online-university-of-new-south-wales-master-of-data-science",
  "deakin-university-master-of-data-science",
  "university-of-melbourne-master-of-public-health",
  "master-of-business-management-with-discipline-studies-in-project-management",
  "deakin-university-master-of-cyber-security",
  "monash-online-monash-university-master-of-human-resource-management",
  "master-of-business-marketing",
  "master-of-business-administration",
  "master-of-business-administration-digital",
  "mba-online",
  "university-of-southern-queensland-unisq-master-of-business-administration-mba",
  "southern-cross-university-master-of-information-technology",
] as const;

/** Courses that still route to legacy deterministicRules (empty / unparseable requirements). */
export const FALLBACK_COURSE_CODES = [
  "cquniversity-australia-master-of-information-technology",
] as const;
