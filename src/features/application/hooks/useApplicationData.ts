import { useCallback, useMemo } from "react";
import { createCollectionMutators } from "../../../lib/collectionMutators";
import type {
  ApplicationData,
  ContactDetails,
  EmploymentExperience,
  LanguageTest,
  PersonalDetails,
  ProfessionalAccreditation,
  SecondaryQualification,
  TertiaryQualification,
} from "../../../lib/applicationData";
import { normalizeConditionalContactDetails as normalizeContactDetails } from "../../../lib/applicationData";
import {
  getNextIncompleteStep,
  type StepCompletionLabel,
} from "../../../lib/applicationValidationSchema";
import type { PersistApplicationOptions } from "./useApplicationStorageOrchestration";

interface UseApplicationDataOptions {
  data: ApplicationData;
  persistApplication: (
    nextData: ApplicationData,
    options?: PersistApplicationOptions,
  ) => Promise<ApplicationData>;
  trackApplicationDataEvent: (
    eventName: string,
    persistedApplication: ApplicationData,
    properties?:
      | Record<string, unknown>
      | ((application: ApplicationData) => Record<string, unknown>),
  ) => void;
}

export function useApplicationData({
  data,
  persistApplication,
  trackApplicationDataEvent,
}: UseApplicationDataOptions) {
  const getNextIncompleteSection = useCallback(
    (application: ApplicationData = data): StepCompletionLabel | null =>
      getNextIncompleteStep(application),
    [data],
  );

  const updateData = useCallback(
    async (updater: (current: ApplicationData) => ApplicationData) => {
      const nextData = updater(data);
      await persistApplication(nextData);
    },
    [data, persistApplication],
  );

  const updateDataWithEvent = useCallback(
    async (
      updater: (current: ApplicationData) => ApplicationData,
      eventName: string,
      properties?:
        | Record<string, unknown>
        | ((application: ApplicationData) => Record<string, unknown>),
    ) => {
      const nextData = updater(data);
      const persisted = await persistApplication(nextData);
      trackApplicationDataEvent(eventName, persisted, properties);
    },
    [data, persistApplication, trackApplicationDataEvent],
  );

  const employmentMutators = useMemo(
    () =>
      createCollectionMutators<EmploymentExperience>(
        {
          collectionKey: "employmentExperiences",
          savedEvent: "application_employment_experience_saved",
          removedEvent: "application_employment_experience_removed",
        },
        updateDataWithEvent,
      ),
    [updateDataWithEvent],
  );

  const languageTestMutators = useMemo(
    () =>
      createCollectionMutators<LanguageTest>(
        {
          collectionKey: "languageTests",
          savedEvent: "application_language_test_saved",
          removedEvent: "application_language_test_removed",
        },
        updateDataWithEvent,
      ),
    [updateDataWithEvent],
  );

  const accreditationMutators = useMemo(
    () =>
      createCollectionMutators<ProfessionalAccreditation>(
        {
          collectionKey: "professionalAccreditations",
          savedEvent: "application_professional_accreditation_saved",
          removedEvent: "application_professional_accreditation_removed",
        },
        updateDataWithEvent,
      ),
    [updateDataWithEvent],
  );

  const secondaryMutators = useMemo(
    () =>
      createCollectionMutators<SecondaryQualification>(
        {
          collectionKey: "secondaryQualifications",
          savedEvent: "application_secondary_qualification_saved",
          removedEvent: "application_secondary_qualification_removed",
        },
        updateDataWithEvent,
      ),
    [updateDataWithEvent],
  );

  const tertiaryMutators = useMemo(
    () =>
      createCollectionMutators<TertiaryQualification>(
        {
          collectionKey: "tertiaryQualifications",
          savedEvent: "application_tertiary_qualification_saved",
          removedEvent: "application_tertiary_qualification_removed",
        },
        updateDataWithEvent,
      ),
    [updateDataWithEvent],
  );

  return useMemo(
    () => ({
      getNextIncompleteSection,
      updateContactDetails: (updates: Partial<ContactDetails>) =>
        updateData((current) => ({
          ...current,
          contactDetails: normalizeContactDetails({
            ...current.contactDetails,
            ...updates,
          }),
        })),
      updatePersonalDetails: (updates: Partial<PersonalDetails>) =>
        updateData((current) => ({
          ...current,
          personalDetails: {
            ...current.personalDetails,
            ...updates,
          },
        })),
      uploadCV: (document: NonNullable<ApplicationData["cvDocument"]>) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            cvDocument: document,
            cvFileName: document.name,
            cvUploaded: true,
          }),
          "application_cv_saved",
          () => ({
            cv_file_name: document.name,
          }),
        ),
      removeCV: () =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            cvDocument: undefined,
            cvFileName: undefined,
            cvUploaded: false,
          }),
          "application_cv_removed",
        ),
      replaceEmploymentExperiences: (experiences: EmploymentExperience[]) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            employmentExperiences: experiences,
          }),
          "application_employment_experience_saved",
          {
            action: "bulk_replaced_from_cv",
            total_count: experiences.length,
          },
        ),
      addEmploymentExperience: employmentMutators.add,
      updateEmploymentExperience: employmentMutators.update,
      removeEmploymentExperience: employmentMutators.remove,
      addLanguageTest: languageTestMutators.add,
      updateLanguageTest: languageTestMutators.update,
      removeLanguageTest: languageTestMutators.remove,
      addProfessionalAccreditation: accreditationMutators.add,
      updateProfessionalAccreditation: accreditationMutators.update,
      removeProfessionalAccreditation: accreditationMutators.remove,
      addSecondaryQualification: secondaryMutators.add,
      updateSecondaryQualification: secondaryMutators.update,
      removeSecondaryQualification: secondaryMutators.remove,
      addTertiaryQualification: tertiaryMutators.add,
      updateTertiaryQualification: tertiaryMutators.update,
      removeTertiaryQualification: tertiaryMutators.remove,
    }),
    [
      accreditationMutators,
      employmentMutators,
      getNextIncompleteSection,
      languageTestMutators,
      secondaryMutators,
      tertiaryMutators,
      updateData,
      updateDataWithEvent,
    ],
  );
}
