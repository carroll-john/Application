import { pathToFileURL } from "node:url";

const governanceUrl = pathToFileURL(
  new URL("../src/lib/assessment/ucGovernance.ts", import.meta.url).pathname,
);
const { findStaleUcGovernanceSources, UC_ASSESSMENT_MAX_SOURCE_AGE_DAYS } =
  await import(governanceUrl.href);
const now = process.env.UC_GOVERNANCE_CHECK_DATE
  ? new Date(process.env.UC_GOVERNANCE_CHECK_DATE)
  : new Date();
const stale = findStaleUcGovernanceSources(now);

if (stale.length > 0) {
  console.error(
    `UC governed sources must be refreshed every ${UC_ASSESSMENT_MAX_SOURCE_AGE_DAYS} days:`,
  );
  stale.forEach((course) => {
    console.error(`- ${course.courseTitle}: ${course.sourceVerifiedAt} (${course.sourceUrl})`);
  });
  process.exitCode = 1;
}
