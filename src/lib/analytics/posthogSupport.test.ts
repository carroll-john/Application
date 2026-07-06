import { beforeEach, describe, expect, it, vi } from "vitest";

const conversations = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  isVisible: vi.fn(),
  sendMessage: vi.fn(),
}));

const canCapturePostHog = vi.hoisted(() => vi.fn());
const initPostHog = vi.hoisted(() => vi.fn());

vi.mock("posthog-js", () => ({
  default: {
    conversations,
  },
}));

vi.mock("./posthogClient", () => ({
  canCapturePostHog,
  initPostHog,
}));

import {
  getPostHogSupportState,
  sendPostHogSupportTicket,
} from "./posthogSupport";

beforeEach(() => {
  canCapturePostHog.mockReturnValue(true);
  conversations.isAvailable.mockReturnValue(true);
  conversations.isVisible.mockReturnValue(false);
  conversations.sendMessage.mockResolvedValue({
    message_id: "message-1",
    ticket_id: "ticket-1",
  });
  initPostHog.mockClear();
  conversations.isAvailable.mockClear();
  conversations.isVisible.mockClear();
  conversations.sendMessage.mockClear();
});

describe("posthog support", () => {
  it("reports support availability from the conversations API", () => {
    conversations.isVisible.mockReturnValue(true);

    expect(getPostHogSupportState()).toEqual({
      available: true,
      widgetVisible: true,
    });
    expect(initPostHog).toHaveBeenCalled();
  });

  it("returns unavailable when conversations are not enabled", () => {
    conversations.isAvailable.mockReturnValue(false);

    expect(getPostHogSupportState()).toEqual({
      available: false,
      widgetVisible: false,
    });
  });

  it("sends a new support ticket with sanitized page context", async () => {
    await expect(
      sendPostHogSupportTicket({
        currentUrl:
          "https://application-prototype.vercel.app/sign-in?access_token=secret#refresh_token=hidden",
        email: "user@example.com",
        message: "The continue button did nothing.",
        name: "Test User",
      }),
    ).resolves.toEqual({ ok: true, ticketId: "ticket-1" });

    expect(conversations.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining("Page: https://application-prototype.vercel.app/sign-in"),
      { email: "user@example.com", name: "Test User" },
      true,
    );
    expect(conversations.sendMessage.mock.calls[0][0]).not.toContain("secret");
    expect(conversations.sendMessage.mock.calls[0][0]).not.toContain("hidden");
  });

  it("does not send empty tickets", async () => {
    await expect(
      sendPostHogSupportTicket({ message: "   " }),
    ).resolves.toEqual({ ok: false, reason: "empty" });
    expect(conversations.sendMessage).not.toHaveBeenCalled();
  });

});
