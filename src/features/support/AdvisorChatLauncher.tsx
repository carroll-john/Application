import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { StatusMessage } from "../../components/StatusMessage";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { requestAdvisorChatSignedUrl } from "./advisorChatClient";

type ChatMessage = { id: string; role: "user" | "agent"; text: string };

let messageSequence = 0;
const nextMessageId = () => `advisor-msg-${(messageSequence += 1)}`;

function AdvisorChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    textOnly: true,
    stripAudioTags: true,
    onMessage: ({ message, role }) => {
      // The panel already shows what the user typed; only append agent replies.
      if (role === "user" || !message.trim()) return;
      setMessages((current) => [
        ...current,
        { id: nextMessageId(), role: "agent", text: message },
      ]);
    },
    onError: () => setError("The advisor chat dropped. Start a new chat to keep going."),
  });

  const { status, startSession, endSession, sendUserMessage } = conversation;
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => () => endSession(), [endSession]);

  async function startChat() {
    setError(null);
    setMessages([]);
    try {
      const signedUrl = await requestAdvisorChatSignedUrl();
      startSession({ signedUrl, textOnly: true });
    } catch {
      setError("We couldn't reach an advisor right now. Try again in a moment.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !isConnected) return;
    setMessages((current) => [...current, { id: nextMessageId(), role: "user", text }]);
    sendUserMessage(text);
    setDraft("");
  }

  return (
    <section
      aria-label="Chat with an enrolment advisor"
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(36rem,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-96"
    >
      <header className="flex items-center justify-between gap-3 bg-[var(--brand-header)] px-5 py-4 text-[var(--brand-header-text)]">
        <div>
          <p className="text-sm font-semibold">Enrolment advisor</p>
          <p className="text-xs opacity-80">
            {isConnected ? "Online now" : isConnecting ? "Connecting..." : "Ask about courses and enrolment"}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full p-2 transition hover:bg-white/10"
          aria-label="Close advisor chat"
          onClick={() => {
            endSession();
            onClose();
          }}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div
        ref={transcriptRef}
        className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto bg-[var(--background)] px-4 py-4"
        aria-live="polite"
      >
        {error ? (
          <StatusMessage type="error" message={error} onDismiss={() => setError(null)} />
        ) : null}
        {messages.map((message) => (
          <p
            key={message.id}
            className={
              message.role === "user"
                ? "ml-8 self-end rounded-2xl rounded-br-md bg-[var(--cta-secondary)] px-4 py-2 text-sm text-white"
                : "mr-8 self-start rounded-2xl rounded-bl-md border border-[var(--border)] bg-white px-4 py-2 text-sm text-slate-800"
            }
          >
            {message.text}
          </p>
        ))}
        {!isConnected && !isConnecting ? (
          <div className="m-auto text-center">
            <p className="mb-4 text-sm text-slate-600">
              Chat with our virtual advisor about courses, entry and next steps.
              Please don't share passwords or ID numbers.
            </p>
            <Button type="button" onClick={startChat}>
              {messages.length > 0 ? "Start a new chat" : "Start chat"}
            </Button>
          </div>
        ) : null}
      </div>

      <form className="flex gap-2 border-t border-[var(--border)] p-3" onSubmit={handleSubmit}>
        <Input
          aria-label="Message the advisor"
          placeholder={isConnected ? "Type your message" : "Start a chat to send messages"}
          value={draft}
          disabled={!isConnected}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type="submit"
          variant="soft"
          aria-label="Send message"
          disabled={!isConnected || !draft.trim()}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}

export function AdvisorChatLauncher() {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <ConversationProvider>
        <AdvisorChatPanel onClose={() => setIsOpen(false)} />
      </ConversationProvider>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 sm:bottom-6 sm:left-6">
      <Button
        type="button"
        variant="soft"
        className="h-12 rounded-full px-4 shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        <span>Chat with an advisor</span>
      </Button>
    </div>
  );
}
