import type { ApplicationData } from "./applicationData";
import { getSection2SubmissionMissingFields } from "./section2Requirements";

export interface ValidationError {
  section: string;
  subsection: string;
  field: string;
  path: string;
}

export function validateApplication(data: ApplicationData) {
  const errors: ValidationError[] = [];

  if (!data.personalDetails.title) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Basic information",
      field: "Title",
      path: "/section1/basic-info?from=review",
    });
  }
  if (!data.personalDetails.firstName.trim()) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Basic information",
      field: "First name",
      path: "/section1/basic-info?from=review",
    });
  }
  if (!data.personalDetails.lastName.trim()) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Basic information",
      field: "Last name",
      path: "/section1/basic-info?from=review",
    });
  }
  if (!data.personalDetails.gender) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Personal contact details",
      field: "Gender",
      path: "/section1/personal-contact?from=review",
    });
  }
  if (!data.personalDetails.dateOfBirth) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Personal contact details",
      field: "Date of birth",
      path: "/section1/personal-contact?from=review",
    });
  }
  if (!data.personalDetails.email.trim()) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Personal contact details",
      field: "Email address",
      path: "/section1/personal-contact?from=review",
    });
  } else if (!/^\S+@\S+\.\S+$/.test(data.personalDetails.email)) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Personal contact details",
      field: "Valid email",
      path: "/section1/personal-contact?from=review",
    });
  }
  if (!data.personalDetails.phone.trim()) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Personal contact details",
      field: "Phone number",
      path: "/section1/personal-contact?from=review",
    });
  }
  if (!data.contactDetails.citizenshipStatus) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Citizenship information",
      field: "Citizenship status",
      path: "/section1/contact-info?from=review",
    });
  }
  if (!data.contactDetails.residentialAddress.formattedAddress.trim()) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Address details",
      field: "Permanent residential address",
      path: "/section1/address?from=review",
    });
  }
  if (!data.contactDetails.language) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Cultural & education background",
      field: "Language spoken",
      path: "/section1/cultural-background?from=review",
    });
  }
  if (!data.contactDetails.aboriginal) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Cultural & education background",
      field: "Aboriginal status",
      path: "/section1/cultural-background?from=review",
    });
  }
  if (!data.contactDetails.schoolLevel) {
    errors.push({
      section: "Section 1: Personal information",
      subsection: "Cultural & education background",
      field: "School level",
      path: "/section1/cultural-background?from=review",
    });
  }

  const parentCount = Number(data.contactDetails.parentsCount || 0);
  [
    data.contactDetails.parent1Details,
    data.contactDetails.parent2Details,
    data.contactDetails.parent3Details,
    data.contactDetails.parent4Details,
    data.contactDetails.parent5Details,
  ]
    .slice(0, parentCount)
    .forEach((value, index) => {
      if (!value?.trim()) {
        errors.push({
          section: "Section 1: Personal information",
          subsection: "Family & support information",
          field: `Parent/Guardian ${index + 1} Education Level`,
          path: "/section1/family-support?from=review",
        });
      }
    });

  getSection2SubmissionMissingFields({
    cvUploaded: data.cvUploaded,
    employmentExperiencesCount: data.employmentExperiences.length,
    tertiaryQualificationsCount: data.tertiaryQualifications.length,
  }).forEach((field) => {
    errors.push({
      section: "Section 2: Qualifications",
      subsection: "Submission requirements",
      field,
      path: "/section2/qualifications?from=review",
    });
  });

  data.tertiaryQualifications.forEach((qualification, index) => {
    const qualificationPath = `/section2/edit-tertiary/${qualification.id}?from=review`;

    if (!qualification.institution.trim()) {
      errors.push({
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: Institution Name`,
        path: qualificationPath,
      });
    }
    if (!qualification.country) {
      errors.push({
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: Country`,
        path: qualificationPath,
      });
    }
    if (!qualification.level) {
      errors.push({
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: Qualification Level`,
        path: qualificationPath,
      });
    }
    if (!qualification.courseName.trim()) {
      errors.push({
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: Course Name`,
        path: qualificationPath,
      });
    }
    if (!qualification.startMonth || !qualification.startYear) {
      errors.push({
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: Start date`,
        path: qualificationPath,
      });
    }
    if (!qualification.endMonth || !qualification.endYear) {
      errors.push({
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: End date`,
        path: qualificationPath,
      });
    }
    if (
      qualification.courseName.trim() &&
      !qualification.transcriptDocumentName &&
      !qualification.transcriptDocument
    ) {
      errors.push({
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: Academic Transcript`,
        path: qualificationPath,
      });
    }
    if (
      qualification.completed &&
      !qualification.certificateDocumentName &&
      !qualification.certificateDocument
    ) {
      errors.push({
        section: "Section 2: Qualifications",
        subsection: "Tertiary qualifications",
        field: `Qualification ${index + 1}: Certificate of Completion`,
        path: qualificationPath,
      });
    }
  });

  return errors;
}
