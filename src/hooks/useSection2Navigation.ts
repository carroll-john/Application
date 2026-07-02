import { useNavigate } from "react-router-dom";
import { SECTION2_QUALIFICATIONS_PATH } from "../lib/section2Steps";
import { useReviewReturn } from "./useReviewReturn";

export function createSection2NavigationPaths(
  returnPath: (defaultPath: string) => string,
) {
  const qualificationsPath = returnPath(SECTION2_QUALIFICATIONS_PATH);

  return {
    qualificationsHubPath: SECTION2_QUALIFICATIONS_PATH,
    qualificationsPath,
    returnToQualificationsPath: qualificationsPath,
  };
}

export function useSection2Navigation() {
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();
  const { qualificationsHubPath, qualificationsPath, returnToQualificationsPath } =
    createSection2NavigationPaths(returnPath);

  return {
    qualificationsHubPath,
    returnToQualifications: () => navigate(returnToQualificationsPath),
    qualificationsPath,
  };
}
