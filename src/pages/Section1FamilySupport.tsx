import { useState } from "react";
import { useApplication } from "../context/ApplicationContext";
import {
  FamilySupportDisabilityFields,
  FamilySupportParentFields,
  Section1StepPage,
  parentFields,
} from "../features/section1";

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

  function beforeContinue() {
    if (isParentCountMissing) {
      setShowValidation(true);
      scrollToField("parentsCount");
      return false;
    }

    if (missingParentEducationFields.length > 0) {
      setShowValidation(true);
      scrollToField(missingParentEducationFields[0]);
      return false;
    }

    if (isDisabilityChoiceMissing) {
      setShowValidation(true);
      scrollToField("hasDisability-options");
      return false;
    }

    if (isDisabilityDetailsMissing) {
      setShowValidation(true);
      scrollToField("disabilityDetails");
      return false;
    }

    return true;
  }

  return (
    <Section1StepPage
      beforeContinue={beforeContinue}
      persist={persist}
      step="family-support"
    >
      <div className="space-y-6">
        <FamilySupportParentFields
          formData={formData}
          missingParentEducationFields={missingParentEducationFields}
          showValidation={showValidation}
          onChange={handleChange}
        />
        <FamilySupportDisabilityFields
          formData={formData}
          isDisabilityChoiceMissing={isDisabilityChoiceMissing}
          isDisabilityDetailsMissing={isDisabilityDetailsMissing}
          showValidation={showValidation}
          onChange={handleChange}
        />
      </div>
    </Section1StepPage>
  );
}
