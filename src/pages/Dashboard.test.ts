import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredApplicantProfile } from "../lib/applicantProfileStore";

const testState = vi.hoisted(() => ({
  applicantProfile: null as StoredApplicantProfile | null,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    signOut: vi.fn(),
    userDisplayName: "Carroll John+plus",
  }),
}));

vi.mock("../context/ApplicationContext", () => ({
  useApplication: () => ({
    activeApplicationId: null,
    applicantProfile: testState.applicantProfile,
    applications: [],
    openApplication: vi.fn(),
  }),
}));

import Dashboard from "./Dashboard";

function renderDashboard() {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard"] },
      createElement(Dashboard),
    ),
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    testState.applicantProfile = null;
  });

  it("uses the applicant profile first and last names in the greeting", () => {
    testState.applicantProfile = {
      email: "carroll_john+plus@example.com",
      firstName: "  John ",
      lastName: " Carroll  ",
    };

    const html = renderDashboard();

    expect(html).toContain("Welcome back, John Carroll");
    expect(html).not.toContain("Carroll John+plus");
  });

  it("does not fall back to an email-derived name", () => {
    const html = renderDashboard();

    expect(html).toContain("Welcome back, Applicant");
    expect(html).not.toContain("Carroll John+plus");
  });
});
