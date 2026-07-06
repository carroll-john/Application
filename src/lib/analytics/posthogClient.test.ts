import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  group: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  opt_out_capturing: vi.fn(),
  register: vi.fn(),
  reset: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: posthogMock,
}));

async function importPostHogClient() {
  return import("./posthogClient");
}

describe("syncPostHogUser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_project_key");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("identifies logged-in users with a hashed distinct id and non-sensitive traits", async () => {
    const { POSTHOG_IDENTITY_VERSION, syncPostHogUser } =
      await importPostHogClient();

    syncPostHogUser({
      email: "applicant@example.com",
      id: "supabase-user-123",
    });

    await vi.waitFor(() => {
      expect(posthogMock.identify).toHaveBeenCalledTimes(1);
    });

    const [distinctId, personProperties] = posthogMock.identify.mock.calls[0];
    const serializedProperties = JSON.stringify(personProperties);

    expect(distinctId).toMatch(/^(sha256|fnv1a):/);
    expect(distinctId).not.toContain("supabase-user-123");
    expect(serializedProperties).not.toContain("applicant@example.com");
    expect(personProperties).toEqual({
      analytics_user_id_hash: distinctId,
      app_environment: "test",
      email_domain: "example.com",
      is_authenticated: true,
      posthog_identity_version: POSTHOG_IDENTITY_VERSION,
      user_type: "applicant",
    });
  });

  it("ignores stale identify work when the active user changes", async () => {
    const { syncPostHogUser } = await importPostHogClient();

    syncPostHogUser({
      email: "first@example.com",
      id: "first-user",
    });
    syncPostHogUser({
      email: "second@example.net",
      id: "second-user",
    });

    await vi.waitFor(() => {
      expect(posthogMock.identify).toHaveBeenCalledTimes(1);
    });

    const [distinctId, personProperties] = posthogMock.identify.mock.calls[0];

    expect(distinctId).toMatch(/^(sha256|fnv1a):/);
    expect(distinctId).not.toContain("second-user");
    expect(personProperties.email_domain).toBe("example.net");
  });

  it("resets PostHog identity on logout and restores base super properties", async () => {
    const { syncPostHogUser } = await importPostHogClient();

    syncPostHogUser(null);

    expect(posthogMock.reset).toHaveBeenCalledTimes(1);
    expect(posthogMock.register).toHaveBeenLastCalledWith({
      app_environment: "test",
    });
  });
});

describe("initPostHog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_project_key");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("limits autocapture to public click interactions", async () => {
    const { initPostHog } = await importPostHogClient();

    initPostHog();

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    const [, config] = posthogMock.init.mock.calls[0];
    expect(config).toMatchObject({
      autocapture: {
        dom_event_allowlist: ["click"],
        element_allowlist: ["a", "button"],
        capture_copied_text: false,
      },
      capture_dead_clicks: false,
      capture_pageview: false,
      rageclick: false,
    });
    expect(config.autocapture.url_allowlist).toHaveLength(2);
  });
});
