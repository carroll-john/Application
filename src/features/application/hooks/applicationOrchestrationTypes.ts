export interface PersistApplicationOptions {
  applicantProfileId?: string | null;
  forceCreate?: boolean;
  keepActive?: boolean;
  shellOnly?: boolean;
}

export interface BeginCourseApplicationOptions {
  prefillFromApplicationId?: string | null;
  startFresh?: boolean;
}
