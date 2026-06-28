import { useCallback, useMemo, useRef } from "react";
import { createCollectionMutators } from "../../../lib/collectionMutators";
import {
  createApplicationUpdateQueue,
  type ApplicationUpdateQueue,
} from "./applicationUpdateQueue";
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

  // Serialize writes so rapid successive edits accumulate in submission order rather
  // than racing on a stale `data` snapshot (which dropped the earlier edit when the
  // next step was reached before the async persist + re-render cycle completed).
  // Refs keep the queue stable while always reading the latest committed data and
  // persist function. The queue also remembers the result `persist` resolves with, so
  // when it re-seeds while idle it can use that result (which carries the freshly
  // assigned recordId) before this ref's `data` has caught up — otherwise the next
  // write would INSERT a duplicate row and lose the edit.
  const committedDataRef = useRef(data);
  committedDataRef.current = data;
  const persistApplicationRef = useRef(persistApplication);
  persistApplicationRef.current = persistApplication;
  const updateQueueRef = useRef<ApplicationUpdateQueue<ApplicationData> | null>(null);
  if (!updateQueueRef.current) {
    updateQueueRef.current = createApplicationUpdateQueue<ApplicationData>({
      getCommitted: () => committedDataRef.current,
      persist: (nextData) => persistApplicationRef.current(nextData),
    });
  }

  const updateData = useCallback(
    async (updater: (current: ApplicationData) => ApplicationData) => {
      await updateQueueRef.current!.enqueue(updater);
    },
    [],
  );

  const updateDataWithEvent = useCallback(
    async (
      updater: (current: ApplicationData) => ApplicationData,
      eventName: string,
      properties?:
        | Record<string, unknown>
        | ((application: ApplicationData) => Record<string, unknown>),
    ) => {
      const persisted = await updateQueueRef.current!.enqueue(updater);
      trackApplicationDataEvent(eventName, persisted, properties);
    },
    [trackApplicationDataEvent],
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
