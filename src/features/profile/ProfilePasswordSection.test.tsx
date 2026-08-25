import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProfilePasswordSection } from "./ProfilePasswordSection";

describe("ProfilePasswordSection", () => {
  it("collects the current password separately from the new password pair", () => {
    const markup = renderToStaticMarkup(
      <ProfilePasswordSection
        onChangePassword={vi.fn().mockResolvedValue({ error: null })}
      />,
    );

    expect(markup).toContain("Current password");
    expect(markup).toContain('autoComplete="current-password"');
    expect(markup).toContain("New password");
    expect(markup).toContain("Confirm new password");
    expect(markup).toContain('autoComplete="new-password"');
    expect(markup).toContain("Update password");
  });
});
