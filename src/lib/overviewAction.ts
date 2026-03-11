import type { StepCompletionLabel } from "./applicationValidationSchema";

interface StepActionDetails {
  description: string;
  path: string;
  sectionLabel: string;
}

export interface OverviewActionDescriptor {
  description: string;
  label: string;
  path: string;
  primaryLabel: string;
  sectionLabel?: string;
  title: string;
}

const stepActionDetails: Record<StepCompletionLabel, StepActionDetails> = {
  "Basic information": {
    description:
      "Start Section 1 with your legal name so the rest of the application can build from the right profile details.",
    path: "/section1/basic-info",
    sectionLabel: "Section 1",
  },
  "Personal contact details": {
    description:
      "Add your date of birth, email, phone number, and other personal contact details before moving deeper into the form.",
    path: "/section1/personal-contact",
    sectionLabel: "Section 1",
  },
  "Citizenship information": {
    description:
      "Confirm your citizenship status so the application stays aligned with the course requirements.",
    path: "/section1/contact-info",
    sectionLabel: "Section 1",
  },
  "Address details": {
    description:
      "Add your residential address so your core personal details are complete before qualifications and documents.",
    path: "/section1/address",
    sectionLabel: "Section 1",
  },
  "CV upload": {
    description:
      "Upload your CV if you are applying through work experience so the qualifications review has the right supporting evidence.",
    path: "/section2/add-cv",
    sectionLabel: "Section 2",
  },
  "Employment experience": {
    description:
      "Add your work history so your experience pathway is clear before you move to final review.",
    path: "/section2/add-employment",
    sectionLabel: "Section 2",
  },
  "Tertiary qualifications": {
    description:
      "Add your study history and supporting documents so your qualifications are ready for assessment.",
    path: "/section2/qualifications",
    sectionLabel: "Section 2",
  },
};

export function getOverviewActionDescriptor(
  nextSection: StepCompletionLabel | null,
  submitted: boolean,
): OverviewActionDescriptor {
  if (submitted) {
    return {
      description:
        "Open the submitted application to review the final details, status, and application number.",
      label: "Application status",
      path: "/submitted",
      primaryLabel: "View submitted application",
      title: "Submitted application",
    };
  }

  if (!nextSection) {
    return {
      description:
        "Your core application steps are in place. Review the details, check any submission-only requirements, and submit when ready.",
      label: "Next step",
      path: "/review",
      primaryLabel: "Go to review & submit",
      sectionLabel: "Section 3",
      title: "Review and submit",
    };
  }

  const details = stepActionDetails[nextSection];

  return {
    description: details.description,
    label: "Next step",
    path: details.path,
    primaryLabel:
      nextSection === "Basic information"
        ? "Start application"
        : "Continue to next step",
    sectionLabel: details.sectionLabel,
    title: nextSection,
  };
}
