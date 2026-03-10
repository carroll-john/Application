import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { ApplicationSummary } from "../lib/applicationRecords";
import type { StoredApplicantProfile } from "../lib/applicantProfileStore";
import type {
  ApplicationData,
  ContactDetails,
  EmploymentExperience,
  LanguageTest,
  PersonalDetails,
  ProfessionalAccreditation,
  SecondaryQualification,
  SelectedCourse,
  TertiaryQualification,
} from "../lib/applicationData";
import { createApplicationStorageAdapter } from "../lib/applicationStorageAdapter";
import { useApplicationAnalytics } from "./application/useApplicationAnalytics";
import { useApplicationData } from "./application/useApplicationData";
import { useApplicationProfile } from "./application/useApplicationProfile";
import {
  useApplicationStorageOrchestration,
  type BeginCourseApplicationOptions,
} from "./application/useApplicationStorageOrchestration";
import { useAuth } from "./AuthContext";

interface ApplicationContextType {
  activeApplicationId: string | null;
  applicantProfile: StoredApplicantProfile | null;
  applications: ApplicationSummary[];
  data: ApplicationData;
  beginCourseApplication: (
    course: SelectedCourse,
    options?: BeginCourseApplicationOptions,
  ) => Promise<ApplicationData>;
  ensureRemoteRecordId: () => Promise<string>;
  getNextIncompleteSection: (application?: ApplicationData) => string | null;
  isHydrating: boolean;
  markApplicationSubmitted: () => Promise<void>;
  openApplication: (applicationId: string) => Promise<void>;
  refreshApplicantProfile: () => Promise<void>;
  refreshApplications: () => Promise<void>;
  resetApplication: () => Promise<void>;
  selectCourse: (course: SelectedCourse) => Promise<ApplicationData>;
  updateContactDetails: (updates: Partial<ContactDetails>) => Promise<void>;
  updatePersonalDetails: (updates: Partial<PersonalDetails>) => Promise<void>;
  uploadCV: (document: NonNullable<ApplicationData["cvDocument"]>) => Promise<void>;
  removeCV: () => Promise<void>;
  replaceEmploymentExperiences: (
    experiences: EmploymentExperience[],
  ) => Promise<void>;
  addEmploymentExperience: (experience: EmploymentExperience) => Promise<void>;
  updateEmploymentExperience: (
    id: string,
    experience: EmploymentExperience,
  ) => Promise<void>;
  removeEmploymentExperience: (id: string) => Promise<void>;
  addLanguageTest: (test: LanguageTest) => Promise<void>;
  updateLanguageTest: (id: string, test: LanguageTest) => Promise<void>;
  removeLanguageTest: (id: string) => Promise<void>;
  addProfessionalAccreditation: (
    accreditation: ProfessionalAccreditation,
  ) => Promise<void>;
  updateProfessionalAccreditation: (
    id: string,
    accreditation: ProfessionalAccreditation,
  ) => Promise<void>;
  removeProfessionalAccreditation: (id: string) => Promise<void>;
  addSecondaryQualification: (
    qualification: SecondaryQualification,
  ) => Promise<void>;
  updateSecondaryQualification: (
    id: string,
    qualification: SecondaryQualification,
  ) => Promise<void>;
  removeSecondaryQualification: (id: string) => Promise<void>;
  addTertiaryQualification: (qualification: TertiaryQualification) => Promise<void>;
  updateTertiaryQualification: (
    id: string,
    qualification: TertiaryQualification,
  ) => Promise<void>;
  removeTertiaryQualification: (id: string) => Promise<void>;
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(
  undefined,
);

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const { companyUserEmail, session, storageMode } = useAuth();
  const storageAdapter = useMemo(
    () => createApplicationStorageAdapter({ mode: storageMode, session }),
    [session, storageMode],
  );

  const analytics = useApplicationAnalytics({ storageMode });
  const {
    applicantProfile,
    applicantProfileId,
    ensureApplicantProfile,
    refreshApplicantProfile,
    setApplicantProfile,
  } = useApplicationProfile({
    companyUserEmail,
    storageAdapter,
  });

  const {
    activeApplicationId,
    applications,
    beginCourseApplication,
    data,
    ensureRemoteRecordId,
    isHydrating,
    markApplicationSubmitted,
    openApplication,
    persistApplication,
    refreshApplications,
    resetApplication,
  } = useApplicationStorageOrchestration({
    applicantProfileId,
    ensureApplicantProfile,
    setApplicantProfile,
    storageAdapter,
    trackApplicationSubmitted: analytics.trackApplicationSubmitted,
    trackDraftCreated: analytics.trackDraftCreated,
    trackDraftResumed: analytics.trackDraftResumed,
  });

  const dataActions = useApplicationData({
    data,
    persistApplication,
    trackApplicationDataEvent: analytics.trackApplicationDataEvent,
  });

  const value = useMemo<ApplicationContextType>(
    () => ({
      activeApplicationId,
      applicantProfile,
      applications,
      data,
      beginCourseApplication,
      ensureRemoteRecordId,
      getNextIncompleteSection: dataActions.getNextIncompleteSection,
      isHydrating,
      markApplicationSubmitted,
      openApplication,
      refreshApplicantProfile,
      refreshApplications,
      resetApplication,
      selectCourse: beginCourseApplication,
      updateContactDetails: dataActions.updateContactDetails,
      updatePersonalDetails: dataActions.updatePersonalDetails,
      uploadCV: dataActions.uploadCV,
      removeCV: dataActions.removeCV,
      replaceEmploymentExperiences: dataActions.replaceEmploymentExperiences,
      addEmploymentExperience: dataActions.addEmploymentExperience,
      updateEmploymentExperience: dataActions.updateEmploymentExperience,
      removeEmploymentExperience: dataActions.removeEmploymentExperience,
      addLanguageTest: dataActions.addLanguageTest,
      updateLanguageTest: dataActions.updateLanguageTest,
      removeLanguageTest: dataActions.removeLanguageTest,
      addProfessionalAccreditation: dataActions.addProfessionalAccreditation,
      updateProfessionalAccreditation:
        dataActions.updateProfessionalAccreditation,
      removeProfessionalAccreditation: dataActions.removeProfessionalAccreditation,
      addSecondaryQualification: dataActions.addSecondaryQualification,
      updateSecondaryQualification: dataActions.updateSecondaryQualification,
      removeSecondaryQualification: dataActions.removeSecondaryQualification,
      addTertiaryQualification: dataActions.addTertiaryQualification,
      updateTertiaryQualification: dataActions.updateTertiaryQualification,
      removeTertiaryQualification: dataActions.removeTertiaryQualification,
    }),
    [
      activeApplicationId,
      applicantProfile,
      applications,
      beginCourseApplication,
      data,
      dataActions,
      ensureRemoteRecordId,
      isHydrating,
      markApplicationSubmitted,
      openApplication,
      refreshApplicantProfile,
      refreshApplications,
      resetApplication,
    ],
  );

  return (
    <ApplicationContext.Provider value={value}>
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplication() {
  const context = useContext(ApplicationContext);

  if (!context) {
    throw new Error("useApplication must be used within an ApplicationProvider.");
  }

  return context;
}
