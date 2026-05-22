export const educationLevels = [
  "Did not complete high school",
  "High school certificate",
  "Certificate I to IV (including trade certificate)",
  "Diploma or Associate Degree",
  "Bachelor degree",
  "Postgraduate degree",
  "Unknown",
] as const;

export const parentFields = [
  "parent1Details",
  "parent2Details",
  "parent3Details",
  "parent4Details",
  "parent5Details",
] as const;

export type ParentField = (typeof parentFields)[number];

export interface FamilySupportFormData {
  parentsCount: string;
  parent1Details: string;
  parent2Details: string;
  parent3Details: string;
  parent4Details: string;
  parent5Details: string;
  hasDisability: boolean | null;
  disabilityDetails: string;
}
