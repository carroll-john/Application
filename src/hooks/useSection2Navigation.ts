import { useNavigate } from "react-router-dom";
import { SECTION2_QUALIFICATIONS_PATH } from "../lib/section2Steps";
import { useReviewReturn } from "./useReviewReturn";

export function createSection2NavigationPaths(
  returnPath: (defaultPath: string) => string,
) {
  const qualificationsPath = returnPath(SECTION2_QUALIFICATIONS_PATH);

  return {
    qualificationsPath,
    returnToQualificationsPath: qualificationsPath,
  };
}

export function useSection2Navigation() {
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();
  const { qualificationsPath, returnToQualificationsPath } =
    createSection2NavigationPaths(returnPath);

  return {
    returnToQualifications: () => navigate(returnToQualificationsPath),
    qualificationsPath,
  };
}
