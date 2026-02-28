import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  clearStoredDocuments,
  deleteStoredDocument,
  type UploadedDocument,
} from "../lib/documentStorage";
import { createApplicationNumber } from "../lib/applicationProgress";
import { hasStartedApplication } from "../lib/applicationProgress";
import { getNextIncompleteSection as getNextIncompleteApplicationSection } from "../lib/applicationNextStep";
import {
  clearLocalApplicationData,
  initialApplicationData,
  loadLocalApplicationData,
  mergeRemoteApplicationWithLocalDocuments,
  type ApplicationData,
  type ContactDetails,
  type EmploymentExperience,
  type LanguageTest,
  type PersonalDetails,
  type ProfessionalAccreditation,
  type SecondaryQualification,
  type TertiaryQualification,
  saveLocalApplicationData,
} from "../lib/applicationData";
import {
  deleteRemoteApplication,
  loadRemoteApplication,
  saveRemoteApplication,
  submitRemoteApplication,
} from "../lib/applicationRemoteStore";

interface ApplicationContextType {
  data: ApplicationData;
  ensureRemoteRecordId: () => Promise<string | undefined>;
  updatePersonalDetails: (details: Partial<PersonalDetails>) => void;
  updateContactDetails: (details: Partial<ContactDetails>) => void;
  selectCourse: (
    course: NonNullable<ApplicationData["applicationMeta"]["selectedCourse"]>,
  ) => void;
  addTertiaryQualification: (qualification: TertiaryQualification) => void;
  updateTertiaryQualification: (
    id: string,
    qualification: TertiaryQualification,
  ) => void;
  removeTertiaryQualification: (id: string) => void;
  addEmploymentExperience: (experience: EmploymentExperience) => void;
  updateEmploymentExperience: (
    id: string,
    experience: EmploymentExperience,
  ) => void;
  removeEmploymentExperience: (id: string) => void;
  addProfessionalAccreditation: (
    accreditation: ProfessionalAccreditation,
  ) => void;
  updateProfessionalAccreditation: (
    id: string,
    accreditation: ProfessionalAccreditation,
  ) => void;
  removeProfessionalAccreditation: (id: string) => void;
  addSecondaryQualification: (qualification: SecondaryQualification) => void;
  updateSecondaryQualification: (
    id: string,
    qualification: SecondaryQualification,
  ) => void;
  removeSecondaryQualification: (id: string) => void;
  addLanguageTest: (test: LanguageTest) => void;
  updateLanguageTest: (id: string, test: LanguageTest) => void;
  removeLanguageTest: (id: string) => void;
  uploadCV: (document: UploadedDocument) => void;
  removeCV: () => void;
  markApplicationSubmitted: () => Promise<void>;
  resetApplication: () => void;
  getNextIncompleteSection: () => string | null;
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(
  undefined,
);

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const { isBypassedInDev, isConfigured, session } = useAuth();
  const [data, setData] = useState<ApplicationData>(loadLocalApplicationData);
  const [hasHydratedRemote, setHasHydratedRemote] = useState(
    !(session && isConfigured && !isBypassedInDev),
  );
  const saveSequenceRef = useRef(0);

  useEffect(() => {
    saveLocalApplicationData(data);
  }, [data]);

  useEffect(() => {
    const canUseRemote = Boolean(session && isConfigured && !isBypassedInDev);

    if (!canUseRemote || !session) {
      setHasHydratedRemote(true);
      return;
    }

    let isCancelled = false;

    const hydrate = async () => {
      setHasHydratedRemote(false);
      const localData = loadLocalApplicationData();

      try {
        const remoteData = await loadRemoteApplication(session);

        if (isCancelled) {
          return;
        }

        if (remoteData) {
          const mergedData = mergeRemoteApplicationWithLocalDocuments(
            localData,
            remoteData,
          );
          setData(mergedData);
          saveLocalApplicationData(mergedData);
          setHasHydratedRemote(true);
          return;
        }

        if (hasStartedApplication(localData)) {
          const saveResult = await saveRemoteApplication(session, localData);

          if (isCancelled) {
            return;
          }

          if (
            saveResult &&
            (localData.applicationMeta.recordId !== saveResult.applicationId ||
              (localData.applicationMeta.applicantProfileId ?? null) !==
                saveResult.applicantProfileId)
          ) {
            const nextData = {
              ...localData,
              applicationMeta: {
                ...localData.applicationMeta,
                recordId: saveResult.applicationId,
                applicantProfileId: saveResult.applicantProfileId ?? undefined,
              },
            };
            setData(nextData);
            saveLocalApplicationData(nextData);
          }
        }
      } catch {
        // Keep local draft state active if remote hydration fails.
      } finally {
        if (!isCancelled) {
          setHasHydratedRemote(true);
        }
      }
    };

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, [isBypassedInDev, isConfigured, session]);

  useEffect(() => {
    const canUseRemote = Boolean(session && isConfigured && !isBypassedInDev);

    if (!canUseRemote || !session || !hasHydratedRemote) {
      return;
    }

    const saveSequence = ++saveSequenceRef.current;
    const timeoutId = window.setTimeout(() => {
      void saveRemoteApplication(session, data)
        .then((saveResult) => {
          if (
            !saveResult ||
            (data.applicationMeta.recordId === saveResult.applicationId &&
              (data.applicationMeta.applicantProfileId ?? null) ===
                saveResult.applicantProfileId) ||
            saveSequence !== saveSequenceRef.current
          ) {
            return;
          }

          setData((previous) => ({
            ...previous,
            applicationMeta: {
              ...previous.applicationMeta,
              recordId: saveResult.applicationId,
              applicantProfileId: saveResult.applicantProfileId ?? undefined,
            },
          }));
        })
        .catch(() => {
          // Keep local draft state active if remote save fails.
        });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [data, hasHydratedRemote, isBypassedInDev, isConfigured, session]);

  const value = useMemo<ApplicationContextType>(
    () => ({
      data,
      ensureRemoteRecordId: async () => {
        if (!session || !isConfigured || isBypassedInDev) {
          return undefined;
        }

        if (data.applicationMeta.recordId) {
          return data.applicationMeta.recordId;
        }

        const saveResult = await saveRemoteApplication(session, data, {
          forceCreate: true,
        });

        if (saveResult) {
          setData((previous) => ({
            ...previous,
            applicationMeta: {
              ...previous.applicationMeta,
              recordId: saveResult.applicationId,
              applicantProfileId:
                saveResult.applicantProfileId ?? undefined,
            },
          }));
        }

        return saveResult?.applicationId ?? undefined;
      },
      updatePersonalDetails: (details) => {
        setData((previous) => ({
          ...previous,
          personalDetails: { ...previous.personalDetails, ...details },
        }));
      },
      updateContactDetails: (details) => {
        setData((previous) => ({
          ...previous,
          contactDetails: { ...previous.contactDetails, ...details },
        }));
      },
      selectCourse: (course) => {
        setData((previous) => ({
          ...previous,
          applicationMeta: {
            ...previous.applicationMeta,
            selectedCourse: course,
          },
        }));
      },
      addTertiaryQualification: (qualification) => {
        setData((previous) => ({
          ...previous,
          tertiaryQualifications: [
            ...previous.tertiaryQualifications,
            qualification,
          ],
        }));
      },
      updateTertiaryQualification: (id, qualification) => {
        setData((previous) => ({
          ...previous,
          tertiaryQualifications: previous.tertiaryQualifications.map((item) =>
            item.id === id ? qualification : item,
          ),
        }));
      },
      removeTertiaryQualification: (id) => {
        setData((previous) => {
          const target = previous.tertiaryQualifications.find((item) => item.id === id);
          void deleteStoredDocument(target?.transcriptDocument);
          void deleteStoredDocument(target?.certificateDocument);

          return {
            ...previous,
            tertiaryQualifications: previous.tertiaryQualifications.filter(
              (item) => item.id !== id,
            ),
          };
        });
      },
      addEmploymentExperience: (experience) => {
        setData((previous) => ({
          ...previous,
          employmentExperiences: [...previous.employmentExperiences, experience],
        }));
      },
      updateEmploymentExperience: (id, experience) => {
        setData((previous) => ({
          ...previous,
          employmentExperiences: previous.employmentExperiences.map((item) =>
            item.id === id ? experience : item,
          ),
        }));
      },
      removeEmploymentExperience: (id) => {
        setData((previous) => ({
          ...previous,
          employmentExperiences: previous.employmentExperiences.filter(
            (item) => item.id !== id,
          ),
        }));
      },
      addProfessionalAccreditation: (accreditation) => {
        setData((previous) => ({
          ...previous,
          professionalAccreditations: [
            ...previous.professionalAccreditations,
            accreditation,
          ],
        }));
      },
      updateProfessionalAccreditation: (id, accreditation) => {
        setData((previous) => ({
          ...previous,
          professionalAccreditations: previous.professionalAccreditations.map(
            (item) => (item.id === id ? accreditation : item),
          ),
        }));
      },
      removeProfessionalAccreditation: (id) => {
        setData((previous) => {
          const target = previous.professionalAccreditations.find(
            (item) => item.id === id,
          );
          void deleteStoredDocument(target?.document);

          return {
            ...previous,
            professionalAccreditations:
              previous.professionalAccreditations.filter((item) => item.id !== id),
          };
        });
      },
      addSecondaryQualification: (qualification) => {
        setData((previous) => ({
          ...previous,
          secondaryQualifications: [
            ...previous.secondaryQualifications,
            qualification,
          ],
        }));
      },
      updateSecondaryQualification: (id, qualification) => {
        setData((previous) => ({
          ...previous,
          secondaryQualifications: previous.secondaryQualifications.map((item) =>
            item.id === id ? qualification : item,
          ),
        }));
      },
      removeSecondaryQualification: (id) => {
        setData((previous) => ({
          ...previous,
          secondaryQualifications: previous.secondaryQualifications.filter(
            (item) => item.id !== id,
          ),
        }));
      },
      addLanguageTest: (test) => {
        setData((previous) => ({
          ...previous,
          languageTests: [...previous.languageTests, test],
        }));
      },
      updateLanguageTest: (id, test) => {
        setData((previous) => ({
          ...previous,
          languageTests: previous.languageTests.map((item) =>
            item.id === id ? test : item,
          ),
        }));
      },
      removeLanguageTest: (id) => {
        setData((previous) => {
          const target = previous.languageTests.find((item) => item.id === id);
          void deleteStoredDocument(target?.document);

          return {
            ...previous,
            languageTests: previous.languageTests.filter((item) => item.id !== id),
          };
        });
      },
      uploadCV: (document) => {
        setData((previous) => ({
          ...previous,
          cvUploaded: true,
          cvDocument: document,
          cvFileName: document.name,
        }));
      },
      removeCV: () => {
        setData((previous) => ({
          ...previous,
          cvUploaded: false,
          cvDocument: undefined,
          cvFileName: undefined,
        }));
      },
      markApplicationSubmitted: async () => {
        if (session && isConfigured && !isBypassedInDev) {
          const submission = await submitRemoteApplication(session, data);

          setData((previous) => ({
            ...previous,
            applicationMeta: {
              ...previous.applicationMeta,
              recordId: submission.applicationId,
              applicationNumber: submission.applicationNumber,
              submittedAt: submission.submittedAt,
            },
          }));
          return;
        }

        setData((previous) => ({
          ...previous,
          applicationMeta: {
            applicationNumber:
              previous.applicationMeta.applicationNumber ?? createApplicationNumber(),
            submittedAt: new Date().toISOString(),
          },
        }));
      },
      resetApplication: () => {
        void clearStoredDocuments();
        if (session && isConfigured && !isBypassedInDev && data.applicationMeta.recordId) {
          void deleteRemoteApplication(session, data.applicationMeta.recordId).catch(
            () => {
              // Keep local reset behavior even if remote cleanup fails.
            },
          );
        }
        setData(initialApplicationData);
        clearLocalApplicationData();
      },
      getNextIncompleteSection: () => {
        return getNextIncompleteApplicationSection(data);
      },
    }),
    [data, isBypassedInDev, isConfigured, session],
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
    throw new Error("useApplication must be used within ApplicationProvider");
  }
  return context;
}
