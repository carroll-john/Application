import { AlertCircle, Users } from "lucide-react";
import { Label } from "../../components/ui/label";
import { NativeSelect } from "../../components/ui/native-select";
import { Section1FormCard } from "./Section1FormCard";
import {
  educationLevels,
  parentFields,
  type FamilySupportFormData,
  type ParentField,
} from "./familySupportTypes";

interface FamilySupportParentFieldsProps {
  formData: FamilySupportFormData;
  missingParentEducationFields: ParentField[];
  onChange: (
    field: keyof FamilySupportFormData,
    value: string | boolean | null,
  ) => void;
  showValidation: boolean;
}

export function FamilySupportParentFields({
  formData,
  missingParentEducationFields,
  onChange,
  showValidation,
}: FamilySupportParentFieldsProps) {
  const parentCount = Number(formData.parentsCount || 0);
  const isParentCountMissing = formData.parentsCount === "";

  return (
    <Section1FormCard
      description="Answer for the parent(s) or guardian(s) who mainly raised you. This is used for reporting only and does not affect your application outcome."
      icon={<Users className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="Parent/Guardian Information"
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="parentsCount">
            How many parents/guardians do you have? *
          </Label>
          <NativeSelect
            id="parentsCount"
            value={formData.parentsCount}
            onChange={(event) => onChange("parentsCount", event.target.value)}
          >
            <option value="">Select number</option>
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </NativeSelect>
          <p className="mt-2 text-sm text-slate-600">
            If this does not apply, choose 0 and we&apos;ll skip the
            education questions below.
          </p>
          {showValidation && isParentCountMissing ? (
            <p className="mt-1.5 text-sm text-red-600">
              Select how many parents or guardians apply to you.
            </p>
          ) : null}
        </div>

        {parentCount === 0 && formData.parentsCount !== "" ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <p className="text-sm text-slate-600">
                We won&apos;t record any parent or guardian education details.
              </p>
            </div>
          </div>
        ) : null}

        {parentCount > 0 ? (
          <div className="space-y-4 border-t border-slate-200 pt-2">
            <h3 className="text-sm font-semibold text-slate-900">Education Levels</h3>
            <p className="text-sm text-slate-600">
              Only the parent or guardian fields matching your selected
              count are required.
            </p>
            {showValidation && missingParentEducationFields.length > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-700">
                  Complete each parent/guardian education level before continuing.
                </p>
              </div>
            ) : null}
            {Array.from({ length: parentCount }, (_, index) => {
              const field = parentFields[index];
              const isMissing =
                showValidation && missingParentEducationFields.includes(field);
              return (
                <div key={field} className="pt-4 first:pt-0">
                  <Label htmlFor={field}>
                    Parent/Guardian {index + 1} Education Level *
                  </Label>
                  <NativeSelect
                    id={field}
                    value={formData[field]}
                    onChange={(event) => onChange(field, event.target.value)}
                    className={
                      isMissing
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
                        : undefined
                    }
                  >
                    <option value="">Select education level</option>
                    {educationLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </NativeSelect>
                  {isMissing ? (
                    <p className="mt-1.5 text-sm text-red-600">
                      Select an education level.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Section1FormCard>
  );
}
