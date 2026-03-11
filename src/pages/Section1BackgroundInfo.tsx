import { AlertCircle, Heart, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";

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

export default function Section1BackgroundInfo() {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();
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

  function persist() {
    updateContactDetails({ ...data.contactDetails, ...formData });
  }

  function handlePrevious() {
    persist();
    navigate(returnPath("/section1/cultural-background"));
  }

  function handleSaveAndContinue() {
    if (isParentCountMissing) {
      setShowValidation(true);
      scrollToField("parentsCount");
      return;
    }

    if (missingParentEducationFields.length > 0) {
      setShowValidation(true);
      const firstMissingField = missingParentEducationFields[0];
      scrollToField(firstMissingField);
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

    persist();
    navigate(returnPath("/section2/qualifications"));
  }

  function handleSaveAndExit() {
    persist();
    navigate("/dashboard");
  }

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="These answers support required reporting and help us arrange reasonable adjustments if you need them. They do not affect your admission outcome."
          progress={100}
          sectionLabel="Section 1 of 3"
          title="Family & Support Information"
        />

        <div className="space-y-6">
          <FormSectionCard
            description="Answer for the parent(s) or guardian(s) who mainly raised you. This is used for reporting only and does not affect your application outcome."
            icon={<Users className="mt-0.5 h-5 w-5 shrink-0 text-[#084E74] sm:h-6 sm:w-6" />}
            title="Parent/Guardian Information"
          >
            <div className="space-y-5">
              <div>
                <Label
                  className="mb-1.5 text-sm font-medium text-gray-700"
                  htmlFor="parentsCount"
                >
                  How many parents/guardians do you have?{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <NativeSelect
                  id="parentsCount"
                  value={formData.parentsCount}
                  onChange={(event) =>
                    handleChange("parentsCount", event.target.value)
                  }
                  className="h-12 text-base"
                >
                  <option value="">Select number</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </NativeSelect>
                <p className="mt-2 text-sm text-gray-600">
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
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                    <p className="text-sm text-gray-600">
                      We won&apos;t record any parent or guardian education details.
                    </p>
                  </div>
                </div>
              ) : null}

              {parentCount > 0 ? (
                <div className="space-y-4 border-t border-gray-200 pt-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Education Levels
                  </h3>
                  <p className="text-sm text-gray-600">
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
                        <Label
                          className="mb-1.5 text-sm font-medium text-gray-700"
                          htmlFor={field}
                        >
                          Parent/Guardian {index + 1} Education Level{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <NativeSelect
                          id={field}
                          value={formData[field]}
                          onChange={(event) =>
                            handleChange(field, event.target.value)
                          }
                          className={`h-12 text-base ${
                            isMissing
                              ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
                              : ""
                          }`}
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
            description="Tell us if you need support or reasonable adjustments. This information is confidential and is not used to assess your suitability for the course."
            icon={<Heart className="mt-0.5 h-5 w-5 shrink-0 text-[#084E74] sm:h-6 sm:w-6" />}
            title="Disability & Support Needs"
          >
            <div className="space-y-5">
              <div className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] p-4">
                <Label className="mb-3 block text-sm font-medium text-gray-900">
                  Do you have a disability, impairment or long-term condition?{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-3" id="hasDisability-options">
                  <label className="flex cursor-pointer items-start space-x-3">
                    <input
                      checked={formData.hasDisability === true}
                      className="mt-1 h-4 w-4 border-gray-300 text-[#084E74] focus:ring-[#084E74]"
                      name="hasDisability"
                      type="radio"
                      onChange={() => handleChange("hasDisability", true)}
                    />
                    <span>
                      <span className="mb-1 block text-sm font-medium text-gray-900">
                        Yes, I have a disability, impairment or long-term condition
                      </span>
                      <span className="text-xs text-gray-600">
                        This helps us arrange support or reasonable adjustments if needed.
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start space-x-3">
                    <input
                      checked={formData.hasDisability === false}
                      className="mt-1 h-4 w-4 border-gray-300 text-[#084E74] focus:ring-[#084E74]"
                      name="hasDisability"
                      type="radio"
                      onChange={() => handleChange("hasDisability", false)}
                    />
                    <span className="text-sm font-medium text-gray-900">
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
                  <Label
                    className="text-sm font-medium text-gray-700"
                    htmlFor="disabilityDetails"
                  >
                    Please provide details <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="disabilityDetails"
                    type="text"
                    value={formData.disabilityDetails}
                    onChange={(event) =>
                      handleChange("disabilityDetails", event.target.value)
                    }
                    placeholder="Tell us about your disability, impairment, or condition"
                    className="h-12 text-base"
                  />
                  {showValidation && isDisabilityDetailsMissing ? (
                    <p className="text-sm text-red-600">
                      Add a short description so the support team knows what to plan for.
                    </p>
                  ) : null}
                  <p className="flex items-start gap-2 text-xs text-gray-500">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      This information is confidential and will only be used to
                      provide you with appropriate support services
                    </span>
                  </p>
                </div>
              ) : formData.hasDisability === false ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    No support details will be recorded unless you select Yes above.
                  </p>
                </div>
              ) : null}
            </div>
          </FormSectionCard>
        </div>

        <FormActionBar
          previousLabel={previousLabel}
          primaryLabel={fromReview ? "Save & Return to Review" : "Continue"}
          onPrevious={handlePrevious}
          onPrimary={handleSaveAndContinue}
          onSecondary={fromReview ? undefined : handleSaveAndExit}
          secondaryLabel={fromReview ? undefined : "Save & Exit"}
        />
      </div>
    </div>
  );
}
