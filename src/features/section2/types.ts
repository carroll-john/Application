export type SectionStatus =
  | "locked"
  | "active"
  | "completed"
  | "skipped"
  | "needsAttention";

export interface SectionState {
  tertiary: SectionStatus;
  cv: SectionStatus;
  employment: SectionStatus;
  accreditation: SectionStatus;
  secondary: SectionStatus;
  languageTest: SectionStatus;
}

export const initialSectionState: SectionState = {
  tertiary: "active",
  cv: "locked",
  employment: "locked",
  accreditation: "locked",
  secondary: "locked",
  languageTest: "locked",
};

export const sectionStateOrder: Array<keyof SectionState> = [
  "tertiary",
  "cv",
  "employment",
  "accreditation",
  "secondary",
  "languageTest",
];
