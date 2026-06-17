import { describe, expect, it, vi } from "vitest";
import {
  confirmTotpEnrollment,
  disableTotp,
  getTotpStatus,
  startTotpEnrollment,
  type MfaClient,
} from "./authMfa";

function createMfaMock() {
  return {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
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
