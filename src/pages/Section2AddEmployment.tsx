import { Briefcase, Building, Calendar, FileText } from "lucide-react";
import { useState } from "react";
import { MonthYearPickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { Section2FormCard, Section2RecordPage } from "../features/section2";
import { useEditableRecord } from "../hooks/useEditableRecord";
import { months, years } from "../lib/formOptions";
import { isMonthYearRangeOutOfOrder } from "../lib/monthYearValidation";

export default function Section2AddEmployment() {
  const { data, addEmploymentExperience, updateEmploymentExperience } =
    useApplication();
  const { existing, isEditing, initialRecord } = useEditableRecord(
    data.employmentExperiences,
    () => ({
      id: crypto.randomUUID(),
      company: "",
      position: "",
      type: "",
      startMonth: "",
      startYear: "",
      endMonth: "",
      endYear: "",
      currentRole: false,
      duties: "",
    }),
  );

  const [formData, setFormData] = useState(initialRecord);
  const [showValidation, setShowValidation] = useState(false);
  const dateRangeError =
    !formData.currentRole &&
    isMonthYearRangeOutOfOrder(
      formData.startMonth,
      formData.startYear,
      formData.endMonth,
      formData.endYear,
    )
      ? "Start date must be before or the same as end date."
      : null;

  const saveRecord = () => {
    if (existing) {
      updateEmploymentExperience(existing.id, formData);
    } else {
      addEmploymentExperience(formData);
    }
  };

  return (
    <Section2RecordPage
      addTitle="Add Employment Experience"
      beforeContinue={() => {
        setShowValidation(true);
        return !dateRangeError;
      }}
      className="overflow-x-hidden"
      description="Add your work history and experience."
      editTitle="Edit Employment Experience"
      isEditing={isEditing}
      onSave={saveRecord}
    >
      <div className="space-y-6">
        <Section2FormCard
            description="Tell us where you worked."
            icon={<Building className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Employer Details"
          >
            <Label>Company/Organization <span className="text-red-500">*</span></Label>
            <Input
              className="h-12 text-base"
              placeholder="Enter company name"
              value={formData.company}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  company: event.target.value,
                }))
              }
            />
          </Section2FormCard>

          <Section2FormCard
            description="Tell us about the role."
            icon={<Briefcase className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Role Details"
          >
            <div className="space-y-5">
              <div>
                <Label>Position/Role <span className="text-red-500">*</span></Label>
                <Input
                  className="h-12 text-base"
                  placeholder="e.g. Marketing Manager"
                  value={formData.position}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      position: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Employment Type <span className="text-red-500">*</span></Label>
                <NativeSelect
                  value={formData.type}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      type: event.target.value,
                    }))
                  }
                >
                  <option value="">Select type</option>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Casual">Casual</option>
                  <option value="Internship">Internship</option>
                </NativeSelect>
              </div>
            </div>
          </Section2FormCard>

          <Section2FormCard
            description="When did you work here?"
            icon={<Calendar className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Employment Period"
          >
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Start date <span className="text-red-500">*</span></Label>
                  <MonthYearPickerField
                    description="Choose the month and year this role began."
                    label="Start"
                    month={formData.startMonth}
                    months={months}
                    title="Select employment start"
                    year={formData.startYear}
                    years={years}
                    onChange={(startMonth, startYear) =>
                      setFormData((previous) => ({
                        ...previous,
                        startMonth,
                        startYear,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
                <label className="flex items-start gap-3">
                  <input
                    checked={formData.currentRole}
                    type="checkbox"
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        currentRole: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">
                      I currently work here
                    </span>
                    <span className="mt-1 block text-xs text-gray-600">
                      Select this if you still work in this role.
                    </span>
                  </span>
                </label>
              </div>

              {!formData.currentRole ? (
                <div className="grid gap-5 animate-in fade-in duration-300 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>End date <span className="text-red-500">*</span></Label>
                    <MonthYearPickerField
                      description="Choose the month and year this role ended."
                      label="End"
                      month={formData.endMonth}
                      months={months}
                      title="Select employment end"
                      year={formData.endYear}
                      years={years}
                      onChange={(endMonth, endYear) =>
                        setFormData((previous) => ({
                          ...previous,
                          endMonth,
                          endYear,
                        }))
                      }
                    />
                  </div>
                  {showValidation && dateRangeError ? (
                    <p className="sm:col-span-2 text-sm text-red-600">
                      {dateRangeError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Section2FormCard>

          <Section2FormCard
            description="Summarise your responsibilities and achievements."
            icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
            title="Key Responsibilities"
          >
            <Label>Key Duties and Achievements <span className="text-red-500">*</span></Label>
            <textarea
              className="min-h-40 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-[var(--cta-secondary)] focus:ring-4 focus:ring-[var(--cta-secondary)]/10"
              placeholder={
                "• Managed a team of 5 marketing professionals\n• Increased social media engagement by 40%\n• Developed and executed quarterly campaigns..."
              }
              rows={8}
              value={formData.duties}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  duties: event.target.value,
                }))
              }
            />
            <p className="mt-2 text-xs text-gray-500">
              Focus on your main responsibilities, achievements, and skills used.
            </p>
          </Section2FormCard>
      </div>
    </Section2RecordPage>
  );
}
