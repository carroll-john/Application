import { AlertCircle, Heart, Users } from "lucide-react";
import { useState } from "react";
import { ApplicationShell } from "../components/ApplicationShell";
import { FormSectionCard } from "../components/FormSectionCard";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useSection1Step } from "../hooks/useSection1Step";

const educationLevels = [
  "Did not complete high school",
  "High school certificate",
  "Certificate I to IV (including trade certificate)",
  "Diploma or Associate Degree",
  "Bachelor degree",
  "Postgraduate degree",
  "Unknown",
];

const parentFields = [
  "parent1Details",
  "parent2Details",
  "parent3Details",
  "parent4Details",
  "parent5Details",
] as const;

export default function Section1FamilySupport() {
  const { data, updateContactDetails } = useApplication();
  const [formData, setFormData] = useState({
    parentsCount: data.contactDetails.parentsCount || "",
    parent1Details: data.contactDetails.parent1Details || "",
    parent2Details: data.contactDetails.parent2Details || "",
    parent3Details: data.contactDetails.parent3Details || "",
    parent4Details: data.contactDetails.parent4Details || "",
    parent5Details: data.contactDetails.parent5Details || "",
    hasDisability: data.contactDetails.hasDisability ?? null,
    disabilityDetails: data.contactDetails.disabilityDetails || "",
  });
  const [showValidation, setShowValidation] = useState(false);

  const parentCount = Number(formData.parentsCount || 0);
  const missingParentEducationFields = parentFields
    .slice(0, parentCount)
    .filter((field) => !formData[field].trim());
  const isParentCountMissing = formData.parentsCount === "";
  const isDisabilityChoiceMissing = formData.hasDisability === null;
  const isDisabilityDetailsMissing =
    formData.hasDisability === true && !formData.disabilityDetails.trim();

  const persist = () => updateContactDetails(formData);
  const { shellProps, step } = useSection1Step({
    step: "family-support",
    persist,
  });

  function scrollToField(fieldId: string) {
    window.requestAnimationFrame(() => {
      document
        .getElementById(fieldId)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleChange(
    field: keyof typeof formData,
    value: string | boolean | null,
  ) {
    setFormData((previous) => {
      const next = { ...previous, [field]: value };

      if (field === "parentsCount") {
        const parsedParentCount = Number.parseInt(String(value), 10);

        parentFields.forEach((parentField, index) => {
          if (!Number.isFinite(parsedParentCount) || index >= parsedParentCount) {
            next[parentField] = "";
          }
        });
      }

      if (field === "hasDisability" && value !== true) {
        next.disabilityDetails = "";
      }

      return next;
    });
  }

  function handleContinue() {
    if (isParentCountMissing) {
      setShowValidation(true);
      scrollToField("parentsCount");
      return;
    }

    if (missingParentEducationFields.length > 0) {
      setShowValidation(true);
      scrollToField(missingParentEducationFields[0]);
      return;
    }

    if (isDisabilityChoiceMissing) {
      setShowValidation(true);
      scrollToField("hasDisability-options");
      return;
    }

    if (isDisabilityDetailsMissing) {
      setShowValidation(true);
      scrollToField("disabilityDetails");
      return;
    }

    shellProps.onContinue();
  }

  return (
    <ApplicationShell
      sectionLabel={step.sectionLabel}
      progress={step.progress}
      title={step.title}
      description={step.description}
      {...shellProps}
      onContinue={handleContinue}
    >
      <div className="space-y-6">
        <FormSectionCard
          className="rounded-[30px] border-slate-200 p-5 sm:p-6"
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
                onChange={(event) =>
                  handleChange("parentsCount", event.target.value)
                }
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
                <h3 className="text-sm font-semibold text-slate-900">
                  Education Levels
                </h3>
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
                        onChange={(event) =>
                          handleChange(field, event.target.value)
                        }
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
        </FormSectionCard>

        <FormSectionCard
          className="rounded-[30px] border-slate-200 p-5 sm:p-6"
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
                    onChange={() => handleChange("hasDisability", true)}
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
                    onChange={() => handleChange("hasDisability", false)}
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
                <Label htmlFor="disabilityDetails">
                  Please provide details *
                </Label>
                <Input
                  id="disabilityDetails"
                  type="text"
                  value={formData.disabilityDetails}
                  onChange={(event) =>
                    handleChange("disabilityDetails", event.target.value)
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
        </FormSectionCard>
      </div>
    </ApplicationShell>
  );
}
