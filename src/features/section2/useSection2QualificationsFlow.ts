import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ApplicationData } from "../../lib/applicationData";
import {
  isEmploymentExperienceChronologyValid,
  isTertiaryQualificationSubmissionReady,
} from "../../lib/applicationValidationSchema";
import {
  getSection2RequirementInput,
  getSection2RequirementProfile,
} from "../../lib/section2Requirements";
import { readSection2NavigationState } from "./section2NavigationState";
import {
  initialSectionState,
  sectionStateOrder,
  type SectionState,
  type SectionStatus,
} from "./types";

type StatusMessage = {
  type: "success" | "warning" | "error" | "status";
  message: string;
};

interface UseSection2QualificationsFlowOptions {
  data: ApplicationData;
}

export function useSection2QualificationsFlow({ data }: UseSection2QualificationsFlowOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sectionStates, setSectionStates] = useState<SectionState>(initialSectionState);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasTertiaryQualification = data.tertiaryQualifications.length > 0;
  const tertiaryRequirementsMet =
    hasTertiaryQualification &&
    data.tertiaryQualifications.every(isTertiaryQualificationSubmissionReady);
  const hasEmploymentExperience = data.employmentExperiences.length > 0;
  const employmentRequirementsMet =
    hasEmploymentExperience &&
    data.employmentExperiences.every(isEmploymentExperienceChronologyValid);
  const section2RequirementInput = getSection2RequirementInput(data);
  const section2RequirementProfile = getSection2RequirementProfile(
    section2RequirementInput.selectedCourse,
  );
  const supportsExperienceAlternative =
    section2RequirementProfile?.supportsExperienceAlternative ?? false;
  const supportsSecondaryQualification =
    section2RequirementProfile?.supportsSecondaryQualification ?? false;

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

  useEffect(() => {
    const next: SectionState = { ...initialSectionState };

    if (supportsExperienceAlternative) {
      next.cv = "active";
      next.employment = "active";
    }

    if (supportsSecondaryQualification) {
      next.secondary = "active";
    }

    if (data.tertiaryQualifications.length > 0) {
      next.tertiary = tertiaryRequirementsMet ? "completed" : "needsAttention";
      next.cv = "active";
    }
    if (data.cvUploaded) {
      next.cv = "completed";
      next.employment = "active";
    }
    if (data.employmentExperiences.length > 0) {
      next.employment = employmentRequirementsMet ? "completed" : "needsAttention";
      next.accreditation = "active";
    }
    if (data.professionalAccreditations.length > 0) {
      next.accreditation = "completed";
      next.secondary = "active";
    }
    if (data.secondaryQualifications.length > 0) {
      next.secondary = "completed";
      next.languageTest = "active";
    }
    if (data.languageTests.length > 0) {
      next.languageTest = "completed";
    }

    setSectionStates((previous) => ({
      ...next,
      tertiary:
        previous.tertiary === "skipped" && next.tertiary === "active"
          ? "skipped"
          : next.tertiary,
      cv: previous.cv === "skipped" && next.cv === "active" ? "skipped" : next.cv,
      employment:
        previous.employment === "skipped" && next.employment === "active"
          ? "skipped"
          : next.employment,
      accreditation:
        previous.accreditation === "skipped" && next.accreditation === "active"
          ? "skipped"
          : next.accreditation,
      secondary:
        previous.secondary === "skipped" && next.secondary === "active"
          ? "skipped"
          : next.secondary,
      languageTest:
        previous.languageTest === "skipped" && next.languageTest === "active"
          ? "skipped"
          : next.languageTest,
    }));
  }, [
    data,
    employmentRequirementsMet,
    supportsExperienceAlternative,
    supportsSecondaryQualification,
    tertiaryRequirementsMet,
  ]);

  function handleSkipSection(section: keyof SectionState) {
    setSectionStates((previous) => {
      const next = { ...previous, [section]: "skipped" as SectionStatus };
      const currentIndex = sectionStateOrder.indexOf(section);
      if (currentIndex < sectionStateOrder.length - 1) {
        const nextSection = sectionStateOrder[currentIndex + 1];
        if (next[nextSection] === "locked") {
          next[nextSection] = "active";
        }
      }
      return next;
    });

    setStatusMessage({
      type: "status",
      message: "Section skipped. You can always come back to add information later.",
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
    handleSaveAndContinue,
    handleSaveAndExit,
    handleSkipSection,
    isSaving,
    sectionStates,
    setStatusMessage,
    statusMessage,
  };
}
