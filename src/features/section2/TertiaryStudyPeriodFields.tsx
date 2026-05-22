import { Calendar } from "lucide-react";
import { MonthYearPickerField } from "../../components/ui/date-controls";
import { Label } from "../../components/ui/label";
import type { TertiaryQualification } from "../../lib/applicationData";
import { months, years } from "../../lib/formOptions";
import { Section2FormCard } from "./Section2FormCard";

interface TertiaryStudyPeriodFieldsProps {
  dateRangeError: string | null;
  formData: TertiaryQualification;
  missingEndDate: boolean;
  onFormChange: (
    updater: (previous: TertiaryQualification) => TertiaryQualification,
  ) => void;
  showValidation: boolean;
}

export function TertiaryStudyPeriodFields({
  dateRangeError,
  formData,
  missingEndDate,
  onFormChange,
  showValidation,
}: TertiaryStudyPeriodFieldsProps) {
  return (
    <Section2FormCard
      description="When did you study?"
      icon={<Calendar className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
      title="Study Period"
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Start date <span className="text-red-500">*</span></Label>
            <MonthYearPickerField
              description="Choose the month and year you started this qualification."
              label="Start"
              month={formData.startMonth}
              months={months}
              title="Select start date"
              year={formData.startYear}
              years={years}
              onChange={(startMonth, startYear) =>
                onFormChange((previous) => ({
                  ...previous,
                  startMonth,
                  startYear,
                }))
              }
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <label className="flex items-start gap-3">
            <input
              checked={formData.completed}
              type="checkbox"
              onChange={(event) =>
                onFormChange((previous) => ({
                  ...previous,
                  completed: event.target.checked,
                }))
              }
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">
                I have completed this qualification
              </span>
              <span className="mt-1 block text-xs text-gray-600">
                Check this if you've graduated or finished the course.
              </span>
            </span>
          </label>
        </div>
        <div className="grid gap-5 animate-in fade-in duration-300 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>End date <span className="text-red-500">*</span></Label>
            <MonthYearPickerField
              description={
                formData.completed
                  ? "Choose the month and year you completed this qualification."
                  : "Choose the month and year you stopped studying."
              }
              label="End"
              month={formData.endMonth}
              months={months}
              title="Select end date"
              year={formData.endYear}
              years={years}
              onChange={(endMonth, endYear) =>
                onFormChange((previous) => ({
                  ...previous,
                  endMonth,
                  endYear,
                }))
              }
            />
          </div>
        </div>
        {showValidation && missingEndDate ? (
          <p className="text-sm text-red-600">Select an end date.</p>
        ) : null}
        {showValidation && dateRangeError ? (
          <p className="text-sm text-red-600">{dateRangeError}</p>
        ) : null}
      </div>
    </Section2FormCard>
  );
}
