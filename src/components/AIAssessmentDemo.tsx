import { BrainCircuit, Sparkles, X } from "lucide-react";
import { AccentIconBadge } from "./AccentIconBadge";
import { ModalShell } from "./ModalShell";
import { SurfaceCard } from "./SurfaceCard";
import { Button } from "./ui/button";

export default function AIAssessmentDemo({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <ModalShell
      bodyClassName="px-6 py-6"
      footer={
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onClose}>
            Return to submission
          </Button>
        </div>
      }
      header={
        <div className="flex items-start justify-between bg-[#084E74] px-6 py-5 text-white">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
              Demo
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              AI Assessment Walkthrough
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/20 p-2 text-white transition hover:bg-white/10"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      }
      maxWidthClassName="max-w-3xl"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <SurfaceCard className="rounded-[28px] bg-slate-50 p-5 shadow-none">
          <AccentIconBadge className="mb-4" tone="accentSoft">
            <BrainCircuit className="h-6 w-6" />
          </AccentIconBadge>
          <h3 className="text-lg font-bold text-slate-900">
            Automated profile review
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This demo layer mirrors the prototype idea from Figma Make: an AI
            assistant checks completeness, highlights evidence gaps, and flags
            potential admission risks before the application goes to staff.
          </p>
        </SurfaceCard>
        <SurfaceCard className="rounded-[28px] border-0 bg-[#084E74] p-5 text-white shadow-none">
          <AccentIconBadge className="mb-4" tone="inverseSoft">
            <Sparkles className="h-6 w-6" />
          </AccentIconBadge>
          <h3 className="text-lg font-bold">Demo output</h3>
          <ul className="mt-3 space-y-3 text-sm text-white/85">
            <li>Strong employment history supports MBA readiness.</li>
            <li>English proficiency evidence is attached and current.</li>
            <li>Recommend requesting one leadership-focused reference.</li>
          </ul>
        </SurfaceCard>
      </div>
    </ModalShell>
  );
}
