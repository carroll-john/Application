import { ArrowRightLeft } from "lucide-react";
import type { ApplicationPrefillSource } from "../lib/applicationData";
import { cn } from "../lib/utils";
import { SurfaceCard } from "./SurfaceCard";

export function CopiedApplicationNotice({
  className,
  prefilledFrom,
  readyToSubmit = false,
}: {
  className?: string;
  prefilledFrom: ApplicationPrefillSource;
  readyToSubmit?: boolean;
}) {
  return (
    <SurfaceCard
      className={cn(
        "border-[var(--info-border)] bg-[var(--info-bg)] p-5 text-[var(--info-text)]",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-white/80 p-3">
          <ArrowRightLeft className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            We copied this application from your {prefilledFrom.course.title}{" "}
            application.
          </p>
          <p className="mt-2 text-sm leading-6">
            Personal details, contact details, qualifications, employment
            history, and stored supporting documents were carried across to save
            time. Review any course-specific requirements before you submit.
          </p>
          {readyToSubmit ? (
            <p className="mt-3 text-sm font-medium">
              All required fields are already complete for this course.
            </p>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}
