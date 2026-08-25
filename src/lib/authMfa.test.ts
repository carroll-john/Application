import { describe, expect, it, vi } from "vitest";
import {
  confirmTotpEnrollment,
  disableTotp,
  getMfaSessionStatus,
  getTotpStatus,
  startTotpEnrollment,
  verifyTotpChallenge,
  type MfaClient,
} from "./authMfa";

function createMfaMock() {
  return {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
    getAuthenticatorAssuranceLevel: vi.fn(),
    unenroll: vi.fn(),
  };
}

function asClient(mock: ReturnType<typeof createMfaMock>): MfaClient {
  return mock as unknown as MfaClient;
}

describe("getTotpStatus", () => {
  it("reports enabled when a verified TOTP factor exists", async () => {
    const mfa = createMfaMock();
    mfa.listFactors.mockResolvedValue({
      data: {
        totp: [
          { id: "f1", status: "unverified" },
          { id: "f2", status: "verified" },
        ],
      },
      error: null,
    });

    await expect(getTotpStatus(asClient(mfa))).resolves.toEqual({
      status: { enabled: true, verifiedFactorId: "f2" },
      error: null,
    });
  });

  it("reports disabled when only unverified factors exist", async () => {
    const mfa = createMfaMock();
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "f1", status: "unverified" }] },
      error: null,
    });

    await expect(getTotpStatus(asClient(mfa))).resolves.toEqual({
      status: { enabled: false, verifiedFactorId: null },
      error: null,
    });
  });

  it("surfaces an error from listFactors", async () => {
    const mfa = createMfaMock();
    mfa.listFactors.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const result = await getTotpStatus(asClient(mfa));
    expect(result.status).toBeNull();
    expect(result.error).toBe("boom");
  });
});

describe("getMfaSessionStatus", () => {
  it("requires a challenge when an enrolled factor can raise AAL1 to AAL2", async () => {
    const mfa = createMfaMock();
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: ["password"],
      },
      error: null,
    });

    await expect(getMfaSessionStatus(asClient(mfa))).resolves.toEqual({
      status: { requiresChallenge: true },
      error: null,
    });
  });

  it.each([
    ["aal1", "aal1"],
    ["aal2", "aal2"],
    ["aal2", "aal1"],
  ])("accepts a current %s session with next level %s", async (currentLevel, nextLevel) => {
    const mfa = createMfaMock();
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: {
        currentLevel,
        nextLevel,
        currentAuthenticationMethods: [],
      },
      error: null,
    });

    await expect(getMfaSessionStatus(asClient(mfa))).resolves.toEqual({
      status: { requiresChallenge: false },
      error: null,
    });
  });

  it("fails closed when assurance cannot be determined", async () => {
    const mfa = createMfaMock();
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: null,
      error: { message: "assurance unavailable" },
    });

    await expect(getMfaSessionStatus(asClient(mfa))).resolves.toEqual({
      status: null,
      error: "assurance unavailable",
    });
  });
});

describe("verifyTotpChallenge", () => {
  it("rejects malformed codes before listing factors", async () => {
    const mfa = createMfaMock();

    await expect(
      verifyTotpChallenge(asClient(mfa), "12ab"),
    ).resolves.toEqual({
      error: "Enter the 6-digit code from your authenticator app.",
    });
    expect(mfa.listFactors).not.toHaveBeenCalled();
  });

  it("uses a verified TOTP factor and normalizes spacing", async () => {
    const mfa = createMfaMock();
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-2", status: "verified" }] },
      error: null,
    });
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });

    await expect(
      verifyTotpChallenge(asClient(mfa), "123 456"),
    ).resolves.toEqual({ error: null });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "factor-2",
      code: "123456",
    });
  });

  it("does not verify when no TOTP factor remains", async () => {
    const mfa = createMfaMock();
    mfa.listFactors.mockResolvedValue({
      data: { totp: [] },
      error: null,
    });

    const result = await verifyTotpChallenge(asClient(mfa), "123456");

    expect(result.error).toMatch(/no authenticator app/i);
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("maps an invalid challenge code to the existing friendly error", async () => {
    const mfa = createMfaMock();
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-2", status: "verified" }] },
      error: null,
    });
    mfa.challengeAndVerify.mockResolvedValue({
      data: null,
      error: { message: "Invalid TOTP code entered" },
    });

    await expect(
      verifyTotpChallenge(asClient(mfa), "000000"),
    ).resolves.toEqual({
      error:
        "That code didn't match. Check your authenticator app and try again.",
    });
  });
});

describe("startTotpEnrollment", () => {
  it("returns enrollment details on success", async () => {
    const mfa = createMfaMock();
    mfa.enroll.mockResolvedValue({
      data: {
        id: "factor-1",
        totp: { qr_code: "data:image/svg+xml,<svg/>", secret: "ABCDEF", uri: "otpauth://totp/x" },
      },
      error: null,
    });

    await expect(startTotpEnrollment(asClient(mfa))).resolves.toEqual({
      enrollment: {
        factorId: "factor-1",
        qrCode: "data:image/svg+xml,<svg/>",
        secret: "ABCDEF",
        uri: "otpauth://totp/x",
      },
      error: null,
    });
  });

  it("maps a project-disabled error to a friendly message", async () => {
    const mfa = createMfaMock();
    mfa.enroll.mockResolvedValue({
      data: null,
      error: { message: "MFA factor type totp is not enabled" },
    });

    const result = await startTotpEnrollment(asClient(mfa));
    expect(result.enrollment).toBeNull();
    expect(result.error).toMatch(/isn't switched on/i);
  });
});

describe("confirmTotpEnrollment", () => {
  it("rejects a non 6-digit code without calling Supabase", async () => {
    const mfa = createMfaMock();

    await expect(
      confirmTotpEnrollment(asClient(mfa), "factor-1", "12ab"),
    ).resolves.toEqual({
      error: "Enter the 6-digit code from your authenticator app.",
    });
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("normalizes spacing and verifies the code", async () => {
    const mfa = createMfaMock();
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });

    await expect(
      confirmTotpEnrollment(asClient(mfa), "factor-1", "123 456"),
    ).resolves.toEqual({ error: null });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "factor-1",
      code: "123456",
    });
  });

  it("maps an invalid-code error to a friendly message", async () => {
    const mfa = createMfaMock();
    mfa.challengeAndVerify.mockResolvedValue({
      data: null,
      error: { message: "Invalid TOTP code entered" },
    });

    await expect(
      confirmTotpEnrollment(asClient(mfa), "factor-1", "000000"),
    ).resolves.toEqual({
      error: "That code didn't match. Check your authenticator app and try again.",
    });
  });
});

describe("disableTotp", () => {
  it("unenrolls the verified factor", async () => {
    const mfa = createMfaMock();
    mfa.unenroll.mockResolvedValue({ data: { id: "f2" }, error: null });

    await expect(disableTotp(asClient(mfa), "f2")).resolves.toEqual({
      error: null,
    });
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f2" });
  });
});
