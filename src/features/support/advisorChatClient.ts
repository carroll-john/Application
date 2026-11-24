// Asks the app API for a short-lived ElevenLabs signed URL. The API key stays
// server-side in /api/advisor-chat-session.
export async function requestAdvisorChatSignedUrl(
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl("/api/advisor-chat-session", { method: "POST" });
  if (!response.ok) {
    throw new Error(`Advisor chat session request failed (${response.status}).`);
  }

  const payload = (await response.json()) as { signedUrl?: unknown };
  if (typeof payload.signedUrl !== "string" || !payload.signedUrl.startsWith("wss://")) {
    throw new Error("Advisor chat session response was missing a signed URL.");
  }

  return payload.signedUrl;
}

// Voice AudioWorklets are served from this origin by
// scripts/viteElevenLabsAudioPlugin.ts so the CSP needs no blob:, data: or CDN
// script sources.
const AUDIO_BASE = "/elevenlabs-audio";

export const ADVISOR_VOICE_AUDIO_CONFIG = {
  workletPaths: {
    rawAudioProcessor: `${AUDIO_BASE}/rawAudioProcessor.js`,
    audioConcatProcessor: `${AUDIO_BASE}/audioConcatProcessor.js`,
  },
  libsampleratePath: `${AUDIO_BASE}/libsamplerate.worklet.js`,
} as const;
