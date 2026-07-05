import { ApplicationShell } from "../forms";
import { SECTION2_SECTION_LABEL } from "../../lib/section2Steps";
import { Section2QualificationsLoadingState } from "./Section2QualificationsLoadingState";

/** Suspense fallback for the qualifications hub — matches the hydration placeholder shell. */
export function Section2QualificationsRouteFallback() {
  return (
    <ApplicationShell
      description="Work through each section to build your application."
      onContinue={() => undefined}
      onPrevious={() => undefined}
      progress={66}
      sectionLabel={SECTION2_SECTION_LABEL}
      showActionBar={false}
      title="Your qualifications"
    >
      <Section2QualificationsLoadingState />
    </ApplicationShell>
  );
}
