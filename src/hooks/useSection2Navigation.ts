import { useNavigate } from "react-router-dom";
import { SECTION2_QUALIFICATIONS_PATH } from "../lib/section2Steps";
import { useReviewReturn } from "./useReviewReturn";

export function useSection2Navigation() {
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();

  return {
    returnToQualifications: () => navigate(returnPath(SECTION2_QUALIFICATIONS_PATH)),
    qualificationsPath: returnPath(SECTION2_QUALIFICATIONS_PATH),
  };
}
