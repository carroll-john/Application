import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ApplicationData } from "../../lib/applicationData";
import {
  isEmploymentExperienceChronologyValid,
  isTertiaryQualificationSubmissionReady,
} from "../../lib/applicationValidationSchema";
import type { ProgramEvidenceRow } from "../../lib/eligibility/programEvidence";
import {
  trackEvidencePromptViewed,
  trackEvidenceSectionSkipped,
  trackEvidenceSectionUnskipped,
} from "../../lib/posthog";
import { readSection2NavigationState } from "./section2NavigationState";
import {
  buildSection2EvidencePlan,
  readSkippedSections,
  sectionHasData,
  writeSkippedSections,
  type Section2EvidenceSectionKey,
} from "./section2EvidencePlan";
import { sectionStateOrder, type SectionState } from "./types";

type StatusMessage = {
  type: "success" | "warning" | "error" | "status";
  message: string;
};

interface UseSection2QualificationsFlowOptions {
  data: ApplicationData;
  groupedEvidenceRows: readonly ProgramEvidenceRow[];
  hasPublishedRequirements: boolean;
}

export function useSection2QualificationsFlow({
  data,
  groupedEvidenceRows,
  hasPublishedRequirements,
}: UseSection2QualificationsFlowOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const [skippedSections, setSkippedSections] = useState<
    ReadonlySet<Section2EvidenceSectionKey>
  >(() => readSkippedSections());
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const tertiaryRequirementsMet = data.tertiaryQualifications.every(
    isTertiaryQualificationSubmissionReady,
  );
  const employmentRequirementsMet = data.employmentExperiences.every(
    isEmploymentExperienceChronologyValid,
  );

  useEffect(() => {
    const navigationState = readSection2NavigationState(location.state);

    if (
      navigationState?.section2StatusMessage &&
      !navigationState.pendingTranscriptEligibility
    ) {
      setStatusMessage({
        message: navigationState.section2StatusMessage.message,
        type: navigationState.section2StatusMessage.type,
      });
    }

    if (!navigationState || navigationState.pendingTranscriptEligibility) {
      return;
    }

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.search, location.state, navigate]);

  const evidencePlan = useMemo(
    () =>
      buildSection2EvidencePlan({
        data,
        groupedRows: groupedEvidenceRows,
        hasPublishedRequirements,
        skippedSections,
      }),
    [data, groupedEvidenceRows, hasPublishedRequirements, skippedSections],
  );

  // The hub surfaces one evidence prompt at a time; report each prompt the
  // applicant is shown, once, so drop-off between prompts is visible.
  const lastTrackedPromptKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const prompt = evidencePlan.nextPrompt;
    if (!prompt) {
      return;
    }

    const promptKey = `${prompt.sectionKey}:${prompt.heading}`;
    if (promptKey === lastTrackedPromptKeyRef.current) {
      return;
    }

    lastTrackedPromptKeyRef.current = promptKey;
    trackEvidencePromptViewed({
      application: data,
      evidenceSectionKey: prompt.sectionKey,
      outstandingPromptCount: evidencePlan.remainingPromptCount,
      promptHeading: prompt.heading,
      promptSource: prompt.source,
    });
  }, [data, evidencePlan.nextPrompt, evidencePlan.remainingPromptCount]);

  const sectionStates = useMemo(() => {
    const states = {} as SectionState;
    for (const key of sectionStateOrder) {
      if (sectionHasData(data, key)) {
        const needsAttention =
          (key === "tertiary" && !tertiaryRequirementsMet) ||
          (key === "employment" && !employmentRequirementsMet);
        states[key] = needsAttention ? "needsAttention" : "completed";
      } else if (evidencePlan.nextPrompt?.sectionKey === key) {
        states[key] = "active";
      } else if (skippedSections.has(key)) {
        states[key] = "skipped";
      } else {
        states[key] = "locked";
      }
    }
    return states;
  }, [
    data,
    employmentRequirementsMet,
    evidencePlan.nextPrompt?.sectionKey,
    skippedSections,
    tertiaryRequirementsMet,
  ]);

  function handleSkipSection(section: keyof SectionState) {
    setSkippedSections((previous) => {
      const next = new Set(previous);
      next.add(section);
      writeSkippedSections(next);
      return next;
    });

    trackEvidenceSectionSkipped({
      application: data,
      evidenceSectionKey: section,
      outstandingPromptCount: evidencePlan.remainingPromptCount,
    });
  }

  function handleUnskipSection(section: keyof SectionState) {
    setSkippedSections((previous) => {
      const next = new Set(previous);
      next.delete(section);
      writeSkippedSections(next);
      return next;
    });

    trackEvidenceSectionUnskipped({
      application: data,
      evidenceSectionKey: section,
      outstandingPromptCount: evidencePlan.remainingPromptCount,
    });
  }

  async function handleSaveAndContinue() {
    setIsSaving(true);
    await import("../../pages/ReviewAndSubmit");
    navigate("/review");
  }

  async function handleSaveAndExit() {
    setIsSaving(true);
    await import("../../pages/Dashboard");
    navigate("/dashboard");
  }

  return {
    evidencePlan,
    handleSaveAndContinue,
    handleSaveAndExit,
    handleSkipSection,
    handleUnskipSection,
    isSaving,
    sectionStates,
    setStatusMessage,
    statusMessage,
  };
}
