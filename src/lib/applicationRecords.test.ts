import { describe, expect, it } from "vitest";
import { mergeStoredApplicationData } from "./applicationData";
import {
  createApplicationDraft,
  sortApplicationsForPrefillChooser,
  summarizeApplication,
} from "./applicationRecords";

describe("application records", () => {
  it("creates a draft seeded from the selected course and reusable profile", () => {
    const draft = createApplicationDraft(
      {
        code: "mba-online",
        intake: "12 May 2025",
        provider: "Southern Cross University",
        title: "Master of Business Administration (MBA) online",
      },
      "profile-1",
      {
        email: "john.carroll@keypathedu.com.au",
        firstName: "John",
        id: "profile-1",
        lastName: "Carroll",
      },
    );

    expect(draft.applicationMeta).toMatchObject({
      applicantProfileId: "profile-1",
      selectedCourse: {
        code: "mba-online",
        intake: "12 May 2025",
      },
      status: "draft",
    });
    expect(draft.personalDetails).toMatchObject({
      email: "john.carroll@keypathedu.com.au",
      firstName: "John",
      lastName: "Carroll",
      phone: "",
      preferredName: "",
    });
    expect(draft.applicationMeta.prefilledFrom).toBeUndefined();
  });

  it("clones reusable application data from a prior application", () => {
    const priorApplication = mergeStoredApplicationData({
      applicationMeta: {
        recordId: "source-app-1",
        selectedCourse: {
          code: "mba-online",
          intake: "January 2026",
          provider: "Southern Cross University",
          title: "Master of Business Administration (MBA) online",
        },
      },
      contactDetails: {
        aboriginal: "No",
        birthCountry: "Australia",
        citizenCountry: "Australia",
        citizenshipStatus: "Citizen",
        disabilityDetails: "Low vision",
        hasDisability: true,
        language: "English",
        parent1Details: "Parent 1",
        parent2Details: "Parent 2",
        parent3Details: "",
        parent4Details: "",
        parent5Details: "",
        parentsCount: "2",
        postalAddress: {
          country: "Australia",
          formattedAddress: "PO Box 2, Melbourne VIC 3001",
          postcode: "3001",
          state: "VIC",
          streetAddress: "PO Box 2",
          suburb: "Melbourne",
        },
        postalDifferent: true,
        residentialAddress: {
          country: "Australia",
          formattedAddress: "1 Test St, Melbourne VIC 3000",
          postcode: "3000",
          state: "VIC",
          streetAddress: "1 Test St",
          suburb: "Melbourne",
        },
        schoolLevel: "Year 12",
      },
      cvDocument: {
        id: "cv-doc-1",
        lastModified: 1,
        name: "resume.pdf",
        size: 1024,
        source: "local",
        type: "application/pdf",
        uploadedAt: "2026-01-10T10:00:00.000Z",
      },
      cvFileName: "resume.pdf",
      cvUploaded: true,
      employmentExperiences: [
        {
          company: "Acme Health",
          currentRole: true,
          duties: "Managed program delivery",
          endMonth: "",
          endYear: "",
          id: "exp-1",
          position: "Program Lead",
          startMonth: "January",
          startYear: "2020",
          type: "Full-time",
        },
      ],
      languageTests: [
        {
          document: {
            id: "lang-doc-1",
            lastModified: 2,
            name: "ielts.pdf",
            size: 2048,
            source: "local",
            type: "application/pdf",
            uploadedAt: "2026-01-11T10:00:00.000Z",
          },
          documentName: "ielts.pdf",
          id: "language-1",
          name: "IELTS Academic",
          type: "IELTS",
          year: "2024",
        },
      ],
      personalDetails: {
        dateOfBirth: "1992-04-03",
        email: "old-email@example.com",
        firstName: "Alicia",
        gender: "Female",
        lastName: "Ng",
        middleName: "Jane",
        phone: "0400 000 000",
        preferredName: "Ali",
        title: "Ms",
      },
      professionalAccreditations: [
        {
          document: {
            id: "accreditation-doc-1",
            lastModified: 3,
            name: "license.pdf",
            size: 3072,
            source: "local",
            type: "application/pdf",
            uploadedAt: "2026-01-12T10:00:00.000Z",
          },
          documentName: "license.pdf",
          id: "accreditation-1",
          name: "Registered Nurse",
          status: "Active",
        },
      ],
      secondaryQualifications: [
        {
          country: "Australia",
          id: "secondary-1",
          qualification: "VCE",
          school: "Example High",
          state: "VIC",
          type: "Year 12",
          year: "2010",
        },
      ],
      tertiaryQualifications: [
        {
          certificateDocument: {
            id: "certificate-doc-1",
            lastModified: 4,
            name: "certificate.pdf",
            size: 4096,
            source: "local",
            type: "application/pdf",
            uploadedAt: "2026-01-13T10:00:00.000Z",
          },
          certificateDocumentName: "certificate.pdf",
          completed: true,
          country: "Australia",
          courseName: "Bachelor of Business",
          endMonth: "December",
          endYear: "2018",
          id: "tertiary-1",
          institution: "Uni",
          level: "Bachelor",
          startMonth: "January",
          startYear: "2015",
          transcriptDocument: {
            id: "transcript-doc-1",
            lastModified: 5,
            name: "transcript.pdf",
            size: 5120,
            source: "local",
            type: "application/pdf",
            uploadedAt: "2026-01-14T10:00:00.000Z",
          },
          transcriptDocumentName: "transcript.pdf",
        },
      ],
    });

    const draft = createApplicationDraft(
      {
        code: "graduate-certificate-in-public-health",
        intake: "March 2026",
        provider: "Flinders University",
        title: "Graduate Certificate in Public Health",
      },
      "profile-1",
      {
        email: "alicia.ng@keypathedu.com.au",
        firstName: "Alicia",
        id: "profile-1",
        lastName: "Ng",
      },
      priorApplication,
    );

    expect(draft.personalDetails).toMatchObject({
      dateOfBirth: "1992-04-03",
      email: "alicia.ng@keypathedu.com.au",
      firstName: "Alicia",
      middleName: "Jane",
      phone: "0400 000 000",
      preferredName: "Ali",
      title: "Ms",
    });
    expect(draft.contactDetails).toMatchObject({
      citizenshipStatus: "Citizen",
      postalDifferent: true,
      residentialAddress: {
        formattedAddress: "1 Test St, Melbourne VIC 3000",
      },
    });
    expect(draft.employmentExperiences).toHaveLength(1);
    expect(draft.employmentExperiences[0]).toMatchObject({
      company: "Acme Health",
      currentRole: true,
      duties: "Managed program delivery",
      position: "Program Lead",
    });
    expect(draft.employmentExperiences[0].id).not.toBe("exp-1");
    expect(draft.cvUploaded).toBe(true);
    expect(draft.cvFileName).toBe("resume.pdf");
    expect(draft.cvDocument).toMatchObject({
      id: "cv-doc-1",
      name: "resume.pdf",
    });
    expect(draft.tertiaryQualifications).toHaveLength(1);
    expect(draft.tertiaryQualifications[0]).toMatchObject({
      certificateDocumentName: "certificate.pdf",
      courseName: "Bachelor of Business",
      transcriptDocumentName: "transcript.pdf",
    });
    expect(draft.tertiaryQualifications[0].id).not.toBe("tertiary-1");
    expect(draft.professionalAccreditations).toHaveLength(1);
    expect(draft.professionalAccreditations[0]).toMatchObject({
      documentName: "license.pdf",
      name: "Registered Nurse",
    });
    expect(draft.professionalAccreditations[0].id).not.toBe("accreditation-1");
    expect(draft.secondaryQualifications).toHaveLength(1);
    expect(draft.secondaryQualifications[0]).toMatchObject({
      qualification: "VCE",
      school: "Example High",
    });
    expect(draft.secondaryQualifications[0].id).not.toBe("secondary-1");
    expect(draft.languageTests).toHaveLength(1);
    expect(draft.languageTests[0]).toMatchObject({
      documentName: "ielts.pdf",
      name: "IELTS Academic",
    });
    expect(draft.languageTests[0].id).not.toBe("language-1");
    expect(draft.applicationMeta.prefilledFrom).toEqual({
      applicationId: priorApplication.applicationMeta.recordId,
      course: priorApplication.applicationMeta.selectedCourse,
    });
  });

  it("can clone section data without carrying document handles before duplication", () => {
    const priorApplication = mergeStoredApplicationData({
      applicationMeta: {
        recordId: "source-app-2",
        selectedCourse: {
          code: "mba-online",
          intake: "January 2026",
          provider: "Southern Cross University",
          title: "Master of Business Administration (MBA) online",
        },
      },
      cvDocument: {
        id: "cv-doc-2",
        lastModified: 10,
        name: "resume.pdf",
        size: 1024,
        source: "local",
        type: "application/pdf",
        uploadedAt: "2026-01-10T10:00:00.000Z",
      },
      cvFileName: "resume.pdf",
      cvUploaded: true,
      languageTests: [
        {
          document: {
            id: "lang-doc-2",
            lastModified: 11,
            name: "ielts.pdf",
            size: 1024,
            source: "local",
            type: "application/pdf",
            uploadedAt: "2026-01-10T10:00:00.000Z",
          },
          documentName: "ielts.pdf",
          id: "language-2",
          name: "IELTS Academic",
          type: "IELTS",
          year: "2024",
        },
      ],
      professionalAccreditations: [
        {
          document: {
            id: "accreditation-doc-2",
            lastModified: 12,
            name: "license.pdf",
            size: 1024,
            source: "local",
            type: "application/pdf",
            uploadedAt: "2026-01-10T10:00:00.000Z",
          },
          documentName: "license.pdf",
          id: "accreditation-2",
          name: "CPA Australia",
          status: "Active",
        },
      ],
      tertiaryQualifications: [
        {
          certificateDocument: {
            id: "certificate-doc-2",
            lastModified: 13,
            name: "certificate.pdf",
            size: 1024,
            source: "local",
            type: "application/pdf",
            uploadedAt: "2026-01-10T10:00:00.000Z",
          },
          certificateDocumentName: "certificate.pdf",
          completed: true,
          country: "Australia",
          courseName: "Bachelor of Business",
          endMonth: "December",
          endYear: "2018",
          id: "tertiary-2",
          institution: "Uni",
          level: "Bachelor",
          startMonth: "January",
          startYear: "2015",
          transcriptDocument: {
            id: "transcript-doc-2",
            lastModified: 14,
            name: "transcript.pdf",
            size: 1024,
            source: "local",
            type: "application/pdf",
            uploadedAt: "2026-01-10T10:00:00.000Z",
          },
          transcriptDocumentName: "transcript.pdf",
        },
      ],
    });

    const draft = createApplicationDraft(
      {
        code: "graduate-certificate-in-public-health",
        intake: "March 2026",
        provider: "Flinders University",
        title: "Graduate Certificate in Public Health",
      },
      "profile-1",
      {
        email: "alicia.ng@keypathedu.com.au",
        firstName: "Alicia",
        id: "profile-1",
        lastName: "Ng",
      },
      priorApplication,
      { includeSourceDocuments: false },
    );

    expect(draft.cvUploaded).toBe(true);
    expect(draft.cvFileName).toBe("resume.pdf");
    expect(draft.cvDocument).toBeUndefined();
    expect(draft.tertiaryQualifications[0]).toMatchObject({
      certificateDocument: undefined,
      certificateDocumentName: "certificate.pdf",
      transcriptDocument: undefined,
      transcriptDocumentName: "transcript.pdf",
    });
    expect(draft.professionalAccreditations[0]).toMatchObject({
      document: undefined,
      documentName: "license.pdf",
    });
    expect(draft.languageTests[0]).toMatchObject({
      document: undefined,
      documentName: "ielts.pdf",
    });
  });

  it("summarizes applications with a selected course", () => {
    const summary = summarizeApplication(
      mergeStoredApplicationData({
        applicationMeta: {
          recordId: "app-1",
          selectedCourse: {
            code: "bachelor-business",
            intake: "21 July 2025",
            provider: "University of Canberra",
            title: "Bachelor of Business online",
          },
        },
        contactDetails: {
          citizenshipStatus: "Citizen",
          residentialAddress: {
            country: "Australia",
            formattedAddress: "1 Test St, Melbourne VIC 3000",
            postcode: "3000",
            state: "VIC",
            streetAddress: "1 Test St",
            suburb: "Melbourne",
          },
        },
        personalDetails: {
          dateOfBirth: "1992-04-03",
          email: "jane@example.com",
          firstName: "Jane",
          gender: "Female",
          lastName: "Doe",
          middleName: "",
          phone: "0400 000 000",
          preferredName: "",
          title: "Ms",
        },
      }),
    );

    expect(summary).toMatchObject({
      completedStepCount: 6,
      completionPercentage: 86,
      course: {
        code: "bachelor-business",
        title: "Bachelor of Business online",
      },
      status: "draft",
      totalStepCount: 7,
    });
  });

  it("sorts reusable source applications by completion before recency", () => {
    const sortedApplications = sortApplicationsForPrefillChooser(
      [
        {
          completedStepCount: 5,
          completionPercentage: 71,
          course: {
            code: "mba-online",
            intake: "January 2026",
            provider: "Southern Cross University",
            title: "MBA",
          },
          id: "app-1",
          status: "draft",
          totalStepCount: 7,
          updatedAt: "2026-03-09T10:00:00.000Z",
        },
        {
          completedStepCount: 5,
          completionPercentage: 71,
          course: {
            code: "master-of-data-analytics-online",
            intake: "March 2026",
            provider: "The University of Sydney",
            title: "Master of Data Analytics (Online)",
          },
          id: "app-2",
          status: "draft",
          totalStepCount: 7,
          updatedAt: "2026-03-08T10:00:00.000Z",
        },
        {
          completedStepCount: 7,
          completionPercentage: 100,
          course: {
            code: "bachelor-business",
            intake: "July 2026",
            provider: "University of Canberra",
            title: "Bachelor of Business",
          },
          id: "app-3",
          status: "submitted",
          totalStepCount: 7,
          updatedAt: "2026-02-01T10:00:00.000Z",
        },
        {
          completedStepCount: 7,
          completionPercentage: 100,
          course: {
            code: "graduate-certificate-in-public-health",
            intake: "March 2026",
            provider: "Flinders University",
            title: "Graduate Certificate in Public Health",
          },
          id: "app-4",
          status: "draft",
          totalStepCount: 7,
          updatedAt: "2026-03-10T10:00:00.000Z",
        },
      ],
      "graduate-certificate-in-public-health",
      "app-2",
    );

    expect(sortedApplications.map((application) => application.id)).toEqual([
      "app-3",
      "app-2",
      "app-1",
    ]);
  });
});
