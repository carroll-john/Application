export interface PersistApplicationOptions {
  applicantProfileId?: string | null;
  forceCreate?: boolean;
  keepActive?: boolean;
  shellOnly?: boolean;
}

export interface BeginCourseApplicationOptions {
  authenticatedEmail?: string | null;
  assessmentSessionId?: string;
  prefillFromApplicationId?: string | null;
  startFresh?: boolean;
}
