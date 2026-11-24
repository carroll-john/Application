import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { MessageCircle, Mic, MicOff, PhoneOff, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { StatusMessage } from "../../components/StatusMessage";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ADVISOR_VOICE_AUDIO_CONFIG, requestAdvisorChatSignedUrl } from "./advisorChatClient";

type ChatMessage = { id: string; role: "user" | "agent"; text: string };
type ChatMode = "text" | "voice";

let messageSequence = 0;
const nextMessageId = () => `advisor-msg-${(messageSequence += 1)}`;

const VOICE_ERROR =
  "We couldn't start the voice chat. Check your browser allowed the microphone, or use text chat.";
const TEXT_ERROR = "The advisor chat dropped. Start a new chat to keep going.";

function AdvisorChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("text");
  const modeRef = useRef<ChatMode>("text");
  const transcriptRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    stripAudioTags: true,
    onMessage: ({ message, role }) => {
      if (!message.trim()) return;
      // In text mode the panel already shows what the user typed. In voice mode
      // the user's words only arrive as transcripts, so show both sides.
      if (role === "user" && modeRef.current === "text") return;
      setMessages((current) => [
        ...current,
        { id: nextMessageId(), role: role === "user" ? "user" : "agent", text: message },
      ]);
    },
    onError: () => setError(modeRef.current === "voice" ? VOICE_ERROR : TEXT_ERROR),
  });

  const { status, startSession, endSession, sendUserMessage, isMuted, setMuted, isSpeaking } =
    conversation;
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isVoiceLive = isConnected && mode === "voice";

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => () => endSession(), [endSession]);

  async function start(nextMode: ChatMode) {
    setError(null);
    setMessages([]);
    setMode(nextMode);
    modeRef.current = nextMode;
    try {
      const signedUrl = await requestAdvisorChatSignedUrl();
      if (nextMode === "voice") {
        setMuted(false);
        startSession({ signedUrl, textOnly: false, ...ADVISOR_VOICE_AUDIO_CONFIG });
      } else {
        startSession({ signedUrl, textOnly: true });
      }
    } catch {
      setError("We couldn't reach an advisor right now. Try again in a moment.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !isConnected || mode === "voice") return;
    setMessages((current) => [...current, { id: nextMessageId(), role: "user", text }]);
    sendUserMessage(text);
    setDraft("");
  }

  const statusLine = isVoiceLive
    ? isMuted
      ? "Voice call · microphone muted"
      : isSpeaking
        ? "Voice call · advisor speaking"
        : "Voice call · listening"
    : isConnected
      ? "Online now"
      : isConnecting
        ? "Connecting..."
        : "Ask about courses and enrolment";

  return (
    <section
      aria-label="Chat with an enrolment advisor"
      className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(36rem,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-white shadow-xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-96"
    >
      <header className="flex items-center justify-between gap-3 bg-[var(--brand-header)] px-5 py-4 text-[var(--brand-header-text)]">
        <div>
          <p className="text-sm font-semibold">Enrolment advisor</p>
          <p className="text-xs opacity-80" aria-live="polite">
            {statusLine}
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
            <div className="flex flex-col items-center gap-2">
              <Button type="button" onClick={() => start("text")}>
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {messages.length > 0 ? "Start a new chat" : "Start chat"}
              </Button>
              <Button type="button" variant="outline" onClick={() => start("voice")}>
                <Mic className="h-4 w-4" aria-hidden="true" />
                Talk instead
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {isVoiceLive ? (
        <div className="flex gap-2 border-t border-[var(--border)] p-3">
          <Button
            type="button"
            variant="neutralOutline"
            className="flex-1"
            aria-pressed={isMuted}
            onClick={() => setMuted(!isMuted)}
          >
            {isMuted ? (
              <MicOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Mic className="h-4 w-4" aria-hidden="true" />
            )}
            {isMuted ? "Unmute" : "Mute"}
          </Button>
          <Button type="button" variant="soft" className="flex-1" onClick={() => endSession()}>
            <PhoneOff className="h-4 w-4" aria-hidden="true" />
            End call
          </Button>
        </div>
      ) : (
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
      )}
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
