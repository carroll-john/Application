import { useNavigate } from "react-router-dom";
import { useReviewReturn } from "./useReviewReturn";

const QUALIFICATIONS_PATH = "/section2/qualifications";

export function useSection2Navigation() {
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();

  return {
    returnToQualifications: () => navigate(returnPath(QUALIFICATIONS_PATH)),
    qualificationsPath: returnPath(QUALIFICATIONS_PATH),
  };
}
