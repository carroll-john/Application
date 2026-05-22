import { Building2 } from "lucide-react";
import { InstitutionAutocomplete } from "../../components/ui/institution-autocomplete";
import { Label } from "../../components/ui/label";
import { NativeSelect } from "../../components/ui/native-select";
import type { TertiaryQualification } from "../../lib/applicationData";
import { countries } from "../../lib/formOptions";
import { Section2FormCard } from "./Section2FormCard";

interface TertiaryInstitutionFieldsProps {
  formData: TertiaryQualification;
  onFormChange: (
    updater: (previous: TertiaryQualification) => TertiaryQualification,
  ) => void;
}

export function TertiaryInstitutionFields({
  formData,
  onFormChange,
}: TertiaryInstitutionFieldsProps) {
  return (
    <Section2FormCard
      description="Where did you study?"
      icon={<Building2 className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="Institution Details"
    >
      <div className="space-y-5">
        <div>
          <Label>Institution Name <span className="text-red-500">*</span></Label>
          <InstitutionAutocomplete
            className="h-12 text-base"
            placeholder="Start typing institution name"
            value={formData.institution}
            onValueChange={(institution) =>
              onFormChange((previous) => ({
                ...previous,
                institution,
              }))
            }
          />
          <p className="mt-2 text-xs text-slate-500">
            Suggestions help keep institution names consistent. If yours
            is not listed, keep typing to enter it manually.
          </p>
        </div>
        <div>
          <Label>Country <span className="text-red-500">*</span></Label>
          <NativeSelect
            className="h-12 text-base"
            value={formData.country}
            onChange={(event) =>
              onFormChange((previous) => ({
                ...previous,
                country: event.target.value,
              }))
            }
          >
            <option value="">Select country</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
    </Section2FormCard>
  );
}
