import { UC_ASSESSMENT_PARTNER_ID } from "../../src/lib/assessment/ucGovernance.js";
import {
  createAssessmentAdminClient,
  getAssessmentUser,
  requireStaffRole,
} from "./server.js";

export async function getAssessmentStaffContext(request: Request) {
  const { user } = await getAssessmentUser(request, { requireAal2: true });
  const admin = createAssessmentAdminClient();
  const role = await requireStaffRole({
    admin,
    partnerId: UC_ASSESSMENT_PARTNER_ID,
    user,
  });
  return { admin, partnerId: UC_ASSESSMENT_PARTNER_ID, role, user };
}
