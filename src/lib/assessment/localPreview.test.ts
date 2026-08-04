import { describe, expect, it } from "vitest";
import {
  isLocalUcAssessmentPreview,
  resolveAssessmentInvitationToken,
} from "./localPreview";
import { LOCAL_UC_ASSESSMENT_INVITATION_TOKEN } from "./localPreviewToken";

describe("local UC assessment preview", () => {
  const localUcOptions = {
    dev: true,
    hostname: "127.0.0.1",
    ucBrand: true,
  };

  it("uses an explicit invitation when one is supplied", () => {
    expect(
      resolveAssessmentInvitationToken(" hosted-invitation ", localUcOptions),
    ).toBe("hosted-invitation");
  });

  it("supplies a treatment fixture for the local UC development site", () => {
    expect(isLocalUcAssessmentPreview(localUcOptions)).toBe(true);
    expect(resolveAssessmentInvitationToken("", localUcOptions)).toBe(
      LOCAL_UC_ASSESSMENT_INVITATION_TOKEN,
    );
  });

  it.each([
    { dev: false, hostname: "127.0.0.1", ucBrand: true },
    { dev: true, hostname: "pilot.example.com", ucBrand: true },
    { dev: true, hostname: "localhost", ucBrand: false },
  ])("does not bypass hosted or non-UC invitation checks", (options) => {
    expect(isLocalUcAssessmentPreview(options)).toBe(false);
    expect(resolveAssessmentInvitationToken("", options)).toBe("");
  });
});
