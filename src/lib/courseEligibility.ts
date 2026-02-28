export type CourseEducationLevel =
  | "No formal education"
  | "High school"
  | "Diploma"
  | "Bachelor degree"
  | "Masters degree"
  | "Doctorate";

export type CourseExperienceLevel =
  | "Less than 2 years"
  | "2-5 years"
  | "5+ years";

export interface EligibilityCheckInput {
  education: string;
  experience: string;
}

const educationRank: Record<CourseEducationLevel, number> = {
  "No formal education": 0,
  "High school": 1,
  Diploma: 2,
  "Bachelor degree": 3,
  "Masters degree": 4,
  Doctorate: 5,
};

const experienceRank: Record<CourseExperienceLevel, number> = {
  "Less than 2 years": 0,
  "2-5 years": 1,
  "5+ years": 2,
};

export function isEligibleForMbaCourse({
  education,
  experience,
}: EligibilityCheckInput) {
  const normalizedEducation = education as CourseEducationLevel;
  const normalizedExperience = experience as CourseExperienceLevel;

  const hasBachelorOrHigher =
    educationRank[normalizedEducation] >= educationRank["Bachelor degree"];
  const hasTwoYearsOrMoreExperience =
    experienceRank[normalizedExperience] >= experienceRank["2-5 years"];

  return hasBachelorOrHigher || hasTwoYearsOrMoreExperience;
}
