import { useCallback, useState } from "react";
import { YearPickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { Section2FormCard, Section2RecordPage } from "../features/section2";
import { useEditableRecord, useSyncRecordOnHydrate } from "../hooks/useEditableRecord";
import { countries, years } from "../lib/formOptions";

export default function Section2AddSecondary() {
  const { data, addSecondaryQualification, updateSecondaryQualification } =
    useApplication();
  const { existing, id, isEditing, initialRecord } = useEditableRecord(
    data.secondaryQualifications,
    () => ({
      id: crypto.randomUUID(),
      type: "",
      country: "Australia",
      state: "",
      school: "",
      qualification: "",
      year: "",
    }),
  );

  const [formData, setFormData] = useState(initialRecord);

  useSyncRecordOnHydrate(
    id,
    existing,
    initialRecord,
    useCallback((record) => setFormData(record), []),
  );

  const saveRecord = () => {
    if (existing) {
      updateSecondaryQualification(existing.id, formData);
    } else {
      addSecondaryQualification(formData);
    }
  };

  return (
    <Section2RecordPage
      addTitle="Add Secondary Qualification"
      description="Add your high school qualification."
      editTitle="Edit Secondary Qualification"
      isEditing={isEditing}
      onSave={saveRecord}
    >
      <Section2FormCard>
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
      </Section2FormCard>
    </Section2RecordPage>
  );
}
