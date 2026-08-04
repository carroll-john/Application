import { isUcBrand } from "../brand";
import { LOCAL_UC_ASSESSMENT_INVITATION_TOKEN } from "./localPreviewToken";

interface LocalUcAssessmentPreviewOptions {
  dev?: boolean;
  hostname?: string;
  ucBrand?: boolean;
}

export function isLocalUcAssessmentPreview(
  options: LocalUcAssessmentPreviewOptions = {},
) {
  const dev = options.dev ?? import.meta.env.DEV;
  const hostname =
    options.hostname ??
    (typeof window === "undefined" ? "" : window.location.hostname);
  const ucBrand = options.ucBrand ?? isUcBrand;

  return (
    dev && ucBrand && (hostname === "127.0.0.1" || hostname === "localhost")
  );
}

export function resolveAssessmentInvitationToken(
  queryToken: string,
  options: LocalUcAssessmentPreviewOptions = {},
) {
  const invitationToken = queryToken.trim();
  if (invitationToken) return invitationToken;

  return isLocalUcAssessmentPreview(options)
    ? LOCAL_UC_ASSESSMENT_INVITATION_TOKEN
    : "";
}
