import type { ApplicationData } from "../../../lib/applicationData";
import {
  duplicateStoredDocument,
  type DocumentKind,
} from "../../../lib/documentStorage";

async function duplicateApplicationDocument(
  document: ApplicationData["cvDocument"] | undefined,
  applicationId: string,
  kind: DocumentKind,
) {
  return duplicateStoredDocument(document, {
    applicationId,
    kind,
  });
}

export async function cloneSourceApplicationDocuments(
  application: ApplicationData,
  sourceApplication: ApplicationData,
) {
  const applicationId = application.applicationMeta.recordId;

  if (!applicationId) {
    return application;
  }

  const cvDocument = await duplicateApplicationDocument(
    sourceApplication.cvDocument,
    applicationId,
    "cv",
  );

  const tertiaryQualifications = await Promise.all(
    application.tertiaryQualifications.map(async (qualification, index) => {
      const sourceQualification = sourceApplication.tertiaryQualifications[index];

      if (!sourceQualification) {
        return qualification;
      }

      const [transcriptDocument, certificateDocument] = await Promise.all([
        duplicateApplicationDocument(
          sourceQualification.transcriptDocument,
          applicationId,
          "tertiary_transcript",
        ),
        sourceQualification.completed
          ? duplicateApplicationDocument(
              sourceQualification.certificateDocument,
              applicationId,
              "tertiary_certificate",
            )
          : Promise.resolve(undefined),
      ]);

      return {
        ...qualification,
        certificateDocument,
        certificateDocumentName:
          certificateDocument?.name ??
          sourceQualification.certificateDocumentName,
        transcriptDocument,
        transcriptDocumentName:
          transcriptDocument?.name ?? sourceQualification.transcriptDocumentName,
      };
    }),
  );

  const professionalAccreditations = await Promise.all(
    application.professionalAccreditations.map(async (accreditation, index) => {
      const sourceAccreditation =
        sourceApplication.professionalAccreditations[index];

      if (!sourceAccreditation) {
        return accreditation;
      }

      const document = await duplicateApplicationDocument(
        sourceAccreditation.document,
        applicationId,
        "accreditation_document",
      );

      return {
        ...accreditation,
        document,
        documentName: document?.name ?? sourceAccreditation.documentName,
      };
    }),
  );

  const languageTests = await Promise.all(
    application.languageTests.map(async (test, index) => {
      const sourceTest = sourceApplication.languageTests[index];

      if (!sourceTest) {
        return test;
      }

      const document = await duplicateApplicationDocument(
        sourceTest.document,
        applicationId,
        "language_test_document",
      );

      return {
        ...test,
        document,
        documentName: document?.name ?? sourceTest.documentName,
      };
    }),
  );

  return {
    ...application,
    cvDocument,
    cvFileName: cvDocument?.name ?? sourceApplication.cvFileName,
    cvUploaded: Boolean(
      cvDocument ||
        sourceApplication.cvFileName ||
        sourceApplication.cvDocument,
    ),
    languageTests,
    professionalAccreditations,
    tertiaryQualifications,
  };
}
