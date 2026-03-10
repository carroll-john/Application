import { createEmptyStructuredAddress, type StructuredAddress } from "./address";
import type { UploadedDocument } from "./documentStorage";

export const APPLICATION_STORAGE_KEY = "application-prototype:data";

export interface TertiaryQualification {
  id: string;
  institution: string;
  country: string;
  level: string;
  courseName: string;
  startMonth: string;
  startYear: string;
  completed: boolean;
  endMonth: string;
  endYear: string;
  transcriptDocument?: UploadedDocument;
  transcriptDocumentName?: string;
  certificateDocument?: UploadedDocument;
  certificateDocumentName?: string;
}

export interface EmploymentExperience {
  id: string;
  company: string;
  position: string;
  type: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  currentRole: boolean;
  duties: string;
}

export interface ProfessionalAccreditation {
  id: string;
  name: string;
  status: string;
  document?: UploadedDocument;
  documentName?: string;
}

export interface SecondaryQualification {
  id: string;
  type: string;
  country: string;
  state: string;
  school: string;
  qualification: string;
  year: string;
}

export interface LanguageTest {
  id: string;
  type: string;
  name: string;
  year: string;
  document?: UploadedDocument;
  documentName?: string;
}

export interface PersonalDetails {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  gender: string;
  dateOfBirth: string;
  email: string;
  phone: string;
}

export interface ContactDetails {
  citizenCountry: string;
  birthCountry: string;
  citizenshipStatus: string;
  residentialAddress: StructuredAddress;
  postalDifferent: boolean;
  postalAddress: StructuredAddress;
  language: string;
  aboriginal: string;
  schoolLevel: string;
  parentsCount: string;
  parent1Details: string;
  parent2Details: string;
  parent3Details: string;
  parent4Details: string;
  parent5Details: string;
  hasDisability: boolean;
  disabilityDetails: string;
}

export interface SelectedCourse {
  code: string;
  title: string;
  provider: string;
  intake: string;
}

export interface ApplicationPrefillSource {
  applicationId: string;
  course: SelectedCourse;
}

export interface ApplicationMeta {
  recordId?: string;
  applicantProfileId?: string;
  applicationNumber?: string;
  createdAt?: string;
  prefilledFrom?: ApplicationPrefillSource;
  status?: "draft" | "submitted";
  submittedAt?: string;
  selectedCourse?: SelectedCourse;
  updatedAt?: string;
}

export interface ApplicationData {
  applicationMeta: ApplicationMeta;
  personalDetails: PersonalDetails;
  contactDetails: ContactDetails;
  tertiaryQualifications: TertiaryQualification[];
  employmentExperiences: EmploymentExperience[];
  professionalAccreditations: ProfessionalAccreditation[];
  secondaryQualifications: SecondaryQualification[];
  languageTests: LanguageTest[];
  cvUploaded: boolean;
  cvDocument?: UploadedDocument;
  cvFileName?: string;
}

export const initialApplicationData: ApplicationData = {
  applicationMeta: {},
  personalDetails: {
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    preferredName: "",
    gender: "",
    dateOfBirth: "",
    email: "",
    phone: "",
  },
  contactDetails: {
    citizenCountry: "",
    birthCountry: "",
    citizenshipStatus: "",
    residentialAddress: createEmptyStructuredAddress(),
    postalDifferent: false,
    postalAddress: createEmptyStructuredAddress(),
    language: "",
    aboriginal: "",
    schoolLevel: "",
    parentsCount: "",
    parent1Details: "",
    parent2Details: "",
    parent3Details: "",
    parent4Details: "",
    parent5Details: "",
    hasDisability: false,
    disabilityDetails: "",
  },
  tertiaryQualifications: [],
  employmentExperiences: [],
  professionalAccreditations: [],
  secondaryQualifications: [],
  languageTests: [],
  cvUploaded: false,
};

export function mergeStoredApplicationData(
  storedData: Partial<ApplicationData> | null | undefined,
): ApplicationData {
  return {
    ...initialApplicationData,
    ...storedData,
    applicationMeta: {
      ...initialApplicationData.applicationMeta,
      ...storedData?.applicationMeta,
    },
    personalDetails: {
      ...initialApplicationData.personalDetails,
      ...storedData?.personalDetails,
    },
    contactDetails: {
      ...initialApplicationData.contactDetails,
      ...storedData?.contactDetails,
      residentialAddress: {
        ...createEmptyStructuredAddress(),
        ...storedData?.contactDetails?.residentialAddress,
      },
      postalAddress: {
        ...createEmptyStructuredAddress(),
        ...storedData?.contactDetails?.postalAddress,
      },
    },
    tertiaryQualifications: Array.isArray(storedData?.tertiaryQualifications)
      ? storedData.tertiaryQualifications.map((qualification) => {
          const legacyQualification = qualification as TertiaryQualification & {
            document?: UploadedDocument;
            documentName?: string;
          };

          return {
            ...qualification,
            transcriptDocument:
              qualification.transcriptDocument ?? legacyQualification.document,
            transcriptDocumentName:
              qualification.transcriptDocumentName ??
              legacyQualification.documentName,
            certificateDocument: qualification.certificateDocument,
            certificateDocumentName: qualification.certificateDocumentName,
          };
        })
      : initialApplicationData.tertiaryQualifications,
    employmentExperiences: Array.isArray(storedData?.employmentExperiences)
      ? storedData.employmentExperiences
      : initialApplicationData.employmentExperiences,
    professionalAccreditations: Array.isArray(
      storedData?.professionalAccreditations,
    )
      ? storedData.professionalAccreditations
      : initialApplicationData.professionalAccreditations,
    secondaryQualifications: Array.isArray(storedData?.secondaryQualifications)
      ? storedData.secondaryQualifications
      : initialApplicationData.secondaryQualifications,
    languageTests: Array.isArray(storedData?.languageTests)
      ? storedData.languageTests
      : initialApplicationData.languageTests,
  };
}

export function loadLocalApplicationData(): ApplicationData {
  if (typeof window === "undefined") {
    return initialApplicationData;
  }

  try {
    const storedData = window.localStorage.getItem(APPLICATION_STORAGE_KEY);

    if (!storedData) {
      return initialApplicationData;
    }

    return mergeStoredApplicationData(JSON.parse(storedData) as Partial<ApplicationData>);
  } catch {
    return initialApplicationData;
  }
}

export function saveLocalApplicationData(data: ApplicationData) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage failures and continue using in-memory state.
  }
}

export function clearLocalApplicationData() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(APPLICATION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function mergeRemoteApplicationWithLocalDocuments(
  localData: ApplicationData,
  remoteData: ApplicationData,
): ApplicationData {
  const localTertiaryMap = new Map(
    localData.tertiaryQualifications.map((qualification) => [
      qualification.id,
      qualification,
    ]),
  );
  const localAccreditationMap = new Map(
    localData.professionalAccreditations.map((accreditation) => [
      accreditation.id,
      accreditation,
    ]),
  );
  const localLanguageTestMap = new Map(
    localData.languageTests.map((test) => [test.id, test]),
  );

  return {
    ...remoteData,
    cvUploaded: remoteData.cvUploaded || localData.cvUploaded,
    cvDocument: remoteData.cvDocument ?? localData.cvDocument,
    cvFileName: remoteData.cvFileName ?? localData.cvFileName,
    tertiaryQualifications: remoteData.tertiaryQualifications.map((qualification) => {
      const localQualification = localTertiaryMap.get(qualification.id);

      return {
        ...qualification,
        transcriptDocument:
          qualification.transcriptDocument ?? localQualification?.transcriptDocument,
        transcriptDocumentName:
          qualification.transcriptDocumentName ??
          localQualification?.transcriptDocumentName,
        certificateDocument:
          qualification.certificateDocument ??
          localQualification?.certificateDocument,
        certificateDocumentName:
          qualification.certificateDocumentName ??
          localQualification?.certificateDocumentName,
      };
    }),
    professionalAccreditations: remoteData.professionalAccreditations.map(
      (accreditation) => {
        const localAccreditation = localAccreditationMap.get(accreditation.id);

        return {
          ...accreditation,
          document: accreditation.document ?? localAccreditation?.document,
          documentName:
            accreditation.documentName ?? localAccreditation?.documentName,
        };
      },
    ),
    languageTests: remoteData.languageTests.map((test) => {
      const localTest = localLanguageTestMap.get(test.id);

      return {
        ...test,
        document: test.document ?? localTest?.document,
        documentName: test.documentName ?? localTest?.documentName,
      };
    }),
  };
}
