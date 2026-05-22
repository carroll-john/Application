import { Globe2, Landmark } from "lucide-react";
import { useState } from "react";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { Section1FormCard, Section1StepPage } from "../features/section1";
import { countries } from "../lib/formOptions";

export default function Section1ContactInfo() {
  const { data, updateContactDetails } = useApplication();
  const [formData, setFormData] = useState({
    citizenCountry: data.contactDetails.citizenCountry,
    birthCountry: data.contactDetails.birthCountry,
    citizenshipStatus: data.contactDetails.citizenshipStatus,
  });

  const persist = () => updateContactDetails(formData);

  return (
    <Section1StepPage step="contact-info" persist={persist}>
      <div className="space-y-6">
        <Section1FormCard
          description="These details help us confirm your admissions pathway."
          icon={<Globe2 className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
          title="Citizenship"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="citizenCountry">Citizen country</Label>
              <NativeSelect
                id="citizenCountry"
                value={formData.citizenCountry}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    citizenCountry: event.target.value,
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
              <Label htmlFor="birthCountry">Birth country</Label>
              <NativeSelect
                id="birthCountry"
                value={formData.birthCountry}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    birthCountry: event.target.value,
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
        </Section1FormCard>

        <Section1FormCard
          description="Select the option that best describes your current status."
          icon={<Landmark className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
          title="Australian citizenship status"
        >
          <Label htmlFor="citizenshipStatus">Status *</Label>
          <NativeSelect
            id="citizenshipStatus"
            value={formData.citizenshipStatus}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                citizenshipStatus: event.target.value,
              }))
            }
          >
            <option value="">Select status</option>
            <option value="Australian Citizen">Australian Citizen</option>
            <option value="Permanent Resident">Permanent Resident</option>
            <option value="New Zealand Citizen">New Zealand Citizen</option>
            <option value="International Applicant">International Applicant</option>
          </NativeSelect>
        </Section1FormCard>
      </div>
    </Section1StepPage>
  );
}
