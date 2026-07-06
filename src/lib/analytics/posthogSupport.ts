import posthog from "posthog-js";
import type { ApplicationData } from "../applicationData";
import { sanitizeAnalyticsUrl } from "./sanitizeAnalyticsUrl";
import { canCapturePostHog, initPostHog } from "./posthogClient";

type SupportTicketContext = {
  application?: ApplicationData | null;
  currentUrl?: string;
  email?: string | null;
  message: string;
  name?: string | null;
};

type SupportState = {
  available: boolean;
  widgetVisible: boolean;
};

export type SendPostHogSupportTicketResult =
  | {
      ok: true;
      ticketId: string | null;
    }
  | {
      ok: false;
      reason: "disabled" | "empty" | "failed" | "unavailable";
    };

function getConversationApi() {
  if (!canCapturePostHog()) {
    return null;
  }

  initPostHog();
  return posthog.conversations ?? null;
}

export function getPostHogSupportState(): SupportState {
  const conversations = getConversationApi();

  if (!conversations?.isAvailable()) {
    return { available: false, widgetVisible: false };
  }

  return {
    available: true,
    widgetVisible: conversations.isVisible(),
  };
}

export function hidePostHogSupportWidget() {
  const conversations = getConversationApi();

  if (conversations?.isAvailable()) {
    conversations.hide();
  }
}

function buildSupportMessage({
  application,
  currentUrl,
  message,
}: SupportTicketContext) {
  const selectedCourse = application?.applicationMeta.selectedCourse;
  const lines = [
    "Prototype bug report",
    currentUrl ? `Page: ${sanitizeAnalyticsUrl(currentUrl)}` : null,
    selectedCourse?.title ? `Course: ${selectedCourse.title}` : null,
    selectedCourse?.provider ? `Provider: ${selectedCourse.provider}` : null,
    application?.applicationMeta.recordId
      ? `Application ID: ${application.applicationMeta.recordId}`
      : null,
    application?.applicationMeta.applicationNumber
      ? `Application number: ${application.applicationMeta.applicationNumber}`
      : null,
    application?.applicationMeta.status
      ? `Application status: ${application.applicationMeta.status}`
      : null,
    "",
    message.trim(),
  ];

  return lines.filter((line) => line !== null).join("\n");
}

export async function sendPostHogSupportTicket(
  context: SupportTicketContext,
): Promise<SendPostHogSupportTicketResult> {
  const trimmedMessage = context.message.trim();

  if (!trimmedMessage) {
    return { ok: false, reason: "empty" };
  }

  const conversations = getConversationApi();

  if (!conversations) {
    return { ok: false, reason: "disabled" };
  }

  if (!conversations.isAvailable()) {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const response = await conversations.sendMessage(
      buildSupportMessage({ ...context, message: trimmedMessage }),
      {
        email: context.email ?? undefined,
        name: context.name ?? undefined,
      },
      true,
    );

    if (!response) {
      return { ok: false, reason: "unavailable" };
    }

    return {
      ok: true,
      ticketId: response.ticket_id ?? null,
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
