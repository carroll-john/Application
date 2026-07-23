export type UcRplAssessmentStage = "intro" | "parsing" | "review" | "results";

export function shouldShowUcCourseCatalogue(stage: UcRplAssessmentStage) {
  return stage === "intro";
}
