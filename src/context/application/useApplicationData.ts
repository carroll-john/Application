import { useCallback, useMemo } from "react";
import {
  getNextIncompleteSection as getNextIncompleteSectionForApplication,
} from "../../lib/applicationNextStep";
import type {
  ApplicationData,
  ContactDetails,
  EmploymentExperience,
  LanguageTest,
  PersonalDetails,
  ProfessionalAccreditation,
  SecondaryQualification,
  TertiaryQualification,
} from "../../lib/applicationData";
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

function replaceItemById<T extends { id: string }>(
  items: T[],
  id: string,
  nextItem: T,
) {
  return items.map((item) => (item.id === id ? nextItem : item));
}

export function useApplicationData({
  data,
  persistApplication,
  trackApplicationDataEvent,
}: UseApplicationDataOptions) {
  const getNextIncompleteSection = useCallback(
    (application: ApplicationData = data) =>
      getNextIncompleteSectionForApplication(application),
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

  return useMemo(
    () => ({
      getNextIncompleteSection,
      updateContactDetails: (updates: Partial<ContactDetails>) =>
        updateData((current) => ({
          ...current,
          contactDetails: {
            ...current.contactDetails,
            ...updates,
          },
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
      addEmploymentExperience: (experience: EmploymentExperience) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            employmentExperiences: [...current.employmentExperiences, experience],
          }),
          "application_employment_experience_saved",
          (nextData) => ({
            action: "created",
            total_count: nextData.employmentExperiences.length,
          }),
        ),
      updateEmploymentExperience: (id: string, experience: EmploymentExperience) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            employmentExperiences: replaceItemById(
              current.employmentExperiences,
              id,
              experience,
            ),
          }),
          "application_employment_experience_saved",
          (nextData) => ({
            action: "updated",
            total_count: nextData.employmentExperiences.length,
          }),
        ),
      removeEmploymentExperience: (id: string) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            employmentExperiences: current.employmentExperiences.filter(
              (experience) => experience.id !== id,
            ),
          }),
          "application_employment_experience_removed",
          (nextData) => ({
            total_count: nextData.employmentExperiences.length,
          }),
        ),
      addLanguageTest: (test: LanguageTest) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            languageTests: [...current.languageTests, test],
          }),
          "application_language_test_saved",
          (nextData) => ({
            action: "created",
            total_count: nextData.languageTests.length,
          }),
        ),
      updateLanguageTest: (id: string, test: LanguageTest) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            languageTests: replaceItemById(current.languageTests, id, test),
          }),
          "application_language_test_saved",
          (nextData) => ({
            action: "updated",
            total_count: nextData.languageTests.length,
          }),
        ),
      removeLanguageTest: (id: string) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            languageTests: current.languageTests.filter((test) => test.id !== id),
          }),
          "application_language_test_removed",
          (nextData) => ({
            total_count: nextData.languageTests.length,
          }),
        ),
      addProfessionalAccreditation: (
        accreditation: ProfessionalAccreditation,
      ) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            professionalAccreditations: [
              ...current.professionalAccreditations,
              accreditation,
            ],
          }),
          "application_professional_accreditation_saved",
          (nextData) => ({
            action: "created",
            total_count: nextData.professionalAccreditations.length,
          }),
        ),
      updateProfessionalAccreditation: (
        id: string,
        accreditation: ProfessionalAccreditation,
      ) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            professionalAccreditations: replaceItemById(
              current.professionalAccreditations,
              id,
              accreditation,
            ),
          }),
          "application_professional_accreditation_saved",
          (nextData) => ({
            action: "updated",
            total_count: nextData.professionalAccreditations.length,
          }),
        ),
      removeProfessionalAccreditation: (id: string) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            professionalAccreditations: current.professionalAccreditations.filter(
              (accreditation) => accreditation.id !== id,
            ),
          }),
          "application_professional_accreditation_removed",
          (nextData) => ({
            total_count: nextData.professionalAccreditations.length,
          }),
        ),
      addSecondaryQualification: (qualification: SecondaryQualification) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            secondaryQualifications: [
              ...current.secondaryQualifications,
              qualification,
            ],
          }),
          "application_secondary_qualification_saved",
          (nextData) => ({
            action: "created",
            total_count: nextData.secondaryQualifications.length,
          }),
        ),
      updateSecondaryQualification: (
        id: string,
        qualification: SecondaryQualification,
      ) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            secondaryQualifications: replaceItemById(
              current.secondaryQualifications,
              id,
              qualification,
            ),
          }),
          "application_secondary_qualification_saved",
          (nextData) => ({
            action: "updated",
            total_count: nextData.secondaryQualifications.length,
          }),
        ),
      removeSecondaryQualification: (id: string) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            secondaryQualifications: current.secondaryQualifications.filter(
              (qualification) => qualification.id !== id,
            ),
          }),
          "application_secondary_qualification_removed",
          (nextData) => ({
            total_count: nextData.secondaryQualifications.length,
          }),
        ),
      addTertiaryQualification: (qualification: TertiaryQualification) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            tertiaryQualifications: [
              ...current.tertiaryQualifications,
              qualification,
            ],
          }),
          "application_tertiary_qualification_saved",
          (nextData) => ({
            action: "created",
            total_count: nextData.tertiaryQualifications.length,
          }),
        ),
      updateTertiaryQualification: (
        id: string,
        qualification: TertiaryQualification,
      ) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            tertiaryQualifications: replaceItemById(
              current.tertiaryQualifications,
              id,
              qualification,
            ),
          }),
          "application_tertiary_qualification_saved",
          (nextData) => ({
            action: "updated",
            total_count: nextData.tertiaryQualifications.length,
          }),
        ),
      removeTertiaryQualification: (id: string) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            tertiaryQualifications: current.tertiaryQualifications.filter(
              (qualification) => qualification.id !== id,
            ),
          }),
          "application_tertiary_qualification_removed",
          (nextData) => ({
            total_count: nextData.tertiaryQualifications.length,
          }),
        ),
    }),
    [getNextIncompleteSection, updateData, updateDataWithEvent],
  );
}
