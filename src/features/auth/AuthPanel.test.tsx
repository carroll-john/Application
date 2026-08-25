import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPanel } from "./AuthPanel";

const authState = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => authState.current,
}));

function renderPanel() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/sign-in?redirect=%2Freview"]}>
      <AuthPanel />
    </MemoryRouter>,
  );
}

describe("AuthPanel MFA routing", () => {
  beforeEach(() => {
    authState.current = {
      isAuthenticated: false,
      isConfigured: true,
      isPasswordRecovery: false,
      mfaError: null,
      requiresMfa: false,
      requestPasswordReset: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUpWithPassword: vi.fn(),
      updatePasswordAfterRecovery: vi.fn(),
      verifyMfa: vi.fn(),
    };
  });

  it("shows the authenticator challenge when the enrolled session needs AAL2", () => {
    authState.current.requiresMfa = true;

    const markup = renderPanel();

    expect(markup).toContain("Enter your authenticator code");
    expect(markup).toContain("auth-totp-code");
    expect(markup).toContain("Verify and continue");
    expect(markup).not.toContain("Forgot password?");
  });

  it("keeps the password form for applicants without an enrolled factor", () => {
    const markup = renderPanel();

    expect(markup).toContain("Sign in with your applicant account email and password.");
    expect(markup).toContain("Forgot password?");
    expect(markup).not.toContain("auth-totp-code");
  });

  it("keeps password recovery ahead of an outstanding MFA challenge", () => {
    authState.current.isPasswordRecovery = true;
    authState.current.requiresMfa = true;

    const markup = renderPanel();

    expect(markup).toContain("Choose a new password");
    expect(markup).not.toContain("auth-totp-code");
  });
});
