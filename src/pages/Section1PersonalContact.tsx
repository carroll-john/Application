import { Mail, Phone, UserCircle } from "lucide-react";
import { useState } from "react";
import { DatePickerField } from "../components/ui/date-controls";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { useApplication } from "../context/ApplicationContext";
import { Section1FormCard, Section1StepPage } from "../features/section1";
import { getBirthDateOpenToDate } from "../lib/datePickerHelpers";

export default function Section1PersonalContact() {
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
    <Section1StepPage step="personal-contact" persist={persist}>
      <div className="space-y-6">
        <Section1FormCard
          description="Basic details about you."
          icon={<UserCircle className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
          title="Personal information"
        >
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
        </Section1FormCard>

        <Section1FormCard
          description="How we can reach you during the application process."
          icon={<Phone className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cta-secondary)]" />}
          title="Contact details"
        >
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
        </Section1FormCard>
      </div>
    </Section1StepPage>
  );
}
