import { Mail, Phone, UserCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApplicationShell } from "../components/ApplicationShell";
import { DatePickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { useReviewReturn } from "../hooks/useReviewReturn";
import { getBirthDateOpenToDate } from "../lib/datePickerHelpers";

export default function Section1PersonalContact() {
  const navigate = useNavigate();
  const { fromReview, previousLabel, returnPath } = useReviewReturn();
  const { data, updatePersonalDetails } = useApplication();
  const [birthDateOpenToDate] = useState(() =>
    getBirthDateOpenToDate(new Date()),
  );
  const [formData, setFormData] = useState({
    gender: data.personalDetails.gender,
    dateOfBirth: data.personalDetails.dateOfBirth,
    email: data.personalDetails.email,
    phone: data.personalDetails.phone,
  });

  const persist = () => updatePersonalDetails(formData);

  return (
    <ApplicationShell
      sectionLabel="Section 1 of 3"
      progress={33}
      title="Personal contact details"
      description="Tell us about your gender, date of birth, and how to contact you."
      onPrevious={() => {
        persist();
        navigate(returnPath("/section1/basic-info"));
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
        navigate(returnPath("/section1/contact-info"));
      }}
      previousLabel={previousLabel}
      continueLabel={fromReview ? "Save & Return to Review" : "Continue"}
    >
      <div className="space-y-6">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <UserCircle className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Personal information
              </h2>
              <p className="text-sm text-slate-600">Basic details about you.</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="gender">Gender *</Label>
              <NativeSelect
                id="gender"
                value={formData.gender}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    gender: event.target.value,
                  }))
                }
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="dateOfBirth">Date of birth *</Label>
              <DatePickerField
                id="dateOfBirth"
                maxDate={new Date().toISOString().split("T")[0]}
                openToDate={birthDateOpenToDate}
                value={formData.dateOfBirth}
                onChange={(dateOfBirth) =>
                  setFormData((previous) => ({
                    ...previous,
                    dateOfBirth,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <Phone className="mt-0.5 h-6 w-6 shrink-0 text-[#084E74]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Contact details
              </h2>
              <p className="text-sm text-slate-600">
                How we can reach you during the application process.
              </p>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <Label htmlFor="email">Email address *</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  className="pl-10"
                  placeholder="your.email@example.com"
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">Phone number *</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="phone"
                  className="pl-10"
                  placeholder="04XX XXX XXX"
                  type="tel"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ApplicationShell>
  );
}
