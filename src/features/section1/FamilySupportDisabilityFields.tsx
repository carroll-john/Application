import { AlertCircle, Heart } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Section1FormCard } from "./Section1FormCard";
import type { FamilySupportFormData } from "./familySupportTypes";

interface FamilySupportDisabilityFieldsProps {
  formData: FamilySupportFormData;
  isDisabilityChoiceMissing: boolean;
  isDisabilityDetailsMissing: boolean;
  onChange: (
    field: keyof FamilySupportFormData,
    value: string | boolean | null,
  ) => void;
  showValidation: boolean;
}

export function FamilySupportDisabilityFields({
  formData,
  isDisabilityChoiceMissing,
  isDisabilityDetailsMissing,
  onChange,
  showValidation,
}: FamilySupportDisabilityFieldsProps) {
  return (
    <Section1FormCard
      description="Tell us if you need support or reasonable adjustments. This information is confidential and is not used to assess your suitability for the course."
      icon={<Heart className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="Disability & Support Needs"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
          <Label className="mb-3 block">
            Do you have a disability, impairment or long-term condition? *
          </Label>
          <div className="space-y-3" id="hasDisability-options">
            <label className="flex cursor-pointer items-start space-x-3">
              <input
                checked={formData.hasDisability === true}
                className="mt-1 h-4 w-4 border-slate-300 text-[var(--cta-secondary)] focus:ring-[var(--cta-secondary)]"
                name="hasDisability"
                type="radio"
                onChange={() => onChange("hasDisability", true)}
              />
              <span>
                <span className="mb-1 block text-sm font-medium text-slate-900">
                  Yes, I have a disability, impairment or long-term condition
                </span>
                <span className="text-xs text-slate-600">
                  This helps us arrange support or reasonable adjustments if needed.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start space-x-3">
              <input
                checked={formData.hasDisability === false}
                className="mt-1 h-4 w-4 border-slate-300 text-[var(--cta-secondary)] focus:ring-[var(--cta-secondary)]"
                name="hasDisability"
                type="radio"
                onChange={() => onChange("hasDisability", false)}
              />
              <span className="text-sm font-medium text-slate-900">
                No, I do not have a disability, impairment or long-term
                condition
              </span>
            </label>
          </div>
          {showValidation && isDisabilityChoiceMissing ? (
            <p className="mt-3 text-sm text-red-600">
              Select Yes or No so we know whether support details are needed.
            </p>
          ) : null}
        </div>

        {formData.hasDisability === true ? (
          <div className="animate-in fade-in space-y-3 duration-300">
            <Label htmlFor="disabilityDetails">Please provide details *</Label>
            <Input
              id="disabilityDetails"
              type="text"
              value={formData.disabilityDetails}
              onChange={(event) =>
                onChange("disabilityDetails", event.target.value)
              }
              placeholder="Tell us about your disability, impairment, or condition"
            />
            {showValidation && isDisabilityDetailsMissing ? (
              <p className="text-sm text-red-600">
                Add a short description so the support team knows what to plan for.
              </p>
            ) : null}
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This information is confidential and will only be used to
                provide you with appropriate support services
              </span>
            </p>
          </div>
        ) : formData.hasDisability === false ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              No support details will be recorded unless you select Yes above.
            </p>
          </div>
        ) : null}
      </div>
    </Section1FormCard>
  );
}
