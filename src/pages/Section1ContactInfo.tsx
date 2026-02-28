import { Globe2, Landmark } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApplicationShell } from "../components/ApplicationShell";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { countries } from "../lib/formOptions";

export default function Section1ContactInfo() {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();
  const { data, updateContactDetails } = useApplication();
  const [formData, setFormData] = useState({
    citizenCountry: data.contactDetails.citizenCountry,
    birthCountry: data.contactDetails.birthCountry,
    citizenshipStatus: data.contactDetails.citizenshipStatus,
  });

  const persist = () => updateContactDetails(formData);

  return (
    <ApplicationShell
      sectionLabel="Section 1 of 3"
      progress={45}
      title="Citizenship information"
      description="We need a few details about your citizenship and country of birth."
      onPrevious={() => {
        persist();
        navigate(returnPath("/section1/personal-contact"));
      }}
      onSaveAndExit={
        fromReview
          ? undefined
          : () => {
              persist();
              navigate("/dashboard");
            }
      }
      onContinue={() => {
        persist();
        navigate(returnPath("/section1/address"));
      }}
      previousLabel={previousLabel}
      continueLabel={fromReview ? "Save & Return to Review" : "Continue"}
    >
      <div className="space-y-6">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Globe2 className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Citizenship</h2>
              <p className="text-sm text-slate-600">
                These details help us confirm your admissions pathway.
              </p>
            </div>
          </div>
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
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Landmark className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Australian citizenship status
              </h2>
              <p className="text-sm text-slate-600">
                Select the option that best describes your current status.
              </p>
            </div>
          </div>
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
        </div>
      </div>
    </ApplicationShell>
  );
}
