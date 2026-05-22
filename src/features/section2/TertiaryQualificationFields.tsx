import { GraduationCap } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { NativeSelect } from "../../components/ui/native-select";
import type { TertiaryQualification } from "../../lib/applicationData";
import { Section2FormCard } from "./Section2FormCard";

interface TertiaryQualificationFieldsProps {
  formData: TertiaryQualification;
  onFormChange: (
    updater: (previous: TertiaryQualification) => TertiaryQualification,
  ) => void;
}

export function TertiaryQualificationFields({
  formData,
  onFormChange,
}: TertiaryQualificationFieldsProps) {
  return (
    <Section2FormCard
      description="What did you study?"
      icon={<GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="Qualification Details"
    >
      <div className="space-y-5">
        <div>
          <Label>Qualification Level <span className="text-red-500">*</span></Label>
          <NativeSelect
            value={formData.level}
            onChange={(event) =>
              onFormChange((previous) => ({
                ...previous,
                level: event.target.value,
              }))
            }
          >
            <option value="">Select level</option>
            <option value="Associate Degree">Associate Degree</option>
            <option value="Diploma">Diploma</option>
            <option value="Advanced Diploma">Advanced Diploma</option>
            <option value="Bachelor">Bachelor Degree</option>
            <option value="Honours">Honours Degree</option>
            <option value="Graduate Certificate">Graduate Certificate</option>
            <option value="Graduate Diploma">Graduate Diploma</option>
            <option value="Masters">Masters Degree</option>
            <option value="PhD">PhD/Doctorate</option>
          </NativeSelect>
        </div>
        <div>
          <Label>Course Name <span className="text-red-500">*</span></Label>
          <Input
            className="h-12 text-base"
            placeholder="e.g. Bachelor of Science"
            value={formData.courseName}
            onChange={(event) =>
              onFormChange((previous) => ({
                ...previous,
                courseName: event.target.value,
              }))
            }
          />
        </div>
      </div>
    </Section2FormCard>
  );
}
