import { useCallback, useEffect, useState } from "react";
import { Download, LoaderCircle, ShieldCheck } from "lucide-react";
import { AppBrandFooter } from "../components/AppBrandFooter";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { StatusPill } from "../components/StatusPill";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";
import { ProfileMfaSection } from "../features/profile/ProfileMfaSection";
import { supabase } from "../lib/supabase";

interface ReviewListItem {
  assigned_to: string | null;
  assessment_session_id: string;
  created_at: string;
  id: string;
  results: Array<{
    confidence: "high" | "medium" | "low";
    course_code: string;
    potential_credit_points: number | null;
    published_cap: number | null;
  }>;
  session: { application_id: string | null } | null;
  status: "unassigned" | "in_review" | "agreed" | "corrected" | "exported";
}

interface ReviewDetail {
  documents: Array<{ file_name: string; id: string; kind: string; scan_status: string }>;
  results: ReviewListItem["results"];
  review: ReviewListItem & { private_notes?: string | null };
  session: { application_id: string | null };
}

async function staffFetch(path: string, init?: RequestInit) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to continue.");
  return fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${token}`,
    },
  });
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;
  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : "The staff review request failed.",
    );
  }
  return payload as T;
}

export default function StaffReviews() {
  const { session } = useAuth();
  const [aal, setAal] = useState<"aal1" | "aal2" | null>(null);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [selected, setSelected] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [correctionCategory, setCorrectionCategory] = useState("credit_band");
  const [correctedPoints, setCorrectedPoints] = useState("");

  const refreshAssurance = useCallback(async () => {
    if (!supabase) return;
    const [assurance, factors] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const currentLevel = assurance.data?.currentLevel;
    if (currentLevel === "aal1") {
      setAal("aal1");
    } else if (currentLevel === "aal2") {
      setAal("aal2");
    } else {
      setAal(null);
    }
    setVerifiedFactorId(
      factors.data?.totp.find((factor) => factor.status === "verified")?.id ?? null,
    );
  }, []);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson<{ reviews: ReviewListItem[] }>(
        await staffFetch("/api/staff/reviews"),
      );
      setReviews(payload.reviews);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The queue could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAssurance();
  }, [refreshAssurance, session?.access_token]);

  useEffect(() => {
    if (aal === "aal2") void loadReviews();
  }, [aal, loadReviews]);

  async function verifyMfa() {
    if (!supabase || !verifiedFactorId || !/^\d{6}$/.test(code.trim())) {
      setMfaError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setMfaError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      code: code.trim(),
      factorId: verifiedFactorId,
    });
    if (verifyError) {
      setMfaError("That code did not match. Try again.");
      return;
    }
    setCode("");
    await refreshAssurance();
  }

  async function openReview(id: string) {
    setError(null);
    try {
      const detail = await readJson<ReviewDetail>(
        await staffFetch(`/api/staff/review?id=${encodeURIComponent(id)}`),
      );
      setSelected(detail);
      setNotes(detail.review.private_notes ?? "");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "The case could not load.");
    }
  }

  async function updateReview(action: "claim" | "agree" | "correct") {
    if (!selected) return;
    setError(null);
    try {
      await readJson(
        await staffFetch("/api/staff/review", {
          body: JSON.stringify({
            action,
            correctedCreditPoints:
              action === "correct" && correctedPoints.trim()
                ? Number(correctedPoints)
                : null,
            correctionCategory: action === "correct" ? correctionCategory : undefined,
            privateNotes: notes,
            reviewId: selected.review.id,
          }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }),
      );
      await Promise.all([loadReviews(), openReview(selected.review.id)]);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "The review could not be updated.",
      );
    }
  }

  async function exportReview() {
    if (!selected) return;
    setError(null);
    try {
      const response = await staffFetch(
        `/api/staff/export?id=${encodeURIComponent(selected.review.id)}`,
        { method: "POST" },
      );
      if (!response.ok) {
        await readJson(response);
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `uc-assessment-${selected.review.id}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      await Promise.all([loadReviews(), openReview(selected.review.id)]);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "The review export could not be generated.",
      );
    }
  }

  if (!supabase) {
    return (
      <main className="p-8" data-sensitive>
        <h1 className="text-2xl font-semibold text-slate-950">UC assessment reviews</h1>
        <p className="mt-3 text-slate-700">Staff authentication is not configured.</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-sensitive>
      <AppBrandHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-950">UC assessment reviews</h1>
          <p className="mt-3 text-slate-600">
            Indicative guidance only. Reviewers cannot edit evidence or issue admission
            or formal credit decisions.
          </p>
        </div>

        {!verifiedFactorId ? (
          <div className="content-block border border-amber-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              Authenticator setup required
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Staff review access requires a verified authenticator factor.
            </p>
            <ProfileMfaSection mfa={supabase.auth.mfa} />
          </div>
        ) : null}

        {verifiedFactorId && aal !== "aal2" ? (
          <section className="content-block max-w-xl border border-slate-200 bg-white p-7">
            <ShieldCheck className="h-8 w-8 text-[var(--cta-secondary)]" />
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">
              Verify staff access
            </h2>
            <Label className="mt-5 block" htmlFor="staff-totp">Authenticator code</Label>
            <Input
              id="staff-totp"
              className="mt-2"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
            {mfaError ? <p className="mt-2 text-sm text-red-700">{mfaError}</p> : null}
            <Button className="mt-5" onClick={() => void verifyMfa()}>
              Verify and open queue
            </Button>
          </section>
        ) : null}

        {aal === "aal2" ? (
          <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <aside className="content-block border border-slate-200 bg-white p-4">
              <h2 className="px-2 text-lg font-semibold text-slate-950">Queue</h2>
              {loading ? (
                <p className="mt-4 flex items-center gap-2 px-2 text-sm text-slate-600">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Loading reviews…
                </p>
              ) : null}
              <ul className="mt-3 space-y-2">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50"
                      onClick={() => void openReview(review.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {review.results[0]?.course_code ?? "Assessment"}
                        </span>
                        <StatusPill tone="neutral">{review.status}</StatusPill>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {review.session?.application_id ? "Application started" : "No application yet"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="content-block border border-slate-200 bg-white p-6 sm:p-8">
              {error ? <p className="mb-5 text-sm text-red-700" role="alert">{error}</p> : null}
              {!selected ? (
                <p className="text-slate-600">Choose a case to review its indicative guidance.</p>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold text-slate-950">Review case</h2>
                    <StatusPill tone="neutral">{selected.review.status}</StatusPill>
                  </div>
                  <div className="mt-6 space-y-4">
                    {selected.results.map((result) => (
                      <article key={result.course_code} className="rounded-2xl border border-slate-200 p-5">
                        <h3 className="font-semibold text-slate-950">{result.course_code}</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          {result.potential_credit_points === null
                            ? "Manual review"
                            : `Up to ${result.potential_credit_points} credit points`}{" "}
                          · {result.confidence} confidence · cap {result.published_cap ?? "not published"}
                        </p>
                      </article>
                    ))}
                  </div>
                  <Label className="mt-6 block" htmlFor="review-notes">Private notes</Label>
                  <textarea
                    id="review-notes"
                    className="mt-2 min-h-28 w-full rounded-2xl border border-slate-300 p-3 text-sm"
                    maxLength={10000}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  {selected.review.status === "unassigned" ? (
                    <Button className="mt-5" onClick={() => void updateReview("claim")}>Claim case</Button>
                  ) : null}
                  {selected.review.status === "in_review" ? (
                    <div className="mt-5 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select
                          className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                          value={correctionCategory}
                          onChange={(event) => setCorrectionCategory(event.target.value)}
                        >
                          <option value="credit_band">Credit band</option>
                          <option value="evidence_mapping">Evidence mapping</option>
                          <option value="confidence">Confidence</option>
                          <option value="manual_review">Manual review</option>
                          <option value="other">Other</option>
                        </select>
                        <Input
                          aria-label="Corrected credit points"
                          inputMode="numeric"
                          placeholder="Points, blank for manual review"
                          value={correctedPoints}
                          onChange={(event) => setCorrectedPoints(event.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => void updateReview("agree")}>Agree with guidance</Button>
                        <Button variant="outline" onClick={() => void updateReview("correct")}>Record correction</Button>
                      </div>
                    </div>
                  ) : null}
                  {["agreed", "corrected", "exported"].includes(selected.review.status) ? (
                    <Button
                      className="mt-6"
                      disabled={!selected.session.application_id}
                      onClick={() => void exportReview()}
                    >
                      <Download className="h-4 w-4" /> Export audited ZIP
                    </Button>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>
      <AppBrandFooter />
    </div>
  );
}
