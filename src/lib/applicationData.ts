import { createEmptyStructuredAddress, type StructuredAddress } from "./address";
import type { UploadedDocument } from "./documentStorage";
import type { TranscriptEligibilityAssessment } from "./eligibility/types";

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
  transcriptEligibility?: TranscriptEligibilityAssessment;
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
  hasDisability: boolean | null;
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
    hasDisability: null,
    disabilityDetails: "",
  },
  tertiaryQualifications: [],
  employmentExperiences: [],
  professionalAccreditations: [],
  secondaryQualifications: [],
  languageTests: [],
  cvUploaded: false,
};

function isLegacyUnansweredSupportState(details: ContactDetails) {
  return (
    details.hasDisability === false &&
    !details.parentsCount &&
    !details.parent1Details &&
    !details.parent2Details &&
    !details.parent3Details &&
    !details.parent4Details &&
    !details.parent5Details &&
    !details.disabilityDetails
  );
}

export function mergeStoredApplicationData(
  storedData: Partial<ApplicationData> | null | undefined,
): ApplicationData {
  const mergedContactDetails = normalizeConditionalContactDetails({
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
  });

  if (isLegacyUnansweredSupportState(mergedContactDetails)) {
    mergedContactDetails.hasDisability = null;
  }

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
    contactDetails: mergedContactDetails,
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

const conditionalParentFields = [
  "parent1Details",
  "parent2Details",
  "parent3Details",
  "parent4Details",
  "parent5Details",
] as const;

export function normalizeConditionalContactDetails(
  details: ContactDetails,
): ContactDetails {
  const nextDetails = { ...details };
  const parsedParentCount = Number.parseInt(details.parentsCount, 10);
  const visibleParentCount = Number.isFinite(parsedParentCount)
    ? Math.max(0, Math.min(parsedParentCount, conditionalParentFields.length))
    : 0;

  conditionalParentFields.forEach((field, index) => {
    if (index >= visibleParentCount) {
      nextDetails[field] = "";
    }
  });

  if (details.hasDisability !== true) {
    nextDetails.disabilityDetails = "";
  }

  return nextDetails;
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

const REMOTE_RECORD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRemoteRecordId(
  recordId: string | undefined,
): recordId is string {
  return Boolean(recordId && REMOTE_RECORD_ID_PATTERN.test(recordId));
}
