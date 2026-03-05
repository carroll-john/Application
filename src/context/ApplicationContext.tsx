import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearLocalApplications,
  createApplicationDraft,
  loadLocalActiveApplicationId,
  saveLocalActiveApplicationId,
  summarizeApplication,
  upsertLocalApplication,
  type ApplicationSummary,
} from "../lib/applicationRecords";
import {
  getNextIncompleteSection as getNextIncompleteSectionForApplication,
} from "../lib/applicationNextStep";
import {
  clearLocalApplicantProfile,
  type StoredApplicantProfile,
} from "../lib/applicantProfileStore";
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
import { initialApplicationData, mergeStoredApplicationData } from "../lib/applicationData";
import { createApplicationStorageAdapter } from "../lib/applicationStorageAdapter";
import {
  capturePostHogEvent,
  getApplicationAnalyticsProperties,
  getCourseAnalyticsProperties,
} from "../lib/posthog";
import { useAuth } from "./AuthContext";

interface ApplicationContextType {
  activeApplicationId: string | null;
  applicantProfile: StoredApplicantProfile | null;
  applications: ApplicationSummary[];
  data: ApplicationData;
  beginCourseApplication: (course: SelectedCourse) => Promise<ApplicationData>;
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

function replaceItemById<T extends { id: string }>(
  items: T[],
  id: string,
  nextItem: T,
) {
  return items.map((item) => (item.id === id ? nextItem : item));
}

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const { companyUserEmail, session, storageMode } = useAuth();
  const [data, setData] = useState<ApplicationData>(initialApplicationData);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(
    null,
  );
  const [applicantProfile, setApplicantProfile] =
    useState<StoredApplicantProfile | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const isMountedRef = useRef(true);
  const storageAdapter = useMemo(
    () => createApplicationStorageAdapter({ mode: storageMode, session }),
    [session, storageMode],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const upsertSummary = useCallback((application: ApplicationData) => {
    const summary = summarizeApplication(application);

    if (!summary) {
      return;
    }

    setApplications((previous) => {
      const next = previous.filter((item) => item.id !== summary.id);
      return [summary, ...next].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    });
  }, []);

  const persistApplication = useCallback(
    async (
      nextData: ApplicationData,
      options?: {
        applicantProfileId?: string | null;
        forceCreate?: boolean;
        keepActive?: boolean;
      },
    ) => {
      const mergedData = mergeStoredApplicationData(nextData);
      const resolvedApplicantProfileId =
        options?.applicantProfileId ??
        mergedData.applicationMeta.applicantProfileId ??
        applicantProfile?.id ??
        null;

      const persistedData = await storageAdapter.saveApplication(mergedData, {
        applicantProfileId: resolvedApplicantProfileId,
        forceCreate: options?.forceCreate,
      });

      upsertLocalApplication(persistedData);
      upsertSummary(persistedData);
      setData(persistedData);

      const nextActiveId =
        persistedData.applicationMeta.recordId ?? activeApplicationId;

      if (!options?.keepActive && nextActiveId) {
        setActiveApplicationId(nextActiveId);
        saveLocalActiveApplicationId(nextActiveId);
      }

      return persistedData;
    },
    [
      activeApplicationId,
      applicantProfile?.id,
      storageAdapter,
      upsertSummary,
    ],
  );

  const loadApplicationState = useCallback(async () => {
    setIsHydrating(true);

    try {
      const profile = await storageAdapter.ensureApplicantProfile(
        companyUserEmail ?? undefined,
      );

      if (!isMountedRef.current) {
        return;
      }

      setApplicantProfile(profile);
      const loadedApplications = await storageAdapter.listApplications();

      if (!isMountedRef.current) {
        return;
      }

      setApplications(loadedApplications);

      const preferredId =
        loadLocalActiveApplicationId() ??
        loadedApplications.find((application) => application.status === "draft")
          ?.id ??
        loadedApplications[0]?.id ??
        null;

      if (!preferredId) {
        setActiveApplicationId(null);
        setData(initialApplicationData);
        return;
      }

      let resolvedPreferredId = preferredId;
      let application = await storageAdapter.loadApplicationById(
        resolvedPreferredId,
      );

      if (!application) {
        const fallbackId =
          loadedApplications.find(
            (loadedApplication) => loadedApplication.id !== resolvedPreferredId,
          )?.id ?? null;

        if (!fallbackId) {
          setActiveApplicationId(null);
          setData(initialApplicationData);
          return;
        }

        resolvedPreferredId = fallbackId;
        application = await storageAdapter.loadApplicationById(resolvedPreferredId);
      }

      if (!application) {
        setActiveApplicationId(null);
        setData(initialApplicationData);
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setActiveApplicationId(resolvedPreferredId);
      saveLocalActiveApplicationId(resolvedPreferredId);
      setData(application);
      storageAdapter.syncLoadedApplication(application);
    } finally {
      if (isMountedRef.current) {
        setIsHydrating(false);
      }
    }
  }, [companyUserEmail, storageAdapter]);

  useEffect(() => {
    void loadApplicationState();
  }, [loadApplicationState]);

  const openApplication = useCallback(
    async (applicationId: string) => {
      const application = await storageAdapter.loadApplicationById(applicationId);

      if (!application) {
        return;
      }

      setData(application);
      setActiveApplicationId(applicationId);
      saveLocalActiveApplicationId(applicationId);
      storageAdapter.syncLoadedApplication(application);
      upsertSummary(application);
    },
    [storageAdapter, upsertSummary],
  );

  const refreshApplications = useCallback(async () => {
    await loadApplicationState();
  }, [loadApplicationState]);

  const refreshApplicantProfile = useCallback(async () => {
    const profile = await storageAdapter.loadApplicantProfile(
      companyUserEmail ?? undefined,
    );

    if (!isMountedRef.current) {
      return;
    }

    setApplicantProfile(profile);
  }, [companyUserEmail, storageAdapter]);

  const beginCourseApplication = useCallback(
    async (course: SelectedCourse) => {
      const resolvedApplicantProfile = await storageAdapter.ensureApplicantProfile(
        companyUserEmail ?? undefined,
      );

      if (isMountedRef.current) {
        setApplicantProfile(resolvedApplicantProfile);
      }

      const existingApplication = await storageAdapter.findOpenDraftForCourse(
        course.code,
        applications,
      );

      if (existingApplication?.id) {
        await openApplication(existingApplication.id);
        const reopenedApplication =
          (await storageAdapter.loadApplicationById(existingApplication.id)) ?? data;
        capturePostHogEvent("application_draft_resumed", {
          ...getCourseAnalyticsProperties(course),
          application_id: existingApplication.id,
          storage_mode: storageMode,
        });
        return reopenedApplication;
      }

      const draft = createApplicationDraft(
        course,
        resolvedApplicantProfile?.id ?? undefined,
        resolvedApplicantProfile,
      );

      const persisted = await persistApplication(draft, {
        applicantProfileId: resolvedApplicantProfile?.id ?? null,
        forceCreate: true,
      });
      capturePostHogEvent("application_draft_created", {
        ...getCourseAnalyticsProperties(course),
        applicant_profile_id: resolvedApplicantProfile?.id ?? null,
        application_id: persisted.applicationMeta.recordId ?? null,
        storage_mode: storageMode,
      });
      return persisted;
    },
    [
      applications,
      companyUserEmail,
      data,
      openApplication,
      persistApplication,
      storageAdapter,
      storageMode,
    ],
  );

  const ensureRemoteRecordId = useCallback(async () => {
    if (data.applicationMeta.recordId) {
      return data.applicationMeta.recordId;
    }

    const persisted = await persistApplication(data, { forceCreate: true });

    if (!persisted.applicationMeta.recordId) {
      throw new Error("Unable to create an application record.");
    }

    return persisted.applicationMeta.recordId;
  }, [data, persistApplication]);

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
      properties?: (nextData: ApplicationData) => Record<string, unknown>,
    ) => {
      const nextData = updater(data);
      const persisted = await persistApplication(nextData);
      capturePostHogEvent(eventName, {
        ...getApplicationAnalyticsProperties(persisted),
        ...properties?.(persisted),
      });
    },
    [data, persistApplication],
  );

  const markApplicationSubmitted = useCallback(async () => {
    const submittedApplication = await storageAdapter.submitApplication(data);

    upsertLocalApplication(submittedApplication);
    upsertSummary(submittedApplication);
    setData(submittedApplication);

    const nextActiveId =
      submittedApplication.applicationMeta.recordId ?? activeApplicationId;

    if (nextActiveId) {
      setActiveApplicationId(nextActiveId);
      saveLocalActiveApplicationId(nextActiveId);
    }

    capturePostHogEvent("application_submitted", {
      ...getCourseAnalyticsProperties(
        submittedApplication.applicationMeta.selectedCourse,
      ),
      application_id: submittedApplication.applicationMeta.recordId ?? null,
      application_number:
        submittedApplication.applicationMeta.applicationNumber ?? null,
      submission_mode: storageAdapter.mode,
    });
  }, [
    activeApplicationId,
    data,
    storageAdapter,
    upsertSummary,
  ]);

  const resetApplication = useCallback(async () => {
    await Promise.all(
      applications.map((application) =>
        storageAdapter.deleteApplication(application.id),
      ),
    );

    clearLocalApplications();
    clearLocalApplicantProfile();
    setApplications([]);
    setActiveApplicationId(null);
    setData(initialApplicationData);
    setApplicantProfile(null);
  }, [applications, storageAdapter]);

  const value = useMemo<ApplicationContextType>(
    () => ({
      activeApplicationId,
      applicantProfile,
      applications,
      data,
      beginCourseApplication,
      ensureRemoteRecordId,
      getNextIncompleteSection,
      isHydrating,
      markApplicationSubmitted,
      openApplication,
      refreshApplicantProfile,
      refreshApplications,
      resetApplication,
      selectCourse: beginCourseApplication,
      updateContactDetails: (updates) =>
        updateData((current) => ({
          ...current,
          contactDetails: {
            ...current.contactDetails,
            ...updates,
          },
        })),
      updatePersonalDetails: (updates) =>
        updateData((current) => ({
          ...current,
          personalDetails: {
            ...current.personalDetails,
            ...updates,
          },
        })),
      uploadCV: (document) =>
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
      replaceEmploymentExperiences: (experiences) =>
        updateDataWithEvent(
          (current) => ({
            ...current,
            employmentExperiences: experiences,
          }),
          "application_employment_experience_saved",
          () => ({
            action: "bulk_replaced_from_cv",
            total_count: experiences.length,
          }),
        ),
      addEmploymentExperience: (experience) =>
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
      updateEmploymentExperience: (id, experience) =>
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
      removeEmploymentExperience: (id) =>
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
      addLanguageTest: (test) =>
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
      updateLanguageTest: (id, test) =>
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
      removeLanguageTest: (id) =>
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
      addProfessionalAccreditation: (accreditation) =>
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
      updateProfessionalAccreditation: (id, accreditation) =>
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
      removeProfessionalAccreditation: (id) =>
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
      addSecondaryQualification: (qualification) =>
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
      updateSecondaryQualification: (id, qualification) =>
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
      removeSecondaryQualification: (id) =>
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
      addTertiaryQualification: (qualification) =>
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
      updateTertiaryQualification: (id, qualification) =>
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
      removeTertiaryQualification: (id) =>
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
    [
      activeApplicationId,
      applicantProfile,
      applications,
      beginCourseApplication,
      data,
      ensureRemoteRecordId,
      getNextIncompleteSection,
      isHydrating,
      markApplicationSubmitted,
      openApplication,
      refreshApplicantProfile,
      refreshApplications,
      resetApplication,
      updateData,
      updateDataWithEvent,
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
