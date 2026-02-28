import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FormActionBar } from "../components/FormActionBar";
import { FormSectionCard } from "../components/FormSectionCard";
import { SectionProgressHeader } from "../components/SectionProgressHeader";
import { YearPickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { countries, years } from "../lib/formOptions";

export default function Section2AddSecondary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { returnPath } = useReviewReturn();
  const { data, addSecondaryQualification, updateSecondaryQualification } =
    useApplication();
  const existing = useMemo(
    () => data.secondaryQualifications.find((qualification) => qualification.id === id),
    [data.secondaryQualifications, id],
  );

  const [formData, setFormData] = useState({
    id: existing?.id ?? crypto.randomUUID(),
    type: existing?.type ?? "",
    country: existing?.country ?? "Australia",
    state: existing?.state ?? "",
    school: existing?.school ?? "",
    qualification: existing?.qualification ?? "",
    year: existing?.year ?? "",
  });

  const saveRecord = () => {
    if (existing) {
      updateSecondaryQualification(existing.id, formData);
    } else {
      addSecondaryQualification(formData);
    }
  };

  return (
    <div className="bg-gray-50 pb-12">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <SectionProgressHeader
          description="Add your high school qualification."
          progress={66}
          sectionLabel="Section 2 of 3"
          title={existing ? "Edit Secondary Qualification" : "Add Secondary Qualification"}
        />

        <FormSectionCard className="lg:p-8">
          <div className="space-y-6">
            <div>
              <Label>Qualification Type *</Label>
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
                <option value="Year 12">Year 12 Certificate</option>
                <option value="HSC">Higher School Certificate (HSC)</option>
                <option value="VCE">Victorian Certificate of Education (VCE)</option>
                <option value="ATAR">ATAR</option>
                <option value="IB">International Baccalaureate (IB)</option>
                <option value="Other">Other</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Country *</Label>
              <NativeSelect
                value={formData.country}
                onChange={(event) =>
                  setFormData((previous) => ({
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
            <div>
              <Label>State/Province</Label>
              <Input
                placeholder="Enter state or province"
                value={formData.state}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    state: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>School Name *</Label>
              <Input
                placeholder="Enter school name"
                value={formData.school}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    school: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Qualification Obtained *</Label>
              <Input
                placeholder="e.g. HSC, ATAR score"
                value={formData.qualification}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    qualification: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Completion Year *</Label>
              <YearPickerField
                description="Choose the year you completed it."
                label="Completion year"
                title="Select completion year"
                value={formData.year}
                years={years}
                onChange={(year) =>
                  setFormData((previous) => ({
                    ...previous,
                    year,
                  }))
                }
              />
            </div>
          </div>
        </FormSectionCard>

        <FormActionBar
          previousLabel="Cancel"
          primaryLabel="Save & Continue"
          onPrevious={() => navigate(returnPath("/section2/qualifications"))}
          onPrimary={() => {
            saveRecord();
            navigate(returnPath("/section2/qualifications"));
          }}
        />
      </div>
    </div>
  );
}
