import { LifeBuoy, Send } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { ModalShell } from "../../components/ModalShell";
import { StatusMessage } from "../../components/StatusMessage";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useApplication } from "../../context/ApplicationContext";
import { useAuth } from "../../context/AuthContext";
import {
  getPostHogSupportState,
  hidePostHogSupportWidget,
  isPostHogEnabled,
  isPostHogSensitiveRoute,
  sendPostHogSupportTicket,
} from "../../lib/posthog";

type SubmissionState = "idle" | "submitting" | "sent" | "failed";

function useSupportState() {
  const location = useLocation();
  const [state, setState] = useState(() => ({
    available: false,
    widgetVisible: false,
  }));

  useEffect(() => {
    if (!isPostHogEnabled) {
      return;
    }

    if (isPostHogSensitiveRoute(location.pathname, location.search)) {
      hidePostHogSupportWidget();
      setState({ available: false, widgetVisible: false });
      return;
    }

    let attempts = 0;
    const refresh = () => {
      attempts += 1;
      const nextState = getPostHogSupportState();
      setState(nextState);

      if (nextState.available || attempts >= 20) {
        window.clearInterval(intervalId);
      }
    };

    const intervalId = window.setInterval(refresh, 500);
    refresh();

    return () => window.clearInterval(intervalId);
  }, [location.pathname, location.search]);

  return state;
}

export function PostHogSupportLauncher() {
  const location = useLocation();
  const { data } = useApplication();
  const { userDisplayName, userEmail } = useAuth();
  const supportState = useSupportState();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState(userEmail ?? "");
  const [submissionState, setSubmissionState] =
    useState<SubmissionState>("idle");

  useEffect(() => {
    setContactEmail(userEmail ?? "");
  }, [userEmail]);

  const canSubmit = useMemo(
    () => message.trim().length > 0 && submissionState !== "submitting",
    [message, submissionState],
  );

  if (
    !isPostHogEnabled ||
    isPostHogSensitiveRoute(location.pathname, location.search) ||
    !supportState.available ||
    supportState.widgetVisible
  ) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setSubmissionState("submitting");
    const result = await sendPostHogSupportTicket({
      application: data,
      currentUrl:
        typeof window !== "undefined" ? window.location.href : location.pathname,
      email: contactEmail || userEmail,
      message,
      name: userDisplayName,
    });

    if (result.ok) {
      setMessage("");
      setSubmissionState("sent");
      return;
    }

    setSubmissionState("failed");
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
        <Button
          type="button"
          variant="soft"
          className="h-12 rounded-full px-4 shadow-lg"
          onClick={() => {
            setSubmissionState("idle");
            setIsOpen(true);
          }}
        >
          <LifeBuoy className="h-5 w-5" aria-hidden="true" />
          <span>Report issue</span>
        </Button>
      </div>

      {isOpen ? (
        <ModalShell title="Report an issue" onClose={() => setIsOpen(false)}>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {submissionState === "sent" ? (
              <StatusMessage
                type="success"
                message="Ticket sent. Thanks for the report."
                onDismiss={() => setSubmissionState("idle")}
              />
            ) : null}
            {submissionState === "failed" ? (
              <StatusMessage
                type="error"
                message="We couldn't send that ticket. Try again in a moment."
                onDismiss={() => setSubmissionState("idle")}
              />
            ) : null}

            {!userEmail ? (
              <div>
                <Label htmlFor="support-email">Email</Label>
                <Input
                  id="support-email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>
            ) : null}

            <div>
              <Label htmlFor="support-message">What happened?</Label>
              <textarea
                id="support-message"
                className="min-h-36 w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--cta-secondary)] focus:ring-4 focus:ring-[var(--cta-secondary)]/10"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  if (submissionState !== "submitting") {
                    setSubmissionState("idle");
                  }
                }}
                placeholder="Describe the page, what you expected, and what went wrong."
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="neutralOutline"
                onClick={() => setIsOpen(false)}
              >
                Close
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                <Send className="h-4 w-4" aria-hidden="true" />
                {submissionState === "submitting" ? "Sending..." : "Send ticket"}
              </Button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </>
  );
}
