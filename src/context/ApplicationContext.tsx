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
  findLocalApplicationById,
  findLocalOpenApplicationForCourse,
  loadLocalActiveApplicationId,
  loadLocalApplications,
  saveLocalActiveApplicationId,
  summarizeApplication,
  upsertLocalApplication,
  type ApplicationSummary,
} from "../lib/applicationRecords";
import {
  getNextIncompleteSection as getNextIncompleteSectionForApplication,
} from "../lib/applicationNextStep";
import {
  deleteRemoteApplication,
  listRemoteApplications,
  loadRemoteApplicationById,
  saveRemoteApplication,
  submitRemoteApplication,
} from "../lib/applicationRemoteStore";
import {
  clearLocalApplicantProfile,
  loadApplicantProfile,
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
  refreshApplications: () => Promise<void>;
  resetApplication: () => Promise<void>;
  selectCourse: (course: SelectedCourse) => Promise<ApplicationData>;
  updateContactDetails: (updates: Partial<ContactDetails>) => Promise<void>;
  updatePersonalDetails: (updates: Partial<PersonalDetails>) => Promise<void>;
  uploadCV: (document: NonNullable<ApplicationData["cvDocument"]>) => Promise<void>;
  removeCV: () => Promise<void>;
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
  const {
    isAuthorizedCompanyUser,
    isBypassedInDev,
    isConfigured,
    session,
  } = useAuth();
  const [data, setData] = useState<ApplicationData>(initialApplicationData);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(
    null,
  );
  const [applicantProfile, setApplicantProfile] =
    useState<StoredApplicantProfile | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
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
      options?: { forceCreate?: boolean; keepActive?: boolean },
    ) => {
      const mergedData = mergeStoredApplicationData(nextData);
      let persistedData = mergedData;

      if (session && isAuthorizedCompanyUser && isConfigured) {
        const saveResult = await saveRemoteApplication(session, mergedData, {
          applicantProfileId:
            mergedData.applicationMeta.applicantProfileId ??
            applicantProfile?.id ??
            null,
          forceCreate: options?.forceCreate,
        });

        if (saveResult) {
          persistedData = mergeStoredApplicationData({
            ...mergedData,
            applicationMeta: {
              ...mergedData.applicationMeta,
              applicantProfileId:
                saveResult.applicantProfileId ??
                mergedData.applicationMeta.applicantProfileId,
              applicationNumber:
                saveResult.applicationNumber ??
                mergedData.applicationMeta.applicationNumber,
              recordId: saveResult.applicationId,
              status: saveResult.submittedAt ? "submitted" : "draft",
              submittedAt:
                saveResult.submittedAt ?? mergedData.applicationMeta.submittedAt,
              updatedAt: saveResult.updatedAt,
            },
          });
        }
      } else {
        persistedData = mergeStoredApplicationData({
          ...mergedData,
          applicationMeta: {
            ...mergedData.applicationMeta,
            applicantProfileId:
              mergedData.applicationMeta.applicantProfileId ??
              applicantProfile?.id,
          },
        });
      }

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
      isAuthorizedCompanyUser,
      isConfigured,
      session,
      upsertSummary,
    ],
  );

  const loadApplicationState = useCallback(async () => {
    setIsHydrating(true);

    try {
      const profile = await loadApplicantProfile(session ?? null);

      if (!isMountedRef.current) {
        return;
      }

      setApplicantProfile(profile);

      if (session && isAuthorizedCompanyUser && isConfigured) {
        const remoteApplications = await listRemoteApplications(session);

        if (!isMountedRef.current) {
          return;
        }

        setApplications(remoteApplications);

        const preferredId =
          loadLocalActiveApplicationId() ??
          remoteApplications.find((application) => application.status === "draft")
            ?.id ??
          remoteApplications[0]?.id ??
          null;

        if (!preferredId) {
          setActiveApplicationId(null);
          setData(initialApplicationData);
          return;
        }

        const remoteApplication =
          (await loadRemoteApplicationById(session, preferredId)) ??
          initialApplicationData;

        if (!isMountedRef.current) {
          return;
        }

        setActiveApplicationId(preferredId);
        saveLocalActiveApplicationId(preferredId);
        setData(remoteApplication);
        upsertLocalApplication(remoteApplication);
        return;
      }

      const localApplications = loadLocalApplications();
      const localSummaries = localApplications
        .map((application) => summarizeApplication(application))
        .filter((summary): summary is ApplicationSummary => Boolean(summary))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

      setApplications(localSummaries);

      const preferredId =
        loadLocalActiveApplicationId() ??
        localSummaries.find((application) => application.status === "draft")?.id ??
        localSummaries[0]?.id ??
        null;

      if (!preferredId) {
        setActiveApplicationId(null);
        setData(initialApplicationData);
        return;
      }

      const localApplication =
        findLocalApplicationById(preferredId) ?? initialApplicationData;
      setActiveApplicationId(preferredId);
      saveLocalActiveApplicationId(preferredId);
      setData(localApplication);
    } finally {
      if (isMountedRef.current) {
        setIsHydrating(false);
      }
    }
  }, [isAuthorizedCompanyUser, isConfigured, session]);

  useEffect(() => {
    void loadApplicationState();
  }, [loadApplicationState]);

  const openApplication = useCallback(
    async (applicationId: string) => {
      if (session && isAuthorizedCompanyUser && isConfigured) {
        const remoteApplication = await loadRemoteApplicationById(
          session,
          applicationId,
        );

        if (!remoteApplication) {
          return;
        }

        setData(remoteApplication);
        setActiveApplicationId(applicationId);
        saveLocalActiveApplicationId(applicationId);
        upsertLocalApplication(remoteApplication);
        upsertSummary(remoteApplication);
        return;
      }

      const localApplication = findLocalApplicationById(applicationId);

      if (!localApplication) {
        return;
      }

      setData(localApplication);
      setActiveApplicationId(applicationId);
      saveLocalActiveApplicationId(applicationId);
      upsertSummary(localApplication);
    },
    [isAuthorizedCompanyUser, isConfigured, session, upsertSummary],
  );

  const refreshApplications = useCallback(async () => {
    await loadApplicationState();
  }, [loadApplicationState]);

  const beginCourseApplication = useCallback(
    async (course: SelectedCourse) => {
      const existingApplication = session && isAuthorizedCompanyUser && isConfigured
        ? applications.find(
            (application) =>
              application.course.code === course.code &&
              application.status === "draft",
          )
        : summarizeApplication(
            findLocalOpenApplicationForCourse(course.code) ?? initialApplicationData,
          );

      if (existingApplication?.id) {
        await openApplication(existingApplication.id);
        const reopenedApplication =
          (session && isAuthorizedCompanyUser && isConfigured
            ? await loadRemoteApplicationById(session, existingApplication.id)
            : findLocalApplicationById(existingApplication.id)) ?? data;
        return reopenedApplication;
      }

      const draft = createApplicationDraft(
        course,
        applicantProfile?.id ?? undefined,
        applicantProfile,
      );

      const persisted = await persistApplication(draft, { forceCreate: true });
      return persisted;
    },
    [
      applicantProfile?.id,
      applications,
      data,
      isAuthorizedCompanyUser,
      isConfigured,
      openApplication,
      persistApplication,
      session,
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

  const markApplicationSubmitted = useCallback(async () => {
    const nextSubmittedAt = new Date().toISOString();

    if (session && isAuthorizedCompanyUser && isConfigured) {
      const submission = await submitRemoteApplication(session, data);
      const nextData = mergeStoredApplicationData({
        ...data,
        applicationMeta: {
          ...data.applicationMeta,
          applicationNumber: submission.applicationNumber,
          recordId: submission.applicationId,
          status: "submitted",
          submittedAt: submission.submittedAt,
          updatedAt: submission.submittedAt,
        },
      });

      upsertLocalApplication(nextData);
      upsertSummary(nextData);
      setData(nextData);
      return;
    }

    const nextData = mergeStoredApplicationData({
      ...data,
      applicationMeta: {
        ...data.applicationMeta,
        applicationNumber:
          data.applicationMeta.applicationNumber ??
          `QX-${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: "submitted",
        submittedAt: nextSubmittedAt,
        updatedAt: nextSubmittedAt,
      },
    });
    await persistApplication(nextData);
  }, [
    data,
    isAuthorizedCompanyUser,
    isConfigured,
    persistApplication,
    session,
    upsertSummary,
  ]);

  const resetApplication = useCallback(async () => {
    if (session && isAuthorizedCompanyUser && isConfigured) {
      await Promise.all(
        applications.map((application) => deleteRemoteApplication(session, application.id)),
      );
    }

    clearLocalApplications();
    clearLocalApplicantProfile();
    setApplications([]);
    setActiveApplicationId(null);
    setData(initialApplicationData);
    setApplicantProfile(null);
  }, [applications, isAuthorizedCompanyUser, isConfigured, session]);

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
        updateData((current) => ({
          ...current,
          cvDocument: document,
          cvFileName: document.name,
          cvUploaded: true,
        })),
      removeCV: () =>
        updateData((current) => ({
          ...current,
          cvDocument: undefined,
          cvFileName: undefined,
          cvUploaded: false,
        })),
      addEmploymentExperience: (experience) =>
        updateData((current) => ({
          ...current,
          employmentExperiences: [...current.employmentExperiences, experience],
        })),
      updateEmploymentExperience: (id, experience) =>
        updateData((current) => ({
          ...current,
          employmentExperiences: replaceItemById(
            current.employmentExperiences,
            id,
            experience,
          ),
        })),
      removeEmploymentExperience: (id) =>
        updateData((current) => ({
          ...current,
          employmentExperiences: current.employmentExperiences.filter(
            (experience) => experience.id !== id,
          ),
        })),
      addLanguageTest: (test) =>
        updateData((current) => ({
          ...current,
          languageTests: [...current.languageTests, test],
        })),
      updateLanguageTest: (id, test) =>
        updateData((current) => ({
          ...current,
          languageTests: replaceItemById(current.languageTests, id, test),
        })),
      removeLanguageTest: (id) =>
        updateData((current) => ({
          ...current,
          languageTests: current.languageTests.filter((test) => test.id !== id),
        })),
      addProfessionalAccreditation: (accreditation) =>
        updateData((current) => ({
          ...current,
          professionalAccreditations: [
            ...current.professionalAccreditations,
            accreditation,
          ],
        })),
      updateProfessionalAccreditation: (id, accreditation) =>
        updateData((current) => ({
          ...current,
          professionalAccreditations: replaceItemById(
            current.professionalAccreditations,
            id,
            accreditation,
          ),
        })),
      removeProfessionalAccreditation: (id) =>
        updateData((current) => ({
          ...current,
          professionalAccreditations: current.professionalAccreditations.filter(
            (accreditation) => accreditation.id !== id,
          ),
        })),
      addSecondaryQualification: (qualification) =>
        updateData((current) => ({
          ...current,
          secondaryQualifications: [
            ...current.secondaryQualifications,
            qualification,
          ],
        })),
      updateSecondaryQualification: (id, qualification) =>
        updateData((current) => ({
          ...current,
          secondaryQualifications: replaceItemById(
            current.secondaryQualifications,
            id,
            qualification,
          ),
        })),
      removeSecondaryQualification: (id) =>
        updateData((current) => ({
          ...current,
          secondaryQualifications: current.secondaryQualifications.filter(
            (qualification) => qualification.id !== id,
          ),
        })),
      addTertiaryQualification: (qualification) =>
        updateData((current) => ({
          ...current,
          tertiaryQualifications: [
            ...current.tertiaryQualifications,
            qualification,
          ],
        })),
      updateTertiaryQualification: (id, qualification) =>
        updateData((current) => ({
          ...current,
          tertiaryQualifications: replaceItemById(
            current.tertiaryQualifications,
            id,
            qualification,
          ),
        })),
      removeTertiaryQualification: (id) =>
        updateData((current) => ({
          ...current,
          tertiaryQualifications: current.tertiaryQualifications.filter(
            (qualification) => qualification.id !== id,
          ),
        })),
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
      refreshApplications,
      resetApplication,
      updateData,
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
